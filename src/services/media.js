// Tiện ích hiển thị / tải xuống cho ảnh và video đã tạo (dùng chung cho lưới và trình xem)
import { fetchVideoBlob, resolveVideoUrl, isXianfengAuthUrl } from './api.js'
import { VIDEO_MODELS, IMAGE_MODELS, IMAGE_RESOLUTIONS } from '../constants/models.js'

export const isImageItem = (item) => item?.mediaType === 'image'

/** Tỉ lệ rộng/cao từ chuỗi "16:9" */
export function ratioOf(item) {
  const [w, h] = String(item?.ratio || '').split(':').map(Number)
  return w > 0 && h > 0 ? w / h : (isImageItem(item) ? 1 : 16 / 9)
}

/**
 * Link dùng thẳng trong <img>/<video>. Trả null khi link cần key (content_url Xianfeng) mà chưa có bản tải sẵn.
 */
export function displaySrc(item, sessionBlobs = {}) {
  if (!item) return null
  if (sessionBlobs[item.id]) return sessionBlobs[item.id]
  const url = resolveVideoUrl(item.url)
  if (!url || isXianfengAuthUrl(url)) return null
  return url
}

export function findModel(item) {
  const list = isImageItem(item) ? IMAGE_MODELS : VIDEO_MODELS
  return list.find(m => m.id === item?.modelId) ||
    list.find(m => m.id === item?.model || m.name === item?.model) ||
    null
}

export function modelLabel(item) {
  return findModel(item)?.name || item?.model || '—'
}

export function qualityLabel(item) {
  if (!item?.resolution) return '—'
  if (isImageItem(item)) return IMAGE_RESOLUTIONS.find(r => r.id === item.resolution)?.label || item.resolution
  return item.resolution
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm' }

/** Tải file về máy; link bị CORS chặn thì mở tab mới để người dùng tự lưu */
export async function downloadMedia(item, { apiKey, sessionBlobs = {} } = {}) {
  let objectUrl = sessionBlobs[item.id] || null
  let created = false
  try {
    if (!objectUrl) {
      objectUrl = await fetchVideoBlob(item.url, apiKey)
      created = true
    }
    const blob = await (await fetch(objectUrl)).blob()
    const ext = EXT[blob.type] || (isImageItem(item) ? 'png' : 'mp4')
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `${isImageItem(item) ? 'image' : 'video'}-${String(item.id || Date.now()).slice(0, 24)}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (err) {
    console.warn('Tải trực tiếp thất bại, mở tab mới:', err)
    const url = resolveVideoUrl(item.url)
    if (url && !isXianfengAuthUrl(url)) window.open(url, '_blank', 'noopener')
    else throw err
  } finally {
    if (created && objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
  }
}
