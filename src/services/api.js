import { getApiKey, getHiggsfieldCredentials } from './storage.js'

// ============================================================================
// VIDEO: Xianfeng API (仙凤API) — https://xianfengapi.xyz/docs#model-seedance
//   Có hỗ trợ CORS nên gọi thẳng từ trình duyệt. Tính tiền theo video (CNY).
// ẢNH:  Higgsfield Soul Cinema — https://docs.higgsfield.ai/docs/models/soul-cinema
//   Higgsfield chặn gọi từ trình duyệt nên đi qua lớp trung gian của web: /api/hf/<đường dẫn>
//   (api/hf.js trên Vercel, middleware trong vite.config.js khi chạy trên máy).
// ============================================================================
export const XIANFENG_ORIGIN = 'https://xianfengapi.xyz'
export const XIANFENG_BASE = `${XIANFENG_ORIGIN}/v1`
export const HF_PROXY = '/api/hf'
const WALLET_HINT = 'Nạp tiền trong mục Ví (钱包) trên xianfengapi.xyz.'

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
})

function authHeaders(apiKey, json = false) {
  const h = { Authorization: `Bearer ${String(apiKey || '').trim()}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

// ---------------------------------------------------------------------------
// Lỗi
// ---------------------------------------------------------------------------

/**
 * Đọc thông tin lỗi từ phản hồi của máy chủ. Các dạng gặp được:
 *  - {"error": "invalid_api_key", "message": "..."}         (lỗi do API trả về)
 *  - {"error": {"message": "...", "code": "..."}}           (dạng OpenAI)
 *  - {"detail": "..."} hoặc {"detail": [{loc, msg}, ...]}   (lỗi kiểm tra dữ liệu, mã 422)
 */
export function extractServerError(json) {
  if (!json || typeof json !== 'object') return { message: '', code: '', extra: '' }
  let message = ''
  let code = ''
  if (typeof json.error === 'string') {
    code = json.error
    message = json.message || ''
  } else if (json.error && typeof json.error === 'object') {
    code = json.error.code || json.error.type || ''
    message = json.error.message || ''
  } else if (json.message) {
    message = json.message
  }
  if (!message && json.detail) {
    message = Array.isArray(json.detail)
      ? json.detail.map(d => `${(d.loc || []).filter(x => x !== 'body').join('.')}: ${d.msg}`).join('; ')
      : String(json.detail)
  }
  // 402 kèm số dư hiện có và số tiền cần
  const extra = json.balance != null && json.required != null
    ? `Số dư: ${Number(json.balance).toLocaleString('vi-VN')}đ, cần: ${Number(json.required).toLocaleString('vi-VN')}đ.`
    : ''
  return { message, code, extra }
}

/**
 * Diễn giải lỗi theo bảng mã lỗi trong tài liệu (mục 5), giữ lại thông điệp gốc của máy chủ.
 * kind: 'video' | 'image' | 'status' | 'balance'
 */
export function describeApiError(status, { message = '', code = '', extra = '' } = {}, kind = 'video') {
  const what = kind === 'image' ? 'tạo ảnh' : 'tạo video'
  let friendly
  if (status === 401) {
    friendly = 'API Key sai, đã bị xóa hoặc hết hạn. Tạo key mới trong mục API 密钥 trên xianfengapi.xyz rồi dán vào phần Cài đặt.'
  } else if (status === 402) {
    friendly = `Số dư không đủ để ${what}. ${WALLET_HINT}`
  } else if (status === 403) {
    friendly = `Số dư hoặc hạn mức của key không đủ, hoặc key chưa được bật model này. ${WALLET_HINT}`
  } else if (status === 400 && code === 'invalid_reference') {
    friendly = 'Ảnh tham chiếu không mở được hoặc sai định dạng (cần link https:// công khai trả về đúng file ảnh).'
  } else if (status === 400 && code === 'task_not_exist') {
    friendly = 'Không tìm thấy đơn này (sai ID hoặc không phải key này tạo).'
  } else if (status === 400 || status === 422) {
    friendly = 'Dữ liệu gửi lên không hợp lệ (model, thời lượng, độ phân giải, tỉ lệ hoặc ảnh tham chiếu).'
  } else if (status === 404) {
    friendly = kind === 'status' ? 'Không tìm thấy đơn này (sai ID hoặc đã hết hạn lưu).' : 'Không tìm thấy (sai đường dẫn hoặc đơn không tồn tại).'
  } else if (status === 409) {
    friendly = 'Video chưa sẵn sàng hoặc đơn không hủy được.'
  } else if (status === 429) {
    friendly = 'Gửi quá nhanh, máy chủ tạm chặn. Đợi một lúc rồi thử lại (không bị trừ tiền).'
  } else if (status === 503 && code === 'model_not_found') {
    friendly = 'Key này chưa được dùng model này (sai tên model hoặc nhóm của key không có model). Kiểm tra trong mục API 密钥.'
  } else if (status === 503) {
    friendly = 'Máy chủ đang bận. Đợi khoảng 30 giây rồi thử lại. Không bị trừ tiền.'
  } else if (status === 504 && code === 'convert_timeout') {
    friendly = 'Xử lý ảnh tham chiếu quá lâu nên đơn chưa được tạo. Không bị trừ tiền; thử lại hoặc dùng ảnh nhỏ hơn.'
  } else if (status === 507) {
    friendly = 'Kho lưu tạm của máy chủ đang đầy. Thử lại sau. Không bị trừ tiền.'
  } else if (status === 499 || status === 524 || status === 504) {
    friendly = 'Kết nối bị ngắt do quá thời gian chờ. Vui lòng thử lại.'
  } else if (status >= 500) {
    friendly = 'Máy chủ đang gặp lỗi tạm thời. Đơn lỗi được tự hoàn tiền.'
  } else {
    friendly = message || `Lỗi không xác định khi ${what}.`
  }
  const meta = [status ? `HTTP ${status}` : '', code].filter(Boolean).join(' · ')
  const detail = message && message !== friendly ? `\nChi tiết từ máy chủ: ${message}` : ''
  return `${friendly}${meta ? ` (${meta})` : ''}${detail}${extra ? `\n${extra}` : ''}`
}

/** Đọc body lỗi của Response (chỉ đọc 1 lần) và trả về Error đã được diễn giải. */
export async function readApiError(res, kind = 'video') {
  let text = ''
  try { text = await res.text() } catch {}
  let info = { message: '', code: '', extra: '' }
  try {
    info = extractServerError(JSON.parse(text))
  } catch {
    info.message = text.trim().slice(0, 300)
  }
  const err = new Error(describeApiError(res.status, info, kind))
  err.status = res.status
  err.code = info.code
  return err
}

// ---------------------------------------------------------------------------
// Đường dẫn media
// ---------------------------------------------------------------------------

/** Xianfeng trả content_url dạng tương đối (/v1/videos/{id}/content) → đổi thành link đầy đủ */
export function resolveVideoUrl(rawUrl) {
  if (!rawUrl) return null
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return rawUrl
  if (rawUrl.startsWith('/v1/videos/')) return `${XIANFENG_ORIGIN}${rawUrl}`
  return rawUrl
}

/** Link tải video của Xianfeng cần header Authorization (content_url); link ký sẵn (download_url) thì không */
const isXianfengAuthUrl = (url) => typeof url === 'string' &&
  url.startsWith(`${XIANFENG_BASE}/videos/`) && url.split('?')[0].endsWith('/content')

/** Nhận biết một mục là ảnh hay video */
export function isMediaImage(item) {
  if (!item) return false
  if (typeof item === 'string') {
    return (
      item.startsWith('data:image') ||
      /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(item) ||
      item.includes('/v1/images/')
    )
  }
  if (item.mediaType === 'image') return true
  if (item.mediaType === 'video') return false
  const modelStr = String(item.model || '').toLowerCase()
  if (/image|banana|seedream|soul|flare|sunburst/.test(modelStr)) return true
  return isMediaImage(String(item.url || item.directUrl || ''))
}

/** Link ảnh dùng được trực tiếp trong <img> (ảnh Soul Cinema là link CDN công khai) */
export function getDirectImageUrl(rawUrl) {
  return rawUrl ? resolveVideoUrl(rawUrl) : null
}

/** Link video dùng trong <video>. content_url của Xianfeng cần key nên web tải về dạng blob trước khi phát. */
export function getDirectVideoUrl(rawUrl) {
  return rawUrl ? resolveVideoUrl(rawUrl) : null
}

/** Tải file về bộ nhớ trình duyệt (blob:) để phát/tải xuống ổn định */
export async function fetchVideoBlob(url, apiKey) {
  if (!url) throw new Error('URL không tồn tại.')
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  const resolved = resolveVideoUrl(url)
  const key = (apiKey || getApiKey() || '').trim()
  const headers = isXianfengAuthUrl(resolved) && key ? authHeaders(key) : {}
  const res = await fetch(resolved, { credentials: 'omit', headers })
  if (!res.ok) {
    const err = await readApiError(res, 'status')
    throw new Error(`Không thể tải file từ máy chủ: ${err.message}`)
  }
  return URL.createObjectURL(await res.blob())
}

// ---------------------------------------------------------------------------
// Theo dõi đơn video (Xianfeng)
// ---------------------------------------------------------------------------

const DONE = ['completed', 'succeeded']
const FAILED = ['failed', 'cancelled', 'canceled', 'error']

/**
 * Hỏi trạng thái đơn video đến khi xong: GET https://xianfengapi.xyz/v1/videos/{id}.
 * Lỗi tạm thời (mạng, 5xx, 429) được thử lại; lỗi 5xx liên tục quá maxServerErrorMs thì dừng và báo rõ.
 */
export async function pollJob(kind, id, apiKey, { signal, onHeartbeat, intervalMs = 15000, maxServerErrorMs = 5 * 60 * 1000 } = {}) {
  const endpoint = `${XIANFENG_BASE}/videos/${encodeURIComponent(id)}`
  const label = kind === 'image' ? 'ảnh' : 'video'
  let firstServerErrorAt = null

  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    let res
    try {
      res = await fetch(endpoint, { headers: authHeaders(apiKey), signal })
    } catch (netErr) {
      if (signal?.aborted) throw netErr
      onHeartbeat?.({ timestamp: Date.now(), message: 'Mất kết nối tạm thời, đang thử lại...' })
      await sleep(5000, signal)
      continue
    }

    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) {
        firstServerErrorAt ??= Date.now()
        if (Date.now() - firstServerErrorAt > maxServerErrorMs) {
          const err = await readApiError(res, 'status')
          throw new Error(
            `Máy chủ không trả được trạng thái đơn ${id} trong hơn ${Math.round(maxServerErrorMs / 60000)} phút.\n${err.message}\n` +
            'Đơn có thể đã lỗi phía máy chủ (đơn lỗi được tự hoàn tiền). Gửi ID này cho admin trong bot nếu bị trừ tiền.'
          )
        }
        onHeartbeat?.({ timestamp: Date.now(), message: `Máy chủ đang lỗi tạm thời (HTTP ${res.status}), đang thử lại...` })
        await sleep(res.status === 429 ? 30000 : 10000, signal)
        continue
      }
      const err = await readApiError(res, 'status')
      err.message = `Lỗi kiểm tra trạng thái ${label} (ID: ${id}): ${err.message}`
      throw err
    }
    firstServerErrorAt = null

    const data = await res.json()
    const progress = Number.isFinite(Number(data.progress)) ? Number(data.progress) : null
    onHeartbeat?.({
      timestamp: Date.now(),
      status: data.status,
      progress,
      message: ['queued', 'pending'].includes(data.status)
        ? `Đơn đang xếp hàng (ID: ${id})...`
        : `Đang tạo ${label}... ${progress != null ? `${progress}%` : ''}`,
    })

    if (DONE.includes(data.status)) return data
    if (FAILED.includes(data.status)) {
      const reason = typeof data.error === 'string' ? data.error : (data.error?.message || data.message || '')
      const refundNote = 'Đơn thất bại được tự hoàn lại toàn bộ tiền đã giữ.'
      throw new Error(
        `${label[0].toUpperCase()}${label.slice(1)} ${data.status === 'failed' ? 'thất bại' : 'đã bị hủy'} (ID: ${id})` +
        `${reason ? `: ${reason}` : ''}\n${refundNote}`
      )
    }
    await sleep(intervalMs, signal)
  }
}

// Giữ tên cũ cho các chỗ đang dùng
export const pollVideoStatus = (videoId, apiKey, _baseUrl, opts) => pollJob('video', videoId, apiKey, opts)

function selectedReferenceUrls(referenceImages, referenceImage) {
  return Array.isArray(referenceImages) && referenceImages.length > 0
    ? referenceImages.filter(i => i.selected).map(img => (typeof img === 'string' ? img : img.url)?.trim()).filter(Boolean)
    : (typeof referenceImage === 'string' && referenceImage.trim() ? [referenceImage.trim()] : [])
}

function summarizePayload(payload) {
  return Object.entries(payload)
    .map(([k, v]) => {
      if (k === 'prompt') return `prompt=${String(v).length} ký tự`
      if (Array.isArray(v)) return `${k}=${v.length} mục`
      return `${k}=${v}`
    })
    .join(' · ')
}

// ---------------------------------------------------------------------------
// Tạo video — Xianfeng POST https://xianfengapi.xyz/v1/videos
// ---------------------------------------------------------------------------

/**
 * Đổi thẻ @Image1, @Image2... trong prompt thành 图片1, 图片2... — cách tài liệu Xianfeng
 * dặn gọi ảnh tham chiếu theo thứ tự trong mảng images (「图片1」「视频1」「音频1」).
 */
export function toXianfengImageTags(text, tag = '图片') {
  return text.replace(/@Image\s*(\d+)/gi, (_, n) => `${tag}${n}`)
}

/**
 * Trường gửi lên (theo tài liệu seedance-2.5): model, prompt (bắt buộc, ≤45000 ký tự), seconds (số nguyên
 * 4–30; 5–30 khi có trên 9 ảnh), aspect_ratio (auto, 16:9, 9:16, 1:1, 4:3, 3:4, 21:9), resolution "720p",
 * images (tối đa 30, link https hoặc Data URL, chỉ làm ảnh tham chiếu — không có ảnh đầu/cuối).
 */
export async function generateVideo({
  model = 'seedance-2.5',
  prompt,
  seconds = 5,
  resolution = '720p',
  aspectRatio = '16:9',
  referenceImage = null,
  referenceImages = null,
  maxReferenceImages = 30,
  pollIntervalMs = 15000,
  maxWaitMs = 2 * 60 * 60 * 1000,
  // Mỗi model Xianfeng có cách viết riêng (xem constants/models.js):
  //  seedance-2.5 → 图片1, images là chuỗi link, aspect_ratio
  //  JD2.5满参    → @图片1, images là {"url"}, ratio
  apiStyle = { imageTag: '图片', imagesAsObjects: false, ratioField: 'aspect_ratio' },
  signal = null,
  onHeartbeat = null,
}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('MISSING_API_KEY')
  if (!prompt || !prompt.trim()) throw new Error('Vui lòng nhập mô tả (prompt) cho video!')

  const images = selectedReferenceUrls(referenceImages, referenceImage)
  if (images.length > maxReferenceImages) {
    throw new Error(`Model ${model} chỉ hỗ trợ tối đa ${maxReferenceImages} ảnh tham chiếu (bạn đang chọn ${images.length} ảnh).`)
  }
  const sec = Math.round(Number(seconds))
  const minSec = images.length > 9 ? 5 : 4
  if (!(sec >= minSec && sec <= 30)) {
    throw new Error(`Thời lượng phải từ ${minSec} đến 30 giây${images.length > 9 ? ' khi dùng trên 9 ảnh tham chiếu' : ''}.`)
  }

  const payload = {
    model,
    prompt: images.length > 0 ? toXianfengImageTags(prompt.trim(), apiStyle.imageTag || '图片') : prompt.trim(),
    seconds: sec,
    [apiStyle.ratioField || 'aspect_ratio']: aspectRatio || '16:9',
    resolution: resolution || '720p',
  }
  if (images.length > 0) {
    payload.images = apiStyle.imagesAsObjects ? images.map(url => ({ url })) : images
  }

  const controller = new AbortController()
  let isTimedOut = false
  let taskId = null
  const timeoutId = setTimeout(() => { isTimedOut = true; controller.abort('timeout') }, maxWaitMs)
  signal?.addEventListener('abort', () => controller.abort(signal.reason || 'User cancelled'), { once: true })

  try {
    // Tài liệu: có ảnh tham chiếu thì bước gửi đơn có thể mất từ vài chục giây tới vài phút
    onHeartbeat?.({ timestamp: Date.now(), message: 'Đang gửi đơn tạo video (có ảnh tham chiếu có thể mất vài chục giây)...' })
    const res = await fetch(`${XIANFENG_BASE}/videos`, {
      method: 'POST',
      headers: authHeaders(apiKey, true),
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const err = await readApiError(res, 'video')
      if (res.status === 400 || res.status === 422) err.message += `\nRequest đã gửi: ${summarizePayload(payload)}`
      throw err
    }

    let data = await res.json()
    taskId = data.id
    if (!taskId) throw new Error('Máy chủ không trả về ID đơn video.')
    onHeartbeat?.({ timestamp: Date.now(), status: data.status, message: `Đã nhận đơn (ID: ${taskId}). Đang chờ tạo video...` })

    if (!DONE.includes(data.status)) {
      data = await pollJob('video', taskId, apiKey, { signal: controller.signal, onHeartbeat, intervalMs: pollIntervalMs })
    }
    clearTimeout(timeoutId)

    // Ưu tiên link ký sẵn (download_url/url: không cần key, hết hạn sau 24 giờ); không có thì dùng content_url + key
    const signedUrl = data.download_url || data.url || null
    const fileUrl = signedUrl || resolveVideoUrl(data.content_url || `/v1/videos/${taskId}/content`)

    let blobUrl = null
    try {
      blobUrl = await fetchVideoBlob(fileUrl, apiKey)
    } catch (blobErr) {
      console.warn('Không tải trước được video (sẽ phát trực tiếp):', blobErr)
    }

    return {
      id: taskId,
      mediaType: 'video',
      url: fileUrl,
      directUrl: fileUrl,
      blobUrl,
      downloadExpiresAt: data.download_expires_at || null,
      prompt: prompt.trim(),
      model,
      seconds: sec,
      resolution: payload.resolution,
      ratio: aspectRatio || '16:9',
      status: 'completed',
      createdAt: new Date().toISOString(),
      raw: data,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    const jobNote = taskId
      ? `\nĐơn ${taskId} vẫn chạy trên máy chủ (vẫn tính phí nếu hoàn tất). Xem lại trong mục 任务日志 (nhật ký tác vụ) trên xianfengapi.xyz, đừng gửi lại đơn mới.`
      : ''
    if (isTimedOut) throw new Error(`Đã chờ quá ${Math.round(maxWaitMs / 60000)} phút mà video chưa xong.${jobNote}`)
    if (err.name === 'AbortError' || signal?.aborted) {
      throw new Error(taskId ? `Đã dừng chờ video.${jobNote}` : 'Đã hủy tạo video.')
    }
    if (err instanceof TypeError) {
      throw new Error(`Không kết nối được tới máy chủ (${err.message}). Kiểm tra kết nối mạng.${jobNote}`)
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Tạo ảnh — Higgsfield Soul Cinema (POST /higgsfield-ai/soul/cinema, qua /api/hf)
// ---------------------------------------------------------------------------

function hfAuthHeaders(json = false) {
  const { keyId, secret } = getHiggsfieldCredentials()
  const h = { Authorization: `Key ${keyId}:${secret}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

/** Đọc lỗi Higgsfield ({"detail": "..."} hoặc danh sách lỗi kiểm tra dữ liệu) và diễn giải theo bảng mã lỗi */
async function readHiggsfieldError(res) {
  let detail = ''
  try {
    const json = await res.json()
    detail = Array.isArray(json.detail)
      ? json.detail.map(d => `${(d.loc || []).filter(x => x !== 'body').join('.')}: ${d.msg}`).join('; ')
      : String(json.detail || json.message || '')
  } catch {}
  const s = res.status
  const friendly =
    s === 401 ? 'Higgsfield Key ID hoặc Secret sai. Kiểm tra lại trong phần Cài đặt (tạo key tại console.higgsfield.ai).'
    : s === 403 ? 'Tài khoản Higgsfield không đủ số dư. Nạp thêm tại console.higgsfield.ai.'
    : s === 404 ? 'Không tìm thấy (model chưa mở cho tài khoản này, hoặc sai ID yêu cầu).'
    : s === 400 || s === 422 ? 'Dữ liệu gửi lên không hợp lệ (prompt, tỉ lệ hoặc độ phân giải).'
    : s === 423 ? 'Model Soul Cinema đang tạm khóa. Thử lại sau.'
    : s === 429 ? `Hàng chờ của tài khoản đã đầy hoặc gửi quá nhanh.${res.headers.get('retry-after') ? ` Thử lại sau ${res.headers.get('retry-after')} giây.` : ' Thử lại sau.'}`
    : s === 503 ? 'Model đang tạm ngưng hoặc chưa sẵn sàng. Thử lại sau.'
    : s >= 500 ? 'Máy chủ Higgsfield đang lỗi tạm thời. Thử lại sau.'
    : `Lỗi không xác định (HTTP ${s}).`
  const cid = res.headers.get('x-correlation-id')
  const err = new Error(`${friendly} (HTTP ${s}${cid ? ` · correlation id: ${cid}` : ''})${detail && detail !== friendly ? `\nChi tiết từ máy chủ: ${detail}` : ''}`)
  err.status = s
  return err
}

/** status_url/cancel_url của Higgsfield → đường dẫn tương ứng qua lớp trung gian /api/hf */
function toHfProxy(url) {
  return String(url).replace(/^https:\/\/api\.higgsfield\.ai\//, `${HF_PROXY}/`)
}

/**
 * Soul Cinema chỉ tạo ảnh từ chữ (không nhận ảnh tham chiếu).
 * Trường gửi lên: prompt, aspect_ratio (9:16, 16:9, 4:3, 3:4, 1:1, 2:3, 3:2), resolution (720p | 1080p),
 * enhance_prompt, batch_size (1 hoặc 4). Kết quả: images[].url (link CDN, giữ 7 ngày).
 */
export async function generateImage({
  model = 'higgsfield-ai/soul/cinema',
  prompt,
  aspectRatio = '1:1',
  resolution = '1080p',
  enhancePrompt = false,
  referenceImages = null,
  maxWaitMs = 10 * 60 * 1000,
  signal = null,
  onHeartbeat = null,
}) {
  const { keyId, secret } = getHiggsfieldCredentials()
  if (!keyId || !secret) throw new Error('MISSING_HF_KEY')
  if (!prompt || !prompt.trim()) throw new Error('Vui lòng nhập mô tả (prompt) cho hình ảnh!')

  const selectedRefs = Array.isArray(referenceImages) ? referenceImages.filter(i => i.selected).length : 0
  const payload = {
    prompt: prompt.trim(),
    aspect_ratio: aspectRatio || '1:1',
    resolution: resolution === '720p' ? '720p' : '1080p',
    enhance_prompt: Boolean(enhancePrompt),
    batch_size: 1,
  }

  const controller = new AbortController()
  let isTimedOut = false
  let requestId = null
  let cancelUrl = null
  const timeoutId = setTimeout(() => { isTimedOut = true; controller.abort('timeout') }, maxWaitMs)
  signal?.addEventListener('abort', () => controller.abort(signal.reason || 'User cancelled'), { once: true })

  try {
    onHeartbeat?.({
      timestamp: Date.now(),
      status: 'generating',
      message: selectedRefs > 0
        ? 'Soul Cinema chỉ tạo ảnh từ chữ — ảnh tham chiếu đang chọn sẽ không được dùng. Đang gửi yêu cầu...'
        : 'Đang gửi yêu cầu tạo ảnh Soul Cinema...',
    })
    const res = await fetch(`${HF_PROXY}/${model}`, {
      method: 'POST',
      headers: {
        ...hfAuthHeaders(true),
        // Tài liệu khuyên gửi Idempotency-Key để gửi lại an toàn khi mạng chập chờn mà không tạo trùng
        'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) throw await readHiggsfieldError(res)

    let data = await res.json()
    requestId = data.request_id
    cancelUrl = data.cancel_url ? toHfProxy(data.cancel_url) : null
    const statusUrl = toHfProxy(data.status_url || `https://api.higgsfield.ai/requests/${requestId}/status`)

    // Hỏi trạng thái: bắt đầu 2 giây, tăng dần tới 10 giây (theo hướng dẫn Polling)
    let delay = 2000
    let serverErrors = 0
    while (!['completed', 'failed', 'nsfw', 'canceled'].includes(data.status)) {
      onHeartbeat?.({
        timestamp: Date.now(),
        status: data.status,
        message: data.status === 'queued' ? 'Đang xếp hàng trên Higgsfield...' : 'Soul Cinema đang tạo ảnh...',
      })
      await sleep(delay + Math.random() * 500, controller.signal)
      delay = Math.min(delay * 1.5, 10000)
      const st = await fetch(statusUrl, { headers: hfAuthHeaders(), signal: controller.signal })
      if (!st.ok) {
        if (st.status >= 500 && ++serverErrors < 10) continue
        throw await readHiggsfieldError(st)
      }
      serverErrors = 0
      data = await st.json()
    }
    clearTimeout(timeoutId)

    if (data.status === 'nsfw') {
      throw new Error('Higgsfield từ chối nội dung (bị kiểm duyệt NSFW). Hãy sửa lại prompt. Yêu cầu bị từ chối không bị tính phí.')
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Tạo ảnh ${data.status === 'failed' ? 'thất bại' : 'đã bị hủy'}${data.error ? `: ${data.error}` : ''}. Không bị tính phí.`)
    }

    const urls = (data.images || []).map(i => i.url).filter(Boolean)
    if (urls.length === 0) throw new Error('Higgsfield không trả về ảnh nào.')

    return {
      id: requestId,
      mediaType: 'image',
      url: urls[0],
      directUrl: urls[0],
      allImages: urls,
      prompt: prompt.trim(),
      model: 'Soul Cinema',
      ratio: payload.aspect_ratio,
      resolution: payload.resolution,
      expiresAt: data.expires_at || null,
      status: 'completed',
      createdAt: new Date().toISOString(),
      raw: data,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (isTimedOut) throw new Error(`Tạo ảnh quá ${Math.round(maxWaitMs / 60000)} phút chưa xong${requestId ? ` (request id: ${requestId})` : ''}. Thử lại sau.`)
    if (err.name === 'AbortError' || signal?.aborted) {
      // Còn xếp hàng thì hủy được (POST cancel_url); đã chạy thì Higgsfield trả 400 và vẫn tạo xong
      if (cancelUrl) {
        try { await fetch(cancelUrl, { method: 'POST', headers: hfAuthHeaders() }) } catch {}
      }
      throw new Error('Đã hủy tạo ảnh.')
    }
    if (err instanceof TypeError) throw new Error(`Không kết nối được tới máy chủ (${err.message}).`)
    throw err
  }
}

/**
 * Kiểm tra Key ID + Secret Higgsfield mà không tốn tiền: hỏi trạng thái một ID không tồn tại.
 * Key đúng → 404 (không có yêu cầu này); key sai → 401.
 */
export async function testHiggsfieldCredentials(keyId, secret) {
  if (!keyId?.trim() || !secret?.trim()) return { success: false, message: 'Nhập cả Key ID và Secret của Higgsfield.' }
  try {
    const res = await fetch(`${HF_PROXY}/requests/00000000-0000-4000-8000-000000000000/status`, {
      headers: { Authorization: `Key ${keyId.trim()}:${secret.trim()}` },
      cache: 'no-store',
    })
    if (res.status === 404) return { success: true, message: 'Higgsfield Key hợp lệ!' }
    if (res.status === 401) return { success: false, message: 'Higgsfield Key ID hoặc Secret sai.' }
    const err = await readHiggsfieldError(res)
    return { success: false, message: err.message }
  } catch (e) {
    return { success: false, message: 'Lỗi kiểm tra kết nối: ' + e.message }
  }
}

// ---------------------------------------------------------------------------
// Kiểm tra key — GET /v1/me (không tốn tiền)
// ---------------------------------------------------------------------------

export async function testApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) return { success: false, message: 'Vui lòng nhập API Key' }
  try {
    const res = await fetch(`${XIANFENG_BASE}/models`, { headers: authHeaders(apiKey), cache: 'no-store' })
    if (!res.ok) {
      const err = await readApiError(res, 'balance')
      return { success: false, message: err.message }
    }
    const list = (await res.json())?.data || []
    const sd = list.find(m => m.id === 'seedance-2.5')
    if (!sd) {
      const names = list.map(m => m.id).slice(0, 8).join(', ')
      return { success: false, message: `API Key hợp lệ nhưng chưa được dùng model seedance-2.5.${names ? ` Model key này dùng được: ${names}` : ''}` }
    }
    const price = sd.pricing?.price != null ? ` · Giá: ${sd.pricing.price} ${sd.pricing.currency || 'CNY'}/video` : ''
    return { success: true, message: `API Key hợp lệ! Dùng được seedance-2.5${price}.` }
  } catch (e) {
    return { success: false, message: 'Lỗi kiểm tra kết nối: ' + e.message }
  }
}

/**
 * Safely open media in a new tab.
 * For standard HTTP/HTTPS URLs, it uses standard browser navigation.
 * For data: or blob: URLs, it creates an inline responsive viewer tab
 * instead of navigating top frame to a 100,000+ character data URL,
 * which modern browsers (Chrome/Edge/Brave) block or fail to render.
 */
export function openMediaInNewTab(url, title = 'Xem nội dung Media') {
  if (!url) return
  // Link tương đối phải đổi thành tuyệt đối vì tab mới là about:blank
  if (url.startsWith('/')) url = window.location.origin + url

  const isHttp = url.startsWith('http://') || url.startsWith('https://')
  if (isHttp) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  // Open viewer window synchronously to prevent popup blocker
  const newTab = window.open('', '_blank')
  if (!newTab) {
    // If pop-up is completely blocked, try fallback
    window.open(url, '_blank')
    return
  }

  const isVideo = url.startsWith('data:video') || url.includes('.mp4')
  const safeTitle = (title || 'Xem nội dung Media').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const mediaHtml = isVideo
    ? `<video src="${url}" controls autoplay playsinline style="max-width:100%;max-height:88vh;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.8);outline:none;"></video>`
    : `<img id="previewImg" src="${url}" alt="${safeTitle}" style="max-width:100%;max-height:88vh;object-fit:contain;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.8);cursor:zoom-in;transition:transform 0.15s ease;" onclick="toggleZoom(this)" title="Bấm để phóng to / thu nhỏ" />`

  const downloadFilename = isVideo ? `seedance-video-${Date.now()}.mp4` : `seedance-image-${Date.now()}.png`

  newTab.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeTitle}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: #09090b;
            color: #f4f4f5;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px 16px 80px;
            overflow-x: hidden;
            overflow-y: auto;
          }
          .viewer-container {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            flex: 1;
          }
          .floating-bar {
            position: fixed;
            bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(24, 24, 27, 0.92);
            border: 1px solid rgba(63, 63, 70, 0.6);
            backdrop-filter: blur(12px);
            padding: 8px 16px;
            border-radius: 9999px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            z-index: 100;
          }
          .btn {
            background: #27272a;
            color: #f4f4f5;
            padding: 7px 16px;
            border-radius: 9999px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .btn:hover {
            background: #3f3f46;
          }
          .btn-primary {
            background: #e5ff00;
            color: #000;
            font-weight: 700;
          }
          .btn-primary:hover {
            background: #d4ee00;
          }
        </style>
        <script>
          var isZoomed = false;
          function toggleZoom(img) {
            isZoomed = !isZoomed;
            if (isZoomed) {
              img.style.maxHeight = 'none';
              img.style.maxWidth = 'none';
              img.style.cursor = 'zoom-out';
            } else {
              img.style.maxHeight = '88vh';
              img.style.maxWidth = '100%';
              img.style.cursor = 'zoom-in';
            }
          }
        </script>
      </head>
      <body>
        <div class="viewer-container">
          ${mediaHtml}
        </div>
        <div class="floating-bar">
          <a class="btn btn-primary" href="${url}" download="${downloadFilename}">⬇ Tải về</a>
          <button class="btn" onclick="window.close()">Đóng tab</button>
        </div>
      </body>
    </html>
  `)
  newTab.document.close()
}

