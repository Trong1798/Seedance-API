import { del } from '@vercel/blob'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { url } = req.body
      if (!url) {
        return res.status(400).json({ error: 'URL is required' })
      }
      await del(url)
      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Delete error:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}
