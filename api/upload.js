import { put } from '@vercel/blob'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const filename = req.query.filename || 'image.png'
      const blob = await put(filename, req, {
        access: 'public',
        addRandomSuffix: true,
      })
      return res.status(200).json({ url: blob.url, pathname: blob.pathname })
    } catch (error) {
      console.error('Upload error:', error)
      return res.status(500).json({ error: error.message })
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}
