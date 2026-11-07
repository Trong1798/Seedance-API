import { getApiKey } from './storage.js'

// ============================================================================
// Seedance Creation Bot API — https://api.seedancecreationbot.online (tài liệu: /docs, /guide)
// Máy chủ không hỗ trợ CORS nên mọi request đi qua lớp trung gian của web: /api/sd/<đường dẫn>
// (api/sd.js trên Vercel, middleware trong vite.config.js khi chạy trên máy).
// ============================================================================
export const SEEDANCE_UPSTREAM = 'https://api.seedancecreationbot.online'
export const API_BASE = '/api/sd/v1'
const WALLET_HINT = 'Nạp ví trong bot Telegram của Seedance (số dư tối thiểu 20.000đ).'

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
    friendly = 'API Key sai hoặc đã bị thu hồi. Lấy khóa mới bằng lệnh /api new trong bot rồi dán vào phần Cài đặt.'
  } else if (status === 402) {
    friendly = `Số dư không đủ để ${what}. ${WALLET_HINT}`
  } else if (status === 400 || status === 422) {
    friendly = 'Dữ liệu gửi lên không hợp lệ (model, thời lượng, độ phân giải, tỉ lệ hoặc ảnh tham chiếu).'
  } else if (status === 404) {
    friendly = kind === 'status' ? 'Không tìm thấy đơn này (sai ID hoặc đã hết hạn lưu).' : 'Không tìm thấy (sai đường dẫn hoặc đơn không tồn tại).'
  } else if (status === 409) {
    friendly = 'Video chưa sẵn sàng hoặc đơn không hủy được.'
  } else if (status === 429) {
    friendly = 'Gửi quá nhanh (tối đa 120 yêu cầu/phút) hoặc đang có quá nhiều đơn chạy cùng lúc (tối đa 300). Vui lòng thử lại sau.'
  } else if (status === 499 || status === 524 || status === 504) {
    friendly = 'Kết nối bị ngắt do quá thời gian chờ. Vui lòng thử lại.'
  } else if (status >= 500) {
    friendly = 'Máy chủ Seedance đang gặp lỗi tạm thời. Đơn lỗi được tự hoàn tiền.'
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

/**
 * Đưa mọi đường dẫn file của Seedance về lớp trung gian của web:
 *  https://api.seedancecreationbot.online/v1/... → /api/sd/v1/...
 *  /v1/...                                         → /api/sd/v1/...
 */
export function resolveVideoUrl(rawUrl) {
  if (!rawUrl) return null
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return rawUrl
  if (rawUrl.startsWith(SEEDANCE_UPSTREAM)) return `/api/sd${rawUrl.slice(SEEDANCE_UPSTREAM.length)}`
  if (rawUrl.startsWith('/v1/')) return `/api/sd${rawUrl}`
  return rawUrl
}

const isProxyUrl = (url) => typeof url === 'string' && url.startsWith('/api/sd/')

/** Thêm ?key= cho link đi qua lớp trung gian (thẻ <video>/<img> không gửi được header). */
function withKey(url, apiKey) {
  const key = (apiKey || getApiKey() || '').trim()
  if (!isProxyUrl(url) || !key) return url
  const [base, qs = ''] = url.split('?')
  const params = new URLSearchParams(qs)
  params.set('key', key)
  return `${base}?${params.toString()}`
}

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
  if (/image|banana|seedream|flare|sunburst/.test(modelStr)) return true
  return isMediaImage(String(item.url || item.directUrl || ''))
}

/** Link ảnh dùng được trực tiếp trong <img> */
export function getDirectImageUrl(rawUrl, apiKey) {
  if (!rawUrl) return null
  const resolved = resolveVideoUrl(rawUrl)
  return isProxyUrl(resolved) ? withKey(resolved, apiKey) : resolved
}

/** Link video dùng được trực tiếp trong <video> */
export function getDirectVideoUrl(rawUrl, apiKey) {
  if (!rawUrl) return null
  const resolved = resolveVideoUrl(rawUrl)
  return isProxyUrl(resolved) ? withKey(resolved, apiKey) : resolved
}

/** Tải file về bộ nhớ trình duyệt (blob:) để phát/tải xuống ổn định */
export async function fetchVideoBlob(url, apiKey) {
  if (!url) throw new Error('URL không tồn tại.')
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  const resolved = resolveVideoUrl(url)
  const key = (apiKey || getApiKey() || '').trim()
  const headers = isProxyUrl(resolved) && key ? authHeaders(key) : {}
  const res = await fetch(resolved, { credentials: 'omit', headers })
  if (!res.ok) {
    const err = await readApiError(res, 'status')
    throw new Error(`Không thể tải file từ máy chủ: ${err.message}`)
  }
  return URL.createObjectURL(await res.blob())
}

// ---------------------------------------------------------------------------
// Theo dõi đơn (video & ảnh dùng chung)
// ---------------------------------------------------------------------------

const DONE = ['completed']
const FAILED = ['failed', 'cancelled', 'canceled', 'error']

/**
 * Hỏi trạng thái đơn đến khi xong: GET /v1/videos/{id} hoặc /v1/images/{id}.
 * Lỗi tạm thời (mạng, 5xx, 429) được thử lại; lỗi 5xx liên tục quá maxServerErrorMs thì dừng và báo rõ.
 */
export async function pollJob(kind, id, apiKey, { signal, onHeartbeat, intervalMs = 15000, maxServerErrorMs = 5 * 60 * 1000 } = {}) {
  const endpoint = `${API_BASE}/${kind === 'image' ? 'images' : 'videos'}/${encodeURIComponent(id)}`
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
      message: data.status === 'queued'
        ? `Đơn đang xếp hàng (ID: ${id})...`
        : `Đang tạo ${label}... ${progress != null ? `${progress}%` : ''}`,
    })

    if (DONE.includes(data.status)) return data
    if (FAILED.includes(data.status)) {
      const reason = typeof data.error === 'string' ? data.error : (data.error?.message || data.message || '')
      const refundNote = data.refunded ? 'Đã tự hoàn tiền vào ví.' : 'Đơn lỗi / bị từ chối được tự hoàn tiền vào ví.'
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

function newClientRef(prefix) {
  const rand = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '')
  return `${prefix}-${rand}`.slice(0, 64)
}

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
// Tạo video — POST /v1/videos
// ---------------------------------------------------------------------------

/**
 * Trường gửi lên (theo /docs): prompt, model ("Seedance 2.5" | "Seedance 2.0"), duration (5,8,10,12,15,30),
 * resolution (480 | 720 | 1080), ratio ("16:9" | "9:16" | "1:1"), audio, images (link https / base64), client_ref.
 * Prompt gọi ảnh bằng @Image1, @Image2... (đúng cú pháp của API này).
 */
export async function generateVideo({
  model = 'Seedance 2.5',
  prompt,
  seconds = 5,
  resolution = '720p',
  aspectRatio = '16:9',
  audio = true,
  referenceImage = null,
  referenceImages = null,
  maxReferenceImages = 30,
  pollIntervalMs = 15000,
  maxWaitMs = 2 * 60 * 60 * 1000,
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

  const payload = {
    prompt: prompt.trim(),
    model,
    duration: Number(seconds),
    resolution: parseInt(String(resolution), 10) || 720,
    ratio: aspectRatio || '16:9',
    audio: Boolean(audio),
    client_ref: newClientRef('vid'),
  }
  if (images.length > 0) payload.images = images

  const controller = new AbortController()
  let isTimedOut = false
  let orderId = null
  const timeoutId = setTimeout(() => {
    isTimedOut = true
    controller.abort('timeout')
  }, maxWaitMs)
  signal?.addEventListener('abort', () => controller.abort(signal.reason || 'User cancelled'), { once: true })

  try {
    onHeartbeat?.({ timestamp: Date.now(), message: 'Đang gửi đơn tạo video...' })
    const res = await fetch(`${API_BASE}/videos`, {
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
    orderId = data.id
    if (!orderId) throw new Error('Máy chủ không trả về ID đơn video.')
    onHeartbeat?.({
      timestamp: Date.now(),
      status: data.status,
      message: `Đã nhận đơn (ID: ${orderId}${data.price ? ` · ${Number(data.price).toLocaleString('vi-VN')}đ` : ''}). Đang chờ tạo video...`,
    })

    if (!DONE.includes(data.status)) {
      data = await pollJob('video', orderId, apiKey, { signal: controller.signal, onHeartbeat, intervalMs: pollIntervalMs })
    }
    clearTimeout(timeoutId)

    const fileUrl = resolveVideoUrl(data.download_url || `/v1/videos/${orderId}/file`)
    const directUrl = getDirectVideoUrl(fileUrl, apiKey)

    // Tải trước vào bộ nhớ để phát ổn định (máy chủ khuyên tải video về ngay khi xong)
    let blobUrl = null
    try {
      blobUrl = await fetchVideoBlob(fileUrl, apiKey)
    } catch (blobErr) {
      console.warn('Không tải trước được video (sẽ phát trực tiếp):', blobErr)
    }

    return {
      id: orderId,
      mediaType: 'video',
      url: fileUrl,
      directUrl,
      blobUrl,
      prompt: prompt.trim(),
      model,
      seconds,
      resolution: `${payload.resolution}p`,
      ratio: payload.ratio,
      price: data.price ?? null,
      faceSketched: Boolean(data.face_sketched),
      status: 'completed',
      createdAt: new Date().toISOString(),
      raw: data,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    const jobNote = orderId
      ? `\nĐơn ${orderId} vẫn chạy trên máy chủ (vẫn tính phí nếu hoàn tất). Có thể xem lại sau bằng ID này.`
      : ''
    if (isTimedOut) {
      throw new Error(`Đã chờ quá ${Math.round(maxWaitMs / 60000)} phút mà video chưa xong.${jobNote}`)
    }
    if (err.name === 'AbortError' || signal?.aborted) {
      // Đơn còn đang xếp hàng thì hủy được và tự hoàn tiền (DELETE /v1/videos/{id})
      if (orderId) {
        const cancelled = await cancelJob('video', orderId, apiKey)
        throw new Error(cancelled
          ? `Đã hủy đơn ${orderId} và hoàn tiền vào ví.`
          : `Đã dừng chờ video.${jobNote}`)
      }
      throw new Error('Đã hủy tạo video.')
    }
    if (err instanceof TypeError) {
      throw new Error(`Không kết nối được tới máy chủ (${err.message}). Kiểm tra kết nối mạng.`)
    }
    throw err
  }
}

/** Hủy đơn đang xếp hàng (chỉ khi còn queued) — tự hoàn tiền. Trả true nếu hủy được. */
export async function cancelJob(kind, id, apiKey) {
  try {
    const res = await fetch(`${API_BASE}/${kind === 'image' ? 'images' : 'videos'}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(apiKey || getApiKey()),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Tạo ảnh — POST /v1/images (xếp hàng rồi hỏi kết quả như video)
// ---------------------------------------------------------------------------

/**
 * Trường gửi lên: prompt, model (vd. "GPT Image 2.5"), n (1-4), ratio (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3),
 * images (tối đa 6 ảnh tham chiếu), client_ref.
 */
export async function generateImage({
  model = 'GPT Image 2.5',
  prompt,
  aspectRatio = null,
  n = 1,
  referenceImage = null,
  referenceImages = null,
  maxReferenceImages = 6,
  pollIntervalMs = 5000,
  maxWaitMs = 15 * 60 * 1000,
  signal = null,
  onHeartbeat = null,
}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('MISSING_API_KEY')
  if (!prompt || !prompt.trim()) throw new Error('Vui lòng nhập mô tả (prompt) cho hình ảnh!')

  const images = selectedReferenceUrls(referenceImages, referenceImage)
  if (images.length > maxReferenceImages) {
    throw new Error(`Tạo ảnh chỉ hỗ trợ tối đa ${maxReferenceImages} ảnh tham chiếu (bạn đang chọn ${images.length} ảnh).`)
  }

  const payload = { prompt: prompt.trim(), model, n, client_ref: newClientRef('img') }
  if (aspectRatio) payload.ratio = aspectRatio
  if (images.length > 0) payload.images = images

  const controller = new AbortController()
  let isTimedOut = false
  let jobId = null
  const timeoutId = setTimeout(() => { isTimedOut = true; controller.abort('timeout') }, maxWaitMs)
  signal?.addEventListener('abort', () => controller.abort(signal.reason || 'User cancelled'), { once: true })

  try {
    onHeartbeat?.({ timestamp: Date.now(), status: 'generating', message: 'Đang gửi yêu cầu tạo ảnh...' })
    const res = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: authHeaders(apiKey, true),
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const err = await readApiError(res, 'image')
      if (res.status === 400 || res.status === 422) err.message += `\nRequest đã gửi: ${summarizePayload(payload)}`
      throw err
    }

    let data = await res.json()
    jobId = data.id
    if (!jobId) throw new Error('Máy chủ không trả về ID việc tạo ảnh.')
    if (!DONE.includes(data.status)) {
      data = await pollJob('image', jobId, apiKey, { signal: controller.signal, onHeartbeat, intervalMs: pollIntervalMs })
    }
    clearTimeout(timeoutId)

    const files = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : [`/v1/images/${jobId}/file/0`]
    const fileUrl = resolveVideoUrl(files[0])

    return {
      id: jobId,
      mediaType: 'image',
      url: fileUrl,
      directUrl: getDirectImageUrl(fileUrl, apiKey),
      allImages: files.map(f => resolveVideoUrl(f)),
      prompt: prompt.trim(),
      model,
      ratio: payload.ratio || null,
      price: data.price ?? null,
      referenceImage: images[0] || null,
      status: 'completed',
      createdAt: new Date().toISOString(),
      raw: data,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (isTimedOut) throw new Error(`Tạo ảnh quá ${Math.round(maxWaitMs / 60000)} phút chưa xong${jobId ? ` (ID: ${jobId})` : ''}. Vui lòng thử lại sau.`)
    if (err.name === 'AbortError' || signal?.aborted) {
      if (jobId) await cancelJob('image', jobId, apiKey)
      throw new Error('Đã hủy tạo ảnh.')
    }
    if (err instanceof TypeError) {
      throw new Error(`Không kết nối được tới máy chủ (${err.message}). Kiểm tra kết nối mạng.`)
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Kiểm tra key — GET /v1/me (không tốn tiền)
// ---------------------------------------------------------------------------

export async function testApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) return { success: false, message: 'Vui lòng nhập API Key' }
  try {
    const res = await fetch(`${API_BASE}/me`, { headers: authHeaders(apiKey), cache: 'no-store' })
    if (!res.ok) {
      const err = await readApiError(res, 'balance')
      return { success: false, message: err.message }
    }
    const me = await res.json()
    const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
    const sandbox = me.sandbox || apiKey.trim().startsWith('sk-test-') ? ' (khóa thử — không trừ tiền)' : ''
    const low = me.can_create === false
      ? ` — Chưa tạo được đơn: số dư dưới mức tối thiểu ${fmt(me.min_balance || 20000)}đ.`
      : ''
    return {
      success: true,
      message: `API Key hợp lệ${sandbox}! Số dư: ${fmt(me.balance)}đ · Đơn đang chạy: ${me.active_orders ?? 0}${low}`,
    }
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
  // Link tương đối (vd. /api/sd/...) phải đổi thành tuyệt đối vì tab mới là about:blank
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

