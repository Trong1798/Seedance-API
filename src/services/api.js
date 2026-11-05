import { getApiKey, getBaseUrl } from './storage.js'

const PORTAL_URL = 'https://tuansuapi.store/portal'

/**
 * Lấy chuỗi thông báo từ trường `error` của Gateway.
 * Định dạng chuẩn: { error: { type, code, message, request_id } } — nhưng có thể là string.
 */
export function extractServerError(errField) {
  if (!errField) return { message: '', code: '', requestId: '' }
  if (typeof errField === 'string') return { message: errField, code: '', requestId: '' }
  return {
    message: errField.message || '',
    code: errField.code || errField.type || '',
    requestId: errField.request_id || '',
  }
}

function isBalanceError(text) {
  return /insufficient|balance|credit|quota|số dư|so du/i.test(text || '')
}

/**
 * Chuyển mã HTTP + thông báo của Gateway thành lỗi tiếng Việt dễ hiểu,
 * luôn giữ lại mã HTTP, mã lỗi, request_id và thông điệp gốc để tiện báo hỗ trợ.
 * kind: 'video' | 'image' | 'status' | 'balance'
 */
export function describeApiError(status, { message = '', code = '', requestId = '' } = {}, kind = 'video') {
  const what = kind === 'image' ? 'tạo ảnh' : 'tạo video'
  let friendly

  if (status === 402 || isBalanceError(message) || isBalanceError(code)) {
    friendly = `Số dư không đủ để ${what}. Vui lòng nạp thêm tại ${PORTAL_URL}`
  } else if (status === 401) {
    friendly = 'API Key sai, hết hạn hoặc không hoạt động. Vui lòng kiểm tra lại trong phần Cài đặt.'
  } else if (status === 403) {
    friendly = 'API Key đã bị khóa hoặc chưa được cấp quyền dùng model này.'
  } else if (status === 404) {
    friendly = /model/i.test(code + message)
      ? 'Model không tồn tại hoặc chưa được cấp cho API Key này (kiểm tra danh sách model qua GET /v1/models).'
      : kind === 'status'
      ? 'Không tìm thấy task video (ID không tồn tại hoặc đã bị hủy).'
      : 'Không tìm thấy endpoint/model trên Gateway. Kiểm tra lại Base URL và tên model.'
  } else if (status === 400 || status === 422) {
    friendly = 'Yêu cầu không hợp lệ (sai tham số, sai tên model hoặc ảnh tham chiếu không đọc được).'
  } else if (status === 409) {
    friendly = 'API Key này không dùng số dư tiền (409).'
  } else if (status === 413) {
    friendly = 'Dữ liệu gửi lên quá lớn. Mỗi ảnh tham chiếu nên dưới 10MB.'
  } else if (status === 429) {
    friendly = 'Bạn gửi quá nhiều yêu cầu hoặc hệ thống đang quá tải. Vui lòng thử lại sau giây lát.'
  } else if (status === 499 || status === 524) {
    friendly = 'Kết nối bị ngắt do quá thời gian chờ (Cloudflare timeout). Vui lòng thử lại.'
  } else if (status === 503) {
    friendly = 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.'
  } else if (status >= 500) {
    friendly = 'Máy chủ Gateway gặp lỗi. Job thất bại do lỗi hệ thống sẽ không bị trừ tiền.'
  } else {
    friendly = message || `Lỗi không xác định khi ${what}.`
  }

  const meta = [status ? `HTTP ${status}` : '', code, requestId ? `request_id: ${requestId}` : '']
    .filter(Boolean)
    .join(' · ')
  const detail = message && message !== friendly ? `\nChi tiết từ máy chủ: ${message}` : ''
  return `${friendly}${meta ? ` (${meta})` : ''}${detail}`
}

/**
 * Đọc body lỗi của Response (chỉ đọc 1 lần) và trả về Error đã được diễn giải.
 */
export async function readApiError(res, kind = 'video') {
  let text = ''
  try {
    text = await res.text()
  } catch {}
  let info = { message: '', code: '', requestId: '' }
  try {
    const json = JSON.parse(text)
    info = extractServerError(json.error)
    if (!info.message && json.message) info.message = json.message
  } catch {
    info.message = text.trim().slice(0, 300)
  }
  const err = new Error(describeApiError(res.status, info, kind))
  err.status = res.status
  err.code = info.code
  return err
}

/**
 * Resolves raw URLs, relative paths or localhost rewrites to absolute Gateway URLs.
 */
export function resolveVideoUrl(rawUrl, baseUrl = 'https://tuansuapi.store/v1') {
  if (!rawUrl) return null

  // If accidentally formatted as localhost URL pointing to /v1/
  if (rawUrl.includes('localhost:') && rawUrl.includes('/v1/')) {
    const pathPart = rawUrl.substring(rawUrl.indexOf('/v1/'))
    const cleanBase = (baseUrl || 'https://tuansuapi.store/v1').replace(/\/+$/, '')
    let origin = 'https://tuansuapi.store'
    try {
      origin = new URL(cleanBase).origin
    } catch {}
    return `${origin}${pathPart}`
  }

  if (
    rawUrl.startsWith('blob:') ||
    rawUrl.startsWith('data:') ||
    rawUrl.startsWith('http://') ||
    rawUrl.startsWith('https://')
  ) {
    return rawUrl
  }

  try {
    const cleanBase = (baseUrl || 'https://tuansuapi.store/v1').replace(/\/+$/, '')
    const baseObj = new URL(cleanBase)
    return new URL(rawUrl, baseObj.origin).href
  } catch {
    const cleanBase = (baseUrl || 'https://tuansuapi.store/v1').replace(/\/+$/, '')
    const cleanRaw = rawUrl.replace(/^\/+/, '')
    return `${cleanBase}/${cleanRaw}`
  }
}

/**
 * Detects whether an item or URL represents an image
 */
export function isMediaImage(item) {
  if (!item) return false
  if (typeof item === 'string') {
    return (
      item.startsWith('data:image') ||
      /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(item) ||
      item.includes('/images/') ||
      item.includes('img.apimatou.cc')
    )
  }
  if (item.mediaType === 'image') return true
  if (item.mediaType === 'video') return false
  const modelStr = String(item.model || '').toLowerCase()
  if (
    modelStr.includes('image') ||
    modelStr.includes('banana') ||
    modelStr.includes('flare') ||
    modelStr.includes('sunburst')
  ) {
    return true
  }
  const url = String(item.url || item.directUrl || '')
  return isMediaImage(url)
}

/**
 * Generates direct image URL without query tampering
 * Strips any unintended query parameters (like key or variant) that cause 400/403 on image CDNs
 */
export function getDirectImageUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
    return rawUrl
  }
  const resolved = resolveVideoUrl(rawUrl, baseUrl || getBaseUrl())
  try {
    const u = new URL(resolved)
    u.searchParams.delete('key')
    u.searchParams.delete('variant')
    return u.href
  } catch {
    return resolved
      .replace(/[?&]key=[^&]+/g, '')
      .replace(/[?&]variant=[^&]+/g, '')
      .replace(/\?$/, '')
  }
}

/**
 * Generates direct streaming URL with authentication query parameter (&key=...)
 * As recommended by provider documentation for browser playback and downloads.
 */
export function getDirectVideoUrl(rawUrl, apiKey, baseUrl) {
  if (!rawUrl) return null
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
    return rawUrl
  }

  const effectiveKey = apiKey || getApiKey()
  const resolved = resolveVideoUrl(rawUrl, baseUrl || getBaseUrl())

  try {
    const u = new URL(resolved)
    if (u.pathname.endsWith('/content') && !u.searchParams.has('variant')) {
      u.searchParams.set('variant', 'video')
    }
    if (effectiveKey && !u.searchParams.has('key') && (u.pathname.includes('/content') || u.hostname.includes('tuansuapi.store'))) {
      u.searchParams.set('key', effectiveKey.trim())
    }
    return u.href
  } catch {
    const sep = resolved.includes('?') ? '&' : '?'
    const keyParam = effectiveKey ? `key=${encodeURIComponent(effectiveKey.trim())}` : ''
    const variantParam = !resolved.includes('variant=') ? 'variant=video' : ''
    const params = [variantParam, keyParam].filter(Boolean).join('&')
    return params ? `${resolved}${sep}${params}` : resolved
  }
}

/**
 * Fetch video/image content as Blob URL for local memory caching
 */
export async function fetchVideoBlob(url, apiKey, baseUrl) {
  if (!url) throw new Error('URL không tồn tại.')
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url
  }

  const effectiveKey = apiKey || getApiKey()
  const rawBase = baseUrl || getBaseUrl() || 'https://tuansuapi.store/v1'
  const isImageFile = /\.(png|jpe?g|webp|gif)($|\?)/i.test(url) || url.includes('/images/') || url.includes('img.apimatou.cc')

  let cleanUrl = isImageFile ? getDirectImageUrl(url, rawBase) : getDirectVideoUrl(url, effectiveKey, rawBase)
  const headers = {}

  let isGatewayDomain = false
  try {
    const targetHost = new URL(cleanUrl).hostname
    const baseHost = new URL(rawBase).hostname
    isGatewayDomain = targetHost === baseHost || targetHost.includes('tuansuapi.store')
  } catch {}

  // Only pass Authorization header to Gateway domain, not external image CDNs (which would trigger CORS errors)
  if (effectiveKey && isGatewayDomain) {
    headers['Authorization'] = `Bearer ${effectiveKey.trim()}`
  }

  const res = await fetch(cleanUrl, { credentials: 'omit', headers })
  if (!res.ok) {
    let errMsg = `Mã HTTP: ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson?.error?.message) {
        errMsg = errJson.error.message
      }
    } catch {
      // not JSON
    }
    throw new Error(`Không thể nạp file từ máy chủ (${errMsg})`)
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * Poll task status if server responds asynchronously (status: queued / processing)
 * Following provider workflow: GET /v1/videos/{video_id} every 5s until completed
 */
export async function pollVideoStatus(videoId, apiKey, baseUrl, { signal, onHeartbeat } = {}) {
  const cleanBase = (baseUrl || getBaseUrl() || 'https://tuansuapi.store/v1').replace(/\/+$/, '')
  const endpoint = `${cleanBase}/videos/${videoId}`

  while (true) {
    if (signal?.aborted) {
      throw new Error('Quá trình tạo video đã bị hủy.')
    }

    let res
    try {
      res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        signal,
      })
    } catch (netErr) {
      if (signal?.aborted) throw netErr
      // Network hiccup, wait and retry
      await new Promise(r => setTimeout(r, 4000))
      continue
    }

    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) {
        await new Promise(r => setTimeout(r, 5000))
        continue
      }
      const err = await readApiError(res, 'status')
      err.message = `Lỗi kiểm tra trạng thái video (ID: ${videoId}): ${err.message}`
      throw err
    }

    const data = await res.json()
    if (onHeartbeat) {
      onHeartbeat({
        timestamp: Date.now(),
        status: data.status,
        progress: data.progress,
        message: ['processing', 'in_progress'].includes(data.status) 
          ? `Đang render video... ${data.progress ? data.progress + '%' : ''}`
          : `Trạng thái: ${data.status || 'Đang xử lý'}`,
      })
    }

    if (data.status === 'completed' || data.status === 'succeeded' || data.url || data.video_url) {
      return data
    }

    if (['failed', 'error', 'cancelled', 'canceled'].includes(data.status)) {
      const info = extractServerError(data.error)
      const reason = info.message || data.message || 'Quá trình render video thất bại trên máy chủ.'
      const meta = [info.code, info.requestId ? `request_id: ${info.requestId}` : ''].filter(Boolean).join(' · ')
      throw new Error(
        `Render video thất bại (ID: ${videoId}${meta ? ` · ${meta}` : ''}): ${reason}\n` +
        'Job thất bại do lỗi hệ thống sẽ không bị trừ tiền.'
      )
    }

    // Wait 5 seconds before next polling request per provider recommendation
    await new Promise(r => setTimeout(r, 5000))
  }
}

/**
 * Generate video with Seedance 2.5 or other models via POST /v1/videos
 */
export async function generateVideo({
  model = 'seedance_2.5',
  prompt,
  seconds = 10,
  size = '1280x720',
  referenceImage = null,
  referenceImages = null,
  resolution = null,
  maxReferenceImages = 10,
  signal = null,
  onHeartbeat = null,
}) {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('MISSING_API_KEY')
  }

  if (!prompt || !prompt.trim()) {
    throw new Error('Vui lòng nhập mô tả (prompt) cho video!')
  }

  const selectedRefCount = Array.isArray(referenceImages) ? referenceImages.filter(i => i.selected).length : 0
  if (selectedRefCount > maxReferenceImages) {
    throw new Error(`Model ${model} chỉ hỗ trợ tối đa ${maxReferenceImages} ảnh tham chiếu (bạn đang chọn ${selectedRefCount} ảnh).`)
  }

  const rawBaseUrl = getBaseUrl() || 'https://tuansuapi.store/v1'
  const cleanBase = rawBaseUrl.replace(/\/+$/, '')
  
  // Endpoint direct call (tuansuapi.store supports full CORS with access-control-allow-origin: *)
  let endpoint = `${cleanBase}/videos`

  const payload = {
    model,
    prompt: prompt.trim(),
    seconds: Number(seconds),
    size,
  }

  // Theo tài liệu: resolution "1080p" (upscale Full HD) chỉ hỗ trợ trên Veo-3.1
  if (resolution === '1080p') {
    payload.resolution = '1080p'
  }

  if (referenceImages && referenceImages.length > 0) {
    const selectedImages = referenceImages.filter(i => i.selected)
    if (selectedImages.length > 0) {
      if (selectedImages.length === 1) {
        payload.input_reference = { image_url: selectedImages[0].url }
      } else {
        payload.input_reference = selectedImages.map(img => ({ image_url: img.url }))
      }
    }
  } else if (typeof referenceImage === 'string' && referenceImage.trim()) {
    payload.input_reference = { image_url: referenceImage.trim() }
  }

  // 900s (15 mins) total timeout for video generation as specified in documentation
  const controller = new AbortController()
  let isTimedOut = false
  const timeoutId = setTimeout(() => {
    isTimedOut = true
    controller.abort('Request timed out after 900 seconds')
  }, 900000)

  if (signal) {
    signal.addEventListener('abort', () => {
      controller.abort(signal.reason || 'User cancelled')
    })
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      clearTimeout(timeoutId)
      throw await readApiError(res, 'video')
    }

    // Stream reader to capture keepalive \n pulses and ensure the connection doesn't silently freeze
    let rawText = ''
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          rawText += chunk
          if (onHeartbeat) {
            onHeartbeat({
              timestamp: Date.now(),
              chunkLength: chunk.length,
              totalLength: rawText.length,
            })
          }
        }
      } finally {
        reader.releaseLock()
      }
    } else {
      rawText = await res.text()
    }

    clearTimeout(timeoutId)

    // Extract JSON payload safely past any keepalive \n pings
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Không nhận được dữ liệu JSON hợp lệ từ máy chủ. Phản hồi nhận được: ' + (rawText.trim() || '(Rỗng)'))
    }

    let data
    try {
      data = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      throw new Error('Lỗi giải mã JSON từ máy chủ: ' + parseErr.message)
    }

    if (data.error) {
      throw new Error(describeApiError(0, extractServerError(data.error), 'video'))
    }

    // If server queued or is processing the video, automatically poll until completed
    if (['processing', 'queued', 'in_progress', 'pending', 'starting'].includes(data.status) && data.id) {
      if (onHeartbeat) {
        onHeartbeat({
          timestamp: Date.now(),
          status: data.status,
          message: `Nhiệm vụ đã được xếp hàng (ID: ${data.id}). Đang chờ GPU render...`,
        })
      }
      data = await pollVideoStatus(data.id, apiKey, cleanBase, {
        signal: controller.signal,
        onHeartbeat,
      })
    }

    const rawVideoUrl = data.url || data.video_url || data.data?.[0]?.url || (data.id ? `/v1/videos/${data.id}/content?variant=video` : null)

    if (!rawVideoUrl) {
      throw new Error(data.message || 'Không tìm thấy liên kết video sau khi render.')
    }

    const videoUrl = resolveVideoUrl(rawVideoUrl, cleanBase)
    const directUrl = getDirectVideoUrl(videoUrl, apiKey, cleanBase)

    // Preload video blob safely using direct authenticated url & Bearer token
    let blobUrl = null
    try {
      blobUrl = await fetchVideoBlob(directUrl, apiKey, cleanBase)
    } catch (blobErr) {
      console.warn('Không thể nạp trước blob URL (sẽ dùng direct streaming):', blobErr)
    }

    return {
      id: data.id || `vid_${Date.now()}`,
      url: videoUrl,
      directUrl,
      blobUrl,
      prompt: prompt.trim(),
      model,
      seconds,
      size,
      status: 'completed',
      createdAt: new Date().toISOString(),
      raw: data,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (isTimedOut) {
      throw new Error('Quá trình tạo video đã vượt quá thời gian tối đa (15 phút). Máy chủ GPU có thể đang quá tải.')
    }
    if (err.name === 'AbortError' || signal?.aborted) {
      throw new Error('Quá trình tạo video đã được hủy theo yêu cầu.')
    }
    if (err instanceof TypeError) {
      throw new Error(`Không kết nối được tới Gateway (${err.message}). Kiểm tra mạng hoặc Base URL trong Cài đặt.`)
    }
    throw err
  }
}

/**
 * Generate image via POST /v1/images/generations (or /v1/images/edits if reference image provided)
 */
export async function generateImage({
  model = 'gpt-image-2',
  prompt,
  size = '1024x1024',
  referenceImage = null,
  referenceImages = null,
  signal = null,
  onHeartbeat = null,
}) {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('MISSING_API_KEY')
  }

  if (!prompt || !prompt.trim()) {
    throw new Error('Vui lòng nhập mô tả (prompt) cho hình ảnh!')
  }

  const rawBaseUrl = getBaseUrl() || 'https://tuansuapi.store/v1'
  const cleanBase = rawBaseUrl.replace(/\/+$/, '')

  const imageList = Array.isArray(referenceImages) && referenceImages.length > 0
    ? referenceImages.filter(i => i.selected).map(img => (typeof img === 'string' ? img : img.url)?.trim()).filter(Boolean)
    : (referenceImage && referenceImage.trim() ? [referenceImage.trim()] : [])

  const hasReference = imageList.length > 0
  const endpoint = hasReference ? `${cleanBase}/images/edits` : `${cleanBase}/images/generations`

  const payload = {
    model,
    prompt: prompt.trim(),
    n: 1,
    size,
    response_format: 'url',
  }

  if (hasReference) {
    payload.image = imageList.length > 1 ? imageList : imageList[0]
  }

  if (onHeartbeat) {
    onHeartbeat({
      timestamp: Date.now(),
      status: 'generating',
      message: 'Đang kết nối tới mô hình AI tạo ảnh...',
    })
  }

  const controller = new AbortController()
  let isTimedOut = false
  const timeoutId = setTimeout(() => {
    isTimedOut = true
    controller.abort('Request timed out after 180 seconds')
  }, 180000)

  if (signal) {
    signal.addEventListener('abort', () => {
      controller.abort(signal.reason || 'User cancelled')
    })
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      throw await readApiError(res, 'image')
    }

    const data = await res.json()
    if (data.error) {
      throw new Error(describeApiError(0, extractServerError(data.error), 'image'))
    }

    let imageUrl = null
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const item = data.data[0]
      if (item.url) {
        imageUrl = item.url
      } else if (item.b64_json) {
        imageUrl = item.b64_json.startsWith('data:') ? item.b64_json : `data:image/png;base64,${item.b64_json}`
      }
    } else if (data.url) {
      imageUrl = data.url
    }

    if (!imageUrl) {
      throw new Error('Không nhận được liên kết ảnh từ máy chủ.')
    }

    const resolvedUrl = resolveVideoUrl(imageUrl, cleanBase)
    const directUrl = getDirectImageUrl(resolvedUrl, cleanBase)

    return {
      id: `img_${Date.now()}`,
      mediaType: 'image',
      url: resolvedUrl,
      directUrl: directUrl || resolvedUrl,
      prompt: prompt.trim(),
      model,
      size,
      referenceImage: hasReference ? referenceImage : null,
      status: 'completed',
      createdAt: new Date().toISOString(),
      raw: data,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (isTimedOut) {
      throw new Error('Tạo ảnh quá 180 giây chưa có phản hồi (timeout). Máy chủ có thể đang quá tải, vui lòng thử lại.')
    }
    if (err.name === 'AbortError' || signal?.aborted) {
      throw new Error('Quá trình tạo ảnh đã được hủy theo yêu cầu.')
    }
    if (err instanceof TypeError) {
      throw new Error(`Không kết nối được tới Gateway (${err.message}). Kiểm tra mạng hoặc Base URL trong Cài đặt.`)
    }
    throw err
  }
}


/**
 * Kiểm tra API Key bằng GET /v1/balance (chỉ đọc, KHÔNG trừ tiền — theo tài liệu).
 * Trả về kèm số dư khả dụng nếu có.
 */
export async function testApiKey(apiKey, customBaseUrl) {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'Vui lòng nhập API Key' }
  }

  const rawBaseUrl = customBaseUrl || getBaseUrl() || 'https://tuansuapi.store/v1'
  const cleanBase = rawBaseUrl.replace(/\/+$/, '')
  const headers = { 'Authorization': `Bearer ${apiKey.trim()}` }

  try {
    const res = await fetch(`${cleanBase}/balance`, { method: 'GET', headers, cache: 'no-store' })

    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data.unlimited) {
        return { success: true, message: 'API Key hợp lệ! Số dư: không giới hạn.' }
      }
      const fmt = (n) => Number(n).toLocaleString('vi-VN')
      if (data.available_vnd != null) {
        const reserved = data.reserved_vnd ? ` (đang giữ chỗ ${fmt(data.reserved_vnd)}đ)` : ''
        const low = data.available_vnd < 2000 ? ' — Số dư thấp, có thể không đủ tạo video.' : ''
        return { success: true, message: `API Key hợp lệ! Số dư khả dụng: ${fmt(data.available_vnd)}đ${reserved}${low}` }
      }
      return { success: true, message: 'API Key hợp lệ!' }
    }

    if (res.status === 409) {
      return { success: true, message: 'API Key hợp lệ! (Key này không dùng số dư tiền nên không hiển thị số dư.)' }
    }

    // Base URL khác (vd: cổng Tunnel 2) có thể không có /balance → thử GET /models (cũng miễn phí)
    if (res.status === 404 || res.status === 405) {
      const modelsRes = await fetch(`${cleanBase}/models`, { method: 'GET', headers })
      if (modelsRes.ok) {
        return { success: true, message: 'API Key hợp lệ! (Base URL này không hỗ trợ xem số dư.)' }
      }
      const err = await readApiError(modelsRes, 'balance')
      return { success: false, message: err.message }
    }

    const err = await readApiError(res, 'balance')
    return { success: false, message: err.message }
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

