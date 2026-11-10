// Lớp trung gian tới Higgsfield API (https://api.higgsfield.ai).
// Higgsfield không cho trình duyệt gọi thẳng (CORS bị chặn) và tài liệu khuyên giữ secret phía máy chủ.
// Web gọi /api/hf/<đường dẫn>; hàm này chuyển tiếp request kèm header Authorization ("Key id:secret")
// do người dùng nhập trong Cài đặt, không lưu lại ở đâu.
//
// File bắt đầu bằng "_" nên Vercel không coi là một endpoint; được dùng bởi api/hf.js và vite.config.js.

import { Readable } from 'node:stream'

export const HIGGSFIELD_UPSTREAM = 'https://api.higgsfield.ai'

// Chỉ cho phép các đường dẫn web cần dùng (tránh thành proxy mở):
//  POST higgsfield-ai/soul/cinema          tạo ảnh Soul Cinema
//  GET  requests/{uuid}/status             xem trạng thái
//  POST requests/{uuid}/cancel             hủy khi còn xếp hàng
const UUID = '[0-9a-fA-F-]{36}'
const ALLOWED = [
  { method: 'POST', re: /^higgsfield-ai\/soul\/cinema$/ },
  { method: 'GET', re: new RegExp(`^requests/${UUID}/status$`) },
  { method: 'POST', re: new RegExp(`^requests/${UUID}/cancel$`) },
]

const PASS_RESPONSE_HEADERS = ['content-type', 'retry-after', 'x-correlation-id']

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function sendJson(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} path  đường dẫn phía sau /api/hf/, vd. "requests/<uuid>/status"
 */
export async function proxyHiggsfield(req, res, path) {
  const cleanPath = String(path || '').replace(/^\/+/, '')
  const method = (req.method || 'GET').toUpperCase()
  if (!ALLOWED.some(r => r.method === method && r.re.test(cleanPath))) {
    sendJson(res, 404, { detail: `Đường dẫn không được hỗ trợ: ${method} /${cleanPath}` })
    return
  }
  if (!req.headers['authorization']) {
    sendJson(res, 401, { detail: 'Thiếu Higgsfield API Key (Key ID và Secret) trong phần Cài đặt.' })
    return
  }

  const headers = { Authorization: req.headers['authorization'] }
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']
  if (req.headers['idempotency-key']) headers['Idempotency-Key'] = req.headers['idempotency-key']

  let body
  if (method !== 'GET') {
    body = req.body !== undefined && !(req.body && typeof req.body.on === 'function')
      ? (typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body))
      : await readBody(req)
  }

  let upstream
  try {
    upstream = await fetch(`${HIGGSFIELD_UPSTREAM}/${cleanPath}`, { method, headers, body })
  } catch (err) {
    sendJson(res, 502, { detail: `Không kết nối được máy chủ Higgsfield: ${err.message}` })
    return
  }

  res.statusCode = upstream.status
  for (const h of PASS_RESPONSE_HEADERS) {
    const v = upstream.headers.get(h)
    if (v) res.setHeader(h, v)
  }
  res.setHeader('Cache-Control', 'no-store')
  if (!upstream.body) {
    res.end()
    return
  }
  Readable.fromWeb(upstream.body).pipe(res)
}
