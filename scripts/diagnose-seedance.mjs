// Công cụ dò cách gọi Seedance trên TuanSu.
//
// Đặt key trước (PowerShell):   $env:TUANSU_API_KEY = "sk-..."
//
// 1) Dò cách gửi ảnh tham chiếu:
//      node diagnose-seedance.mjs "C:\anh.jpg"
// 2) Dò cách chọn tỉ lệ video khi có ảnh tham chiếu (thử với 9:16):
//      node diagnose-seedance.mjs ratio "C:\anh1.jpg" ["C:\anh2.jpg"]
// 2b) Thử chuyển 1 ảnh sang chế độ omni reference để chọn được tỉ lệ:
//      node diagnose-seedance.mjs omni "C:\anh.jpg"
// 3) Xem trạng thái + kích thước thật (rộng x cao) của video đã tạo — MIỄN PHÍ:
//      node diagnose-seedance.mjs status video_xxx
//
// Lỗi 400 bị từ chối trước khi tạo job nên KHÔNG tính phí. Gặp cách đầu tiên được chấp nhận (HTTP 200),
// script dừng lại và thử hủy job; nếu hủy không được thì job vẫn chạy và bị tính phí như bình thường.

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const BASE = (process.env.TUANSU_BASE_URL || 'https://tuansuapi.store/v1').replace(/\/+$/, '')
const KEY = process.env.TUANSU_API_KEY
const MODEL = process.env.SEEDANCE_MODEL || 'seedance-2.5-480p'
const TARGET_RATIO = process.env.TARGET_RATIO || '9:16'
// Tùy chọn: $env:PROMPT = "..." để tự đặt prompt; $env:SECONDS = "5" để đổi thời lượng (mặc định 4s cho rẻ)
const TEST_PROMPT = process.env.PROMPT || 'A cute mascot waving hello, gentle camera push in'
const TEST_SECONDS = Number(process.env.SECONDS || 4)
const TARGET_SIZE = { '9:16': '720x1280', '16:9': '1280x720', '1:1': '1024x1024' }[TARGET_RATIO] || '720x1280'
const auth = { Authorization: `Bearer ${KEY}` }
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

// ---------- Tiện ích ----------

/** Đọc kích thước ảnh PNG/JPEG từ bytes */
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      }
      i += 2 + len
    }
  }
  return null
}

/** Đọc kích thước video MP4 từ box 'tkhd' của track hình */
function mp4Size(buf) {
  let idx = buf.indexOf('tkhd')
  while (idx !== -1) {
    const boxStart = idx - 4
    const boxSize = buf.readUInt32BE(boxStart)
    const end = boxStart + boxSize
    if (end <= buf.length) {
      const w = buf.readUInt32BE(end - 8) / 65536
      const h = buf.readUInt32BE(end - 4) / 65536
      if (w > 0 && h > 0) return { w, h }
    }
    idx = buf.indexOf('tkhd', idx + 4)
  }
  return null
}

const ratioText = ({ w, h }) => `${w}x${h} (tỉ lệ ${(w / h).toFixed(3)} · 9:16=0.563 · 16:9=1.778 · 1:1=1.000)`

async function loadImage(input) {
  if (/^https?:\/\//i.test(input)) {
    const r = await fetch(input)
    if (!r.ok) throw new Error(`Không tải được ảnh từ link (HTTP ${r.status})`)
    const mime = r.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
    const bytes = Buffer.from(await r.arrayBuffer())
    return { url: input, bytes, mime }
  }
  const bytes = await readFile(input)
  const mime = MIME[extname(input).toLowerCase()] || 'image/jpeg'
  return { url: `data:${mime};base64,${bytes.toString('base64')}`, bytes, mime }
}

function describe(img, i) {
  const size = imageSize(img.bytes)
  return `Ảnh ${i + 1}: ${img.mime}, ${(img.bytes.length / 1024).toFixed(0)} KB${size ? `, ${ratioText(size)}` : ''}`
}

async function tryVariants(variants) {
  for (const [label, makeBody, kind, path = '/videos'] of variants) {
    const headers = kind === 'json' ? { ...auth, 'Content-Type': 'application/json' } : auth
    let res
    try {
      res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: makeBody() })
    } catch (e) {
      console.log(`${label}\n   → lỗi mạng: ${e.message}\n`)
      continue
    }
    const text = await res.text()
    let info = text.slice(0, 200)
    let json = null
    try {
      json = JSON.parse(text)
      const e = json.error
      info = e ? `${e.code || e.type || ''} · ${e.message || ''} · ${e.request_id || ''}` : `id=${json.id} status=${json.status}`
    } catch {}
    console.log(`${label}\n   → HTTP ${res.status} · ${info}\n`)

    if ([401, 402, 403].includes(res.status)) {
      console.log('Dừng: lỗi key/số dư, không liên quan tới định dạng.')
      return 1
    }
    if (res.ok) {
      console.log(`✅ ĐƯỢC CHẤP NHẬN: ${label}`)
      if (json?.id) {
        const del = await fetch(`${BASE}/videos/${json.id}`, { method: 'DELETE', headers: auth })
        console.log(del.ok
          ? `Đã hủy job ${json.id} (không tính phí).`
          : `Không hủy được job (HTTP ${del.status}) — job sẽ chạy tiếp và bị tính phí.\n` +
            `Khi job xong (thường 20–30 phút), chạy lệnh sau để xem video ra đúng tỉ lệ ${TARGET_RATIO} không:\n` +
            `   node diagnose-seedance.mjs status ${json.id}`)
      }
      return 0
    }
  }
  console.log('❌ Không cách nào được chấp nhận. Gửi toàn bộ kết quả trên (kèm request_id) cho mình hoặc admin TuanSu.')
  return 1
}

function multipart(fields, images) {
  return () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.append(k, String(v))
    images.forEach((img, i) => {
      const ext = (img.mime.split('/')[1] || 'jpeg').replace('jpeg', 'jpg')
      fd.append('input_reference', new Blob([img.bytes], { type: img.mime }), `reference${i + 1}.${ext}`)
    })
    return fd
  }
}

// ---------- Các chế độ ----------

async function modeStatus(id) {
  const res = await fetch(`${BASE}/videos/${id}`, { headers: auth })
  const text = await res.text()
  console.log(`GET /videos/${id} → HTTP ${res.status}\n${text.slice(0, 1500)}\n`)
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok || !json) return 1
  if (json.status !== 'completed') {
    console.log(`Job đang ở trạng thái "${json.status}". Chạy lại lệnh này sau vài phút.`)
    return 0
  }
  const contentUrl = json.url || json.video_url || `${BASE}/videos/${id}/content`
  const isGateway = contentUrl.startsWith(BASE)
  const vid = await fetch(contentUrl, { headers: isGateway ? auth : {} })
  if (!vid.ok) {
    console.log(`Không tải được video (HTTP ${vid.status}).`)
    return 1
  }
  const buf = Buffer.from(await vid.arrayBuffer())
  const size = mp4Size(buf)
  console.log(size
    ? `🎬 Kích thước video thật: ${ratioText(size)}`
    : `Đã tải video (${(buf.length / 1024).toFixed(0)} KB) nhưng không đọc được kích thước.`)
  return 0
}

async function modeRatio(inputs) {
  const imgs = await Promise.all(inputs.map(loadImage))
  imgs.forEach((img, i) => console.log(describe(img, i)))
  console.log(`Model: ${MODEL} · ${TEST_SECONDS}s · tỉ lệ muốn thử: ${TARGET_RATIO}\nPrompt: ${TEST_PROMPT}\n`)
  const [a] = imgs
  const base = { model: MODEL, prompt: TEST_PROMPT, seconds: TEST_SECONDS }
  const one = { image_url: a.url }
  const many = imgs.map(i => ({ image_url: i.url }))
  const json = (label, body, path) => [label, () => JSON.stringify(body), 'json', path]
  // Thứ tự: các trường tỉ lệ có trong tài liệu (aspect_ratio/size) thử trước — nếu được nhận thì gần như
  // chắc chắn có tác dụng. Các trường lạ (ratio, metadata) và cách viết trong prompt để cuối, vì máy chủ
  // có thể nhận nhưng lờ đi (vẫn tính phí) — khi đó cần chạy `status` để kiểm tra kích thước video thật.
  const variants = [
    json(`R1. endpoint phụ /video/generations: 1 ảnh + aspect_ratio "${TARGET_RATIO}"`,
      { ...base, aspect_ratio: TARGET_RATIO, input_reference: one }, '/video/generations'),
    json(`R2. endpoint phụ /video/generations: 1 ảnh + size "${TARGET_SIZE}"`,
      { ...base, size: TARGET_SIZE, input_reference: one }, '/video/generations'),
    [`R3. multipart: upload file + aspect_ratio "${TARGET_RATIO}"`,
      multipart({ ...base, aspect_ratio: TARGET_RATIO }, [a]), 'multipart'],
    [`R4. multipart: upload file + size "${TARGET_SIZE}"`,
      multipart({ ...base, size: TARGET_SIZE }, [a]), 'multipart'],
  ]
  if (imgs.length >= 2) {
    variants.push(
      json(`R5. ${imgs.length} ảnh (mảng) + aspect_ratio "${TARGET_RATIO}"`,
        { ...base, aspect_ratio: TARGET_RATIO, input_reference: many }),
      json(`R6. ${imgs.length} ảnh (mảng) + size "${TARGET_SIZE}"`,
        { ...base, size: TARGET_SIZE, input_reference: many }),
    )
  }
  variants.push(
    json(`R7. 1 ảnh + ratio "${TARGET_RATIO}" (tên tham số gốc của Seedance — có thể bị lờ đi)`,
      { ...base, ratio: TARGET_RATIO, input_reference: one }),
    json(`R8. 1 ảnh + metadata.ratio "${TARGET_RATIO}" (có thể bị lờ đi)`,
      { ...base, metadata: { ratio: TARGET_RATIO }, input_reference: one }),
    json(`R9. 1 ảnh + tỉ lệ viết trong prompt "--ratio ${TARGET_RATIO}" (chắc chắn được nhận, cần kiểm tra kết quả)`,
      { ...base, prompt: `${base.prompt} --ratio ${TARGET_RATIO}`, input_reference: one }),
  )
  // SKIP=R1,R7 để bỏ qua các cách đã thử
  const skip = (process.env.SKIP || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  return tryVariants(variants.filter(([label]) => !skip.includes(label.split('.')[0].toUpperCase())))
}

// Thử chuyển 1 ảnh sang chế độ "omni reference" (như plenxai gửi mode: "omni") để chọn được tỉ lệ.
// Mọi cách đều là 1 ảnh + aspect_ratio — tổ hợp đã biết chắc bị 400 nếu máy chủ bỏ qua trường mới,
// nên cách nào được nhận (HTTP 200) nghĩa là trường đó thật sự có tác dụng.
async function modeOmni(input) {
  const img = await loadImage(input)
  console.log(describe(img, 0))
  console.log(`Model: ${MODEL} · ${TEST_SECONDS}s · tỉ lệ muốn thử: ${TARGET_RATIO}\nPrompt: ${TEST_PROMPT}\n`)
  const base = { model: MODEL, prompt: TEST_PROMPT, seconds: TEST_SECONDS, aspect_ratio: TARGET_RATIO }
  const one = { image_url: img.url }
  const json = (label, body) => [label, () => JSON.stringify(body), 'json']
  const variants = [
    json('O0. reference_image_urls + omni_reference_task_type "reference" (theo admin TuanSu)',
      { ...base, prompt: base.prompt.replace(/@Image(\d+)/gi, '<Image $1>'), reference_image_urls: [img.url], omni_reference_task_type: 'reference' }),
    json('O1. mode "omni"', { ...base, mode: 'omni', input_reference: one }),
    json('O2. mode "omni" + input_reference dạng mảng', { ...base, mode: 'omni', input_reference: [one] }),
    json('O3. mode "omni_reference"', { ...base, mode: 'omni_reference', input_reference: one }),
    json('O4. mode "reference"', { ...base, mode: 'reference', input_reference: one }),
    json('O5. reference_mode "omni"', { ...base, reference_mode: 'omni', input_reference: one }),
    json('O6. metadata.mode "omni"', { ...base, metadata: { mode: 'omni' }, input_reference: one }),
    json('O7. 1 ảnh gửi 2 lần (cách web đang dùng)', { ...base, input_reference: [one, one] }),
  ]
  const skip = (process.env.SKIP || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  return tryVariants(variants.filter(([label]) => !skip.includes(label.split('.')[0].toUpperCase())))
}

async function modeFormat(input) {
  const img = await loadImage(input)
  console.log(describe(img, 0))
  console.log(`Model: ${MODEL} · base: ${BASE}\n`)
  const base = { model: MODEL, prompt: TEST_PROMPT, seconds: TEST_SECONDS }
  const u = img.url
  const json = (label, body) => [label, () => JSON.stringify(body), 'json']
  return tryVariants([
    json('A. input_reference object + aspect_ratio', { ...base, aspect_ratio: '9:16', input_reference: { image_url: u } }),
    json('B. input_reference mảng + aspect_ratio', { ...base, aspect_ratio: '9:16', input_reference: [{ image_url: u }] }),
    json('C. input_reference object, KHÔNG aspect_ratio', { ...base, input_reference: { image_url: u } }),
    json('D. input_reference object + aspect_ratio "auto"', { ...base, aspect_ratio: 'auto', input_reference: { image_url: u } }),
    json('E. input_reference object + size 720x1280', { ...base, size: '720x1280', input_reference: { image_url: u } }),
  ])
}

// ---------- Chạy ----------

async function main() {
  const [first, ...rest] = process.argv.slice(2)
  if (!KEY) {
    console.error('Thiếu API key. Chạy trước:  $env:TUANSU_API_KEY = "sk-..."')
    return 1
  }
  if (!first) {
    console.error('Thiếu tham số. Xem hướng dẫn ở đầu file diagnose-seedance.mjs')
    return 1
  }
  if (first === 'status') return modeStatus(rest[0])
  if (first === 'ratio') return modeRatio(rest)
  if (first === 'omni') return modeOmni(rest[0])
  return modeFormat(first)
}

process.exitCode = await main()
