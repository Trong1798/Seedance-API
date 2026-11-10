// Lưu file: ưu tiên Cloudflare R2 (trình duyệt PUT thẳng qua link ký sẵn từ /api/r2),
// máy chủ chưa cài biến R2_* thì quay về Vercel Blob như trước.
import { fetchVideoBlob } from './api.js'

const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
}

function toSafeBlobFilename(file) {
  const rawName = file.name || 'image'
  const dot = rawName.lastIndexOf('.')
  const base = dot > 0 ? rawName.slice(0, dot) : rawName
  const ext = (dot > 0 ? rawName.slice(dot + 1) : MIME_EXT[file.type] || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const slug = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image'
  return `${slug}.${ext}`
}

/** Gửi file bằng XHR để có % tiến trình */
function xhrSend({ method, url, body, headers = {}, onProgress, signal, timeoutMs, label }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const onAbort = () => xhr.abort()
    signal?.addEventListener('abort', onAbort)
    const timeoutId = setTimeout(() => xhr.abort(), timeoutMs)
    const done = () => { clearTimeout(timeoutId); signal?.removeEventListener('abort', onAbort) }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      done()
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.responseText)
      let msg = `${label} thất bại (${xhr.status})`
      try { const j = JSON.parse(xhr.responseText); if (j.error) msg = j.error } catch {}
      reject(new Error(msg))
    })
    xhr.addEventListener('error', () => {
      done()
      reject(new Error(`Lỗi kết nối khi ${label.toLowerCase()}. Kiểm tra internet và cài đặt CORS của bucket R2.`))
    })
    xhr.addEventListener('abort', () => { done(); reject(new Error(`${label} đã bị hủy hoặc quá thời gian`)) })

    xhr.open(method, url, true)
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.send(body)
  })
}

async function callR2(action, payload) {
  const res = await fetch(`/api/r2?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 503 && data.error === 'r2_not_configured') return null
  // Chạy `npm run dev` mà thiếu middleware / chạy bản build tĩnh: coi như chưa có R2
  if (res.status === 404 && !data.error) return null
  if (!res.ok) throw new Error(data.error || `R2 lỗi ${res.status}`)
  return data
}

/**
 * Upload một file/blob lên R2. Trả về {url, key}, hoặc null nếu máy chủ chưa cài R2.
 * @param {Blob} blob
 * @param {{folder:'references'|'images'|'videos', filename:string, onProgress?:Function, signal?:AbortSignal}} opts
 */
export async function uploadToR2(blob, { folder, filename, onProgress, signal } = {}) {
  const contentType = blob.type || 'application/octet-stream'
  const signed = await callR2('sign', { folder, filename, contentType })
  if (!signed) return null
  await xhrSend({
    method: 'PUT',
    url: signed.uploadUrl,
    body: blob,
    headers: { 'Content-Type': contentType },
    onProgress,
    signal,
    timeoutMs: 30 * 60 * 1000,
    label: 'Upload lên R2',
  })
  return { url: signed.url, key: signed.key }
}

/**
 * Upload ảnh tham chiếu (R2, hoặc Vercel Blob nếu chưa cài R2)
 * @returns {Promise<{blobUrl: string, pathname: string}>} pathname dùng để xóa sau này
 */
export async function uploadToBlob(file, onProgress = null, signal = null) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Chỉ hỗ trợ file hình ảnh (PNG, JPG, WEBP, GIF)')
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('Dung lượng ảnh tối đa 100MB')
  }

  const filename = toSafeBlobFilename(file)
  const r2 = await uploadToR2(file, { folder: 'references', filename, onProgress, signal })
  if (r2) return { blobUrl: r2.url, pathname: r2.url }

  // Dự phòng: Vercel Blob (đi qua hàm máy chủ /api/upload, giới hạn ~4,5MB trên Vercel)
  const text = await xhrSend({
    method: 'POST',
    url: `/api/upload?filename=${encodeURIComponent(filename)}`,
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    onProgress,
    signal,
    timeoutMs: 120000,
    label: 'Upload ảnh',
  })
  let response
  try { response = JSON.parse(text) } catch { throw new Error('Lỗi xử lý phản hồi từ server') }
  return { blobUrl: response.url, pathname: response.pathname }
}

/** Link đã nằm trên kho lưu trữ của web (R2 hoặc Vercel Blob) */
export function isStoredUrl(url) {
  return typeof url === 'string' && (/^https:\/\/[^/]+\.r2\.dev\//.test(url) || /\.public\.blob\.vercel-storage\.com\//.test(url))
}

/**
 * Lưu ảnh/video vừa tạo lên R2 để không phụ thuộc link của nhà cung cấp (hết hạn sau 24 giờ – 7 ngày).
 * Trả về {url, key} hoặc null nếu máy chủ chưa cài R2.
 */
export async function persistGeneratedMedia(item, { apiKey, onProgress, signal } = {}) {
  if (!item?.url || isStoredUrl(item.url)) return null
  const isImage = item.mediaType === 'image'
  const folder = isImage ? 'images' : 'videos'

  let blob = null
  try {
    // Video đã được tải sẵn vào bộ nhớ (blob:) lúc tạo xong; nếu chưa thì tải lại (content_url cần key Xianfeng)
    const local = item.blobUrl || await fetchVideoBlob(item.url, apiKey)
    blob = await (await fetch(local)).blob()
    if (!item.blobUrl) URL.revokeObjectURL(local)
  } catch (err) {
    if (!isImage) throw new Error(`Không tải được video để lưu: ${err.message}`)
    // Ảnh CDN có thể bị CORS chặn: để máy chủ tự tải hộ
    const mirrored = await callR2('mirror', { url: item.url, folder })
    return mirrored ? { url: mirrored.url, key: mirrored.key } : null
  }

  const type = blob.type || (isImage ? 'image/png' : 'video/mp4')
  const typed = blob.type ? blob : new Blob([blob], { type })
  const ext = MIME_EXT[type] || (isImage ? 'png' : 'mp4')
  const filename = `${String(item.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'media'}.${ext}`
  return uploadToR2(typed, { folder, filename, onProgress, signal })
}

/**
 * Xóa file trên R2 hoặc Vercel Blob (máy chủ tự nhận biết theo link)
 * @param {string} pathname - link công khai (R2/Blob) hoặc pathname của Blob
 */
export async function deleteFromBlob(pathname) {
  if (!pathname) {
    throw new Error('Invalid pathname')
  }

  const res = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: pathname }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Không thể xóa file')
  }

  return true
}
