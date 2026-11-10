// Storage management - API Key is saved ONLY in browser localStorage

export const STORAGE_KEYS = {
  API_KEY: 'seedance_api_key',
  BASE_URL: 'seedance_base_url',
  SAVED_VIDEOS: 'seedance_generated_videos',
  ACTIVE_TAB: 'seedance_active_tab',
  REFERENCE_IMAGES: 'seedance_reference_images',
  HF_KEY_ID: 'higgsfield_key_id',
  HF_KEY_SECRET: 'higgsfield_key_secret',
}

// Seedance Creation Bot API — web gọi qua lớp trung gian /api/sd (xem api/sd.js)
export const DEFAULT_BASE_URL = '/api/sd/v1'

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || ''
}

export function setApiKey(key) {
  if (!key) {
    localStorage.removeItem(STORAGE_KEYS.API_KEY)
  } else {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim())
  }
}

// Higgsfield (tạo ảnh Soul Cinema): Key ID + Secret tạo tại https://console.higgsfield.ai
export function getHiggsfieldCredentials() {
  return {
    keyId: localStorage.getItem(STORAGE_KEYS.HF_KEY_ID) || '',
    secret: localStorage.getItem(STORAGE_KEYS.HF_KEY_SECRET) || '',
  }
}

export function setHiggsfieldCredentials(keyId, secret) {
  const id = String(keyId || '').trim()
  const sec = String(secret || '').trim()
  if (id) localStorage.setItem(STORAGE_KEYS.HF_KEY_ID, id)
  else localStorage.removeItem(STORAGE_KEYS.HF_KEY_ID)
  if (sec) localStorage.setItem(STORAGE_KEYS.HF_KEY_SECRET, sec)
  else localStorage.removeItem(STORAGE_KEYS.HF_KEY_SECRET)
}

export function hasHiggsfieldCredentials() {
  const { keyId, secret } = getHiggsfieldCredentials()
  return Boolean(keyId && secret)
}

export function getBaseUrl() {
  return DEFAULT_BASE_URL
}

export function getReferenceImages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REFERENCE_IMAGES)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error('Failed to parse reference images:', e)
    return []
  }
}

export function saveReferenceImages(images) {
  try {
    localStorage.setItem(STORAGE_KEYS.REFERENCE_IMAGES, JSON.stringify(images))
  } catch (e) {
    console.error('Failed to save reference images:', e)
  }
}

// Bỏ ?key=... khỏi link trước khi lưu lịch sử; khi hiển thị, web tự gắn lại key hiện tại
function stripKey(url) {
  if (!url || typeof url !== 'string' || url.startsWith('data:') || url.startsWith('blob:')) return url
  return url.replace(/([?&])key=[^&]*(&?)/g, (_, p1, p2) => (p2 ? p1 : '')).replace(/[?&]$/, '')
}

export function getSavedVideos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_VIDEOS)
    const list = raw ? JSON.parse(raw) : []
    return list.map(v => {
      const modelStr = String(v.model || '').toLowerCase()
      const url = v.url
      const isImg = v.mediaType === 'image' ||
        /image|banana|seedream|flare|sunburst/.test(modelStr) ||
        (url && (/\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(url) || url.includes('/v1/images/') || url.startsWith('data:image')))
      return {
        ...v,
        mediaType: isImg ? 'image' : (v.mediaType || 'video'),
        url,
        directUrl: v.directUrl || url,
      }
    })
  } catch (e) {
    console.error('Failed to parse saved videos:', e)
    return []
  }
}

export function saveVideoToHistory(videoItem) {
  try {
    const list = getSavedVideos()
    // Không lưu blob: (chỉ sống trong phiên) và không lưu API key trong link
    const { blobUrl, ...persistable } = videoItem
    persistable.url = stripKey(persistable.url)
    persistable.directUrl = stripKey(persistable.directUrl)
    if (Array.isArray(persistable.allImages)) persistable.allImages = persistable.allImages.map(stripKey)
    // Giữ tối đa 500 mục: ảnh/video đã lưu lên R2 rơi khỏi lịch sử vẫn còn trong bucket (xem trên Cloudflare)
    const updated = [persistable, ...list.filter(v => v.id !== videoItem.id)].slice(0, 500)
    localStorage.setItem(STORAGE_KEYS.SAVED_VIDEOS, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.error('Failed to save video:', e)
    return []
  }
}

/** Cập nhật một mục trong lịch sử (vd. thay link nhà cung cấp bằng link R2 sau khi lưu xong) */
export function updateVideoInHistory(id, patch) {
  try {
    const list = getSavedVideos()
    const updated = list.map(v => (v.id === id ? { ...v, ...patch } : v))
    localStorage.setItem(STORAGE_KEYS.SAVED_VIDEOS, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.error('Failed to update video:', e)
    return getSavedVideos()
  }
}

export function removeVideoFromHistory(id) {
  try {
    const list = getSavedVideos()
    const updated = list.filter(v => v.id !== id)
    localStorage.setItem(STORAGE_KEYS.SAVED_VIDEOS, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.error('Failed to remove video:', e)
    return []
  }
}

