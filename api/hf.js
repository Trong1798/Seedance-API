// Endpoint Vercel: /api/hf/<đường dẫn> → https://api.higgsfield.ai/<đường dẫn>
// vercel.json đổi /api/hf/:path* thành /api/hf?path=:path* trước khi gọi hàm này.
import { proxyHiggsfield } from './_higgsfield-proxy.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  await proxyHiggsfield(req, res, url.searchParams.get('path') || '')
}
