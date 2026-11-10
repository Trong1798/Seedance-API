// POST /api/r2?action=sign   body {filename, contentType, folder} → {uploadUrl, url, key}
// POST /api/r2?action=mirror body {url, folder}                   → {url, key}
// Khi chưa cài biến R2_* thì trả 503 {error:'r2_not_configured'} để web quay về Vercel Blob.
import { getR2Config, makeObjectKey, presignPut, publicUrlFor, mirrorToR2 } from './_r2.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const cfg = getR2Config()
  if (!cfg) return res.status(503).json({ error: 'r2_not_configured', message: 'Chưa cài biến môi trường R2_* trên máy chủ.' })

  const action = req.query.action
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})

  try {
    if (action === 'sign') {
      const contentType = String(body.contentType || '')
      if (!/^(image|video)\/[a-z0-9.+-]+$/i.test(contentType)) {
        return res.status(400).json({ error: 'Chỉ cho phép upload ảnh hoặc video' })
      }
      const key = makeObjectKey(body.folder, body.filename)
      const uploadUrl = await presignPut(cfg, key, contentType)
      return res.status(200).json({ uploadUrl, url: publicUrlFor(cfg, key), key })
    }

    if (action === 'mirror') {
      if (!body.url) return res.status(400).json({ error: 'Thiếu link file' })
      const result = await mirrorToR2(cfg, body.url, body.folder)
      return res.status(200).json(result)
    }

    return res.status(404).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('R2 error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Lỗi R2' })
  }
}
