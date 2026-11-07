// Endpoint Vercel: /api/sd/<đường dẫn> → https://api.seedancecreationbot.online/<đường dẫn>
// vercel.json đổi /api/sd/:path* thành /api/sd?path=:path* trước khi gọi hàm này.
import { proxySeedance } from './_seedance-proxy.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.searchParams.get('path') || ''
  await proxySeedance(req, res, path, url.searchParams)
}
