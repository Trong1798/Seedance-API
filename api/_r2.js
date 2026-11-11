// Cloudflare R2 (tương thích S3) — dùng chung cho api/*.js trên Vercel và middleware khi chạy `npm run dev`.
// Cần các biến môi trường: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
import { AwsClient } from 'aws4fetch'

const FOLDERS = ['references', 'images', 'videos']
const MAX_MIRROR_BYTES = 50 * 1024 * 1024

export function getR2Config() {
  // Chấp nhận cả khi dán nguyên link S3 endpoint (https://<id>.r2.cloudflarestorage.com): chỉ lấy mã 32 ký tự
  const rawAccount = (process.env.R2_ACCOUNT_ID || '').trim()
  const accountId = (rawAccount.match(/[0-9a-f]{32}/i) || [rawAccount])[0]
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim()
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim()
  const bucket = (process.env.R2_BUCKET || '').trim()
  const publicUrl = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '')
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl }
}

function client(cfg) {
  return new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: 's3', region: 'auto' })
}

function objectEndpoint(cfg, key) {
  const path = key.split('/').map(encodeURIComponent).join('/')
  return `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${path}`
}

function safeName(name) {
  const raw = String(name || 'file')
  const dot = raw.lastIndexOf('.')
  const base = (dot > 0 ? raw.slice(0, dot) : raw)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file'
  const ext = (dot > 0 ? raw.slice(dot + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  return ext ? `${base}.${ext}` : base
}

/** Tạo khóa file kiểu videos/2026-11/abc123-ten-file.mp4 */
export function makeObjectKey(folder, filename) {
  const dir = FOLDERS.includes(folder) ? folder : 'references'
  const month = new Date().toISOString().slice(0, 7)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${dir}/${month}/${rand}-${safeName(filename)}`
}

export function publicUrlFor(cfg, key) {
  return `${cfg.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/** Link ký sẵn (15 phút) để trình duyệt PUT thẳng file lên R2, không đi qua Vercel */
export async function presignPut(cfg, key, contentType, expiresSeconds = 900) {
  const url = new URL(objectEndpoint(cfg, key))
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds))
  const signed = await client(cfg).sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  })
  return signed.url
}

export async function putObject(cfg, key, body, contentType) {
  const res = await client(cfg).fetch(objectEndpoint(cfg, key), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  })
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Trả về khóa file nếu link thuộc R2 của web này, ngược lại null */
export function keyFromPublicUrl(cfg, url) {
  if (!cfg || typeof url !== 'string' || !url.startsWith(cfg.publicUrl + '/')) return null
  try {
    return url.slice(cfg.publicUrl.length + 1).split('?')[0].split('/').map(decodeURIComponent).join('/')
  } catch {
    return null
  }
}

export async function deleteObject(cfg, key) {
  const res = await client(cfg).fetch(objectEndpoint(cfg, key), { method: 'DELETE' })
  // R2 trả 204 kể cả khi file không tồn tại
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/**
 * Máy chủ tự tải file từ link công khai (vd. ảnh CDN của Higgsfield khi trình duyệt bị CORS chặn) rồi lưu lên R2.
 * Chỉ nhận https, chỉ nhận ảnh/video, tối đa 50MB.
 */
export async function mirrorToR2(cfg, sourceUrl, folder) {
  let parsed
  try { parsed = new URL(sourceUrl) } catch { throw Object.assign(new Error('Link không hợp lệ'), { status: 400 }) }
  if (parsed.protocol !== 'https:') throw Object.assign(new Error('Chỉ nhận link https'), { status: 400 })

  const src = await fetch(parsed.toString(), { redirect: 'follow' })
  if (!src.ok) throw Object.assign(new Error(`Không tải được file gốc (${src.status})`), { status: 502 })
  const contentType = (src.headers.get('content-type') || '').split(';')[0].trim()
  if (!/^(image|video)\//.test(contentType)) throw Object.assign(new Error(`File gốc không phải ảnh/video (${contentType || 'không rõ'})`), { status: 415 })
  const declared = Number(src.headers.get('content-length') || 0)
  if (declared > MAX_MIRROR_BYTES) throw Object.assign(new Error('File quá lớn để máy chủ tải hộ'), { status: 413 })

  const buf = Buffer.from(await src.arrayBuffer())
  if (buf.length > MAX_MIRROR_BYTES) throw Object.assign(new Error('File quá lớn để máy chủ tải hộ'), { status: 413 })

  const ext = contentType.split('/')[1].replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const baseName = decodeURIComponent(parsed.pathname.split('/').pop() || 'file').replace(/\.[^.]*$/, '')
  const key = makeObjectKey(folder, `${baseName}.${ext}`)
  await putObject(cfg, key, buf, contentType)
  return { key, url: publicUrlFor(cfg, key) }
}
