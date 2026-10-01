/**
 * Upload image to Vercel Blob Storage
 * @param {File} file - Image file to upload
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<{blobUrl: string, pathname: string}>}
 */
export async function uploadToBlob(file, signal = null) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Chỉ hỗ trợ file hình ảnh (PNG, JPG, WEBP, GIF)')
  }

  if (file.size > 100 * 1024 * 1024) {
    throw new Error('Dung lượng ảnh tối đa 100MB')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(signal.reason))
  }

  try {
    const uploadRes = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
      signal: controller.signal,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      throw new Error(err.error || `Upload thất bại (${uploadRes.status})`)
    }

    clearTimeout(timeoutId)
    const { url, pathname } = await uploadRes.json()
    return { blobUrl: url, pathname }
  } catch (err) {
    clearTimeout(timeoutId)

    if (err.name === 'AbortError' || signal?.aborted) {
      throw new Error('Upload ảnh đã bị hủy')
    }

    if (err.message.includes('Failed to fetch')) {
      throw new Error(
        'Lỗi kết nối khi upload ảnh. Kiểm tra:\n' +
        '1. Kết nối internet\n' +
        '2. Vercel deployment có đang chạy không\n' +
        '3. Xem console để biết chi tiết'
      )
    }

    throw err
  }
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
