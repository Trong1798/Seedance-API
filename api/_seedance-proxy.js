// Lớp trung gian tới Seedance Creation Bot API (https://api.seedancecreationbot.online).
// Máy chủ đó không hỗ trợ CORS nên trình duyệt không gọi thẳng được; web gọi /api/sd/<đường dẫn>,
// hàm này chuyển tiếp request (kèm API key của người dùng) và trả nguyên phản hồi về.
//
// File bắt đầu bằng "_" nên Vercel không coi là một endpoint; được dùng bởi api/sd.js và vite.config.js.

import { Readable } from 'node:stream'

export const SEEDANCE_UPSTREAM = 'https://api.seedancecreationbot.online'

// Chỉ cho phép chuyển tiếp các đường dẫn của API này (tránh thành proxy mở)
const ALLOWED_PATH = /^(healthz|v1\/(me|prices|models|videos|images)(\/[A-Za-z0-9_.\-/]*)?)$/

const PASS_RESPONSE_HEADERS = ['content-type', 'content-length', 'content-disposition', 'cache-control', 'accept-ranges', 'content-range', 'last-modified', 'etag']

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} path  đường dẫn phía sau /api/sd/, vd. "v1/videos/ord_123/file"
 * @param {URLSearchParams} query  query string gốc (key=... sẽ được đổi thành header Authorization)
 */
export async function proxySeedance(req, res, path, query) {
  const cleanPath = String(path || '').replace(/^\/+/, '')
  if (!ALLOWED_PATH.test(cleanPath)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'not_found', message: `Đường dẫn không được hỗ trợ: /${cleanPath}` }))
    return
  }

  const params = new URLSearchParams(query)
  // Thẻ <video>/<img> không gửi được header → cho phép truyền key qua ?key= (chỉ tới proxy của chính web này)
  const keyFromQuery = params.get('key')
  params.delete('key')
  params.delete('path')

  const headers = {}
  const auth = req.headers['authorization'] || (keyFromQuery ? `Bearer ${keyFromQuery}` : null)
  if (auth) headers['Authorization'] = auth
  if (req.headers['x-api-key']) headers['X-API-Key'] = req.headers['x-api-key']
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']
  if (req.headers['range']) headers['Range'] = req.headers['range']

  const method = (req.method || 'GET').toUpperCase()
  let body
  if (!['GET', 'HEAD'].includes(method)) {
    body = req.body !== undefined && !(req.body && typeof req.body.on === 'function')
      ? (typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body))
      : await readBody(req)
  }

  const qs = params.toString()
  const target = `${SEEDANCE_UPSTREAM}/${cleanPath}${qs ? `?${qs}` : ''}`

  let upstream
  try {
    upstream = await fetch(target, { method, headers, body, redirect: 'follow' })
  } catch (err) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'upstream_unreachable', message: `Không kết nối được máy chủ Seedance: ${err.message}` }))
    return
  }

  res.statusCode = upstream.status
  for (const h of PASS_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h)
    if (v) res.setHeader(h, v)
  }
  if (!upstream.headers.get('cache-control')) res.setHeader('Cache-Control', 'no-store')

  if (!upstream.body || method === 'HEAD') {
    res.end()
    return
  }
  // Truyền thẳng dữ liệu (video MP4 có thể lớn) thay vì đọc hết vào bộ nhớ
  Readable.fromWeb(upstream.body).pipe(res)
}
