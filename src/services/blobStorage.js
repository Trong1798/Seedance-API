const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

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

/**
 * Upload image to Vercel Blob Storage
 * @param {File} file - Image file to upload
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<{blobUrl: string, pathname: string}>}
 */
export function uploadToBlob(file, onProgress = null, signal = null) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Chỉ hỗ trợ file hình ảnh (PNG, JPG, WEBP, GIF)'))
  }

  if (file.size > 100 * 1024 * 1024) {
    return Promise.reject(new Error('Dung lượng ảnh tối đa 100MB'))
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
        reject(new Error('Upload ảnh đã bị hủy'))
      })
    }

    const timeoutId = setTimeout(() => {
      xhr.abort()
      reject(new Error('Upload timeout'))
    }, 120000)

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        onProgress(percentComplete)
      }
    })

    xhr.addEventListener('load', () => {
      clearTimeout(timeoutId)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve({ blobUrl: response.url, pathname: response.pathname })
        } catch (e) {
          reject(new Error('Lỗi xử lý phản hồi từ server'))
        }
      } else {
        let errorMessage = `Upload thất bại (${xhr.status})`
        try {
          const errRes = JSON.parse(xhr.responseText)
          if (errRes.error) errorMessage = errRes.error
        } catch (e) {}
        reject(new Error(errorMessage))
      }
    })

    xhr.addEventListener('error', () => {
      clearTimeout(timeoutId)
      reject(new Error(
        'Lỗi kết nối khi upload ảnh. Kiểm tra:\n' +
        '1. Kết nối internet\n' +
        '2. Vercel deployment có đang chạy không\n' +
        '3. Xem console để biết chi tiết'
      ))
    })

    xhr.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      reject(new Error('Upload ảnh đã bị hủy'))
    })

    // Tên file trên Blob chỉ dùng ký tự ASCII (bỏ dấu tiếng Việt, khoảng trắng) để link ảnh
    // gửi cho máy chủ AI không chứa ký tự mã hóa %XX; tên gốc vẫn được giữ để hiển thị.
    xhr.open('POST', `/api/upload?filename=${encodeURIComponent(toSafeBlobFilename(file))}`, true)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.send(file)
  })
}

/**
 * Delete image from Vercel Blob Storage
 * @param {string} pathname - Pathname of the blob
 * @returns {Promise<boolean>}
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
    throw new Error(err.error || 'Không thể xóa ảnh')
  }

  return true
}
