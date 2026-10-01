// Storage management - API Key is saved ONLY in browser localStorage

export const STORAGE_KEYS = {
  API_KEY: 'seedance_api_key',
  BASE_URL: 'seedance_base_url',
  SAVED_VIDEOS: 'seedance_generated_videos',
  ACTIVE_TAB: 'seedance_active_tab',
}

export const DEFAULT_BASE_URL = 'https://tuansuapi.store/v1'

export const API_HOST_PRESETS = [
  { label: 'Tuan Su API (Mặc định)', url: 'https://tuansuapi.store/v1', host: 'tuansuapi.store' },
  { label: 'Xompet Gateway (Dự phòng)', url: 'https://api.xompet.io.vn/v1', host: 'api.xompet.io.vn' },
]

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

export function getBaseUrl() {
  return localStorage.getItem(STORAGE_KEYS.BASE_URL) || DEFAULT_BASE_URL
}

export function setBaseUrl(url) {
  if (!url) {
    localStorage.setItem(STORAGE_KEYS.BASE_URL, DEFAULT_BASE_URL)
  } else {
    localStorage.setItem(STORAGE_KEYS.BASE_URL, url.trim().replace(/\/$/, ''))
  }
}

export function getSavedVideos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_VIDEOS)
    const list = raw ? JSON.parse(raw) : []
    const currentBase = getBaseUrl() || DEFAULT_BASE_URL
    let host = 'https://tuansuapi.store'
    try {
      host = new URL(currentBase).origin
    } catch {}

    return list.map(v => {
      let url = v.url
      if (url) {
        if (url.startsWith('/')) {
          url = `${host}${url}`
        } else if (url.includes('localhost:') && url.includes('/v1/')) {
          url = `${host}${url.substring(url.indexOf('/v1/'))}`
        }
      }
      return { ...v, url }
    })
  } catch (e) {
    console.error('Failed to parse saved videos:', e)
    return []
  }
}

export function saveVideoToHistory(videoItem) {
  try {
    const list = getSavedVideos()
    // Do not persist transient blob URLs in localStorage
    const { blobUrl, ...persistable } = videoItem
    const currentBase = getBaseUrl() || DEFAULT_BASE_URL
    let host = 'https://tuansuapi.store'
    try {
      host = new URL(currentBase).origin
    } catch {}

    if (persistable.url && persistable.url.startsWith('/')) {
      persistable.url = `${host}${persistable.url}`
    }
    const updated = [persistable, ...list.filter(v => v.id !== videoItem.id)].slice(0, 50)
    localStorage.setItem(STORAGE_KEYS.SAVED_VIDEOS, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.error('Failed to save video:', e)
    return []
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

