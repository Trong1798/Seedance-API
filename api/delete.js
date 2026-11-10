// Xóa file: link thuộc R2 (R2_PUBLIC_URL) thì xóa trên R2, còn lại coi là file Vercel Blob cũ.
import { del } from '@vercel/blob'
import { getR2Config, keyFromPublicUrl, deleteObject } from './_r2.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { url } = body
    if (!url) return res.status(400).json({ error: 'URL is required' })

    const cfg = getR2Config()
    const r2Key = keyFromPublicUrl(cfg, url)
    if (r2Key) {
      await deleteObject(cfg, r2Key)
    } else if (/^https:\/\/[^/]+\.r2\.dev\//.test(url)) {
      return res.status(503).json({ error: 'Chưa cài biến R2_* nên không xóa được file trên R2' })
    } else {
      await del(url)
    }
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return res.status(500).json({ error: error.message })
  }
}
