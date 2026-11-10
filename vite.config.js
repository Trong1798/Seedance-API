import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { put } from '@vercel/blob'
import { proxyHiggsfield } from './api/_higgsfield-proxy.js'
import r2Handler from './api/r2.js'
import deleteHandler from './api/delete.js'

// Chạy hàm kiểu Vercel (req.query, req.body, res.status().json()) trong máy chủ dev của Vite
async function runVercelHandler(handler, req, res, parsedUrl) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  let body = raw
  try { body = raw ? JSON.parse(raw) : {} } catch {}
  req.query = Object.fromEntries(parsedUrl.searchParams)
  req.body = body
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res }
  try {
    await handler(req, res)
  } catch (err) {
    if (!res.writableEnded) res.status(500).json({ error: err.message })
  }
}

// Plugin to support Vercel Blob API routes in Vite dev server (npm run dev)
function vercelBlobDevPlugin(env) {
  return {
    name: 'vercel-blob-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url, 'http://localhost:5173')
        const token = env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN

        // Lớp trung gian Higgsfield (giống api/hf.js trên Vercel)
        if (parsedUrl.pathname.startsWith('/api/hf/')) {
          try {
            await proxyHiggsfield(req, res, parsedUrl.pathname.slice('/api/hf/'.length))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'proxy_error', message: err.message }))
          }
          return
        }

        if (parsedUrl.pathname === '/api/upload' && req.method === 'POST') {
          const filename = parsedUrl.searchParams.get('filename') || `image-${Date.now()}.png`
          try {
            const blob = await put(filename, req, {
              access: 'public',
              token,
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ url: blob.url, pathname: blob.pathname }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Upload thất bại' }))
          }
          return
        }

        // R2 (ký link upload / tải hộ) và xóa file: dùng lại đúng code của api/*.js trên Vercel
        if (parsedUrl.pathname === '/api/r2') {
          await runVercelHandler(r2Handler, req, res, parsedUrl)
          return
        }
        if (parsedUrl.pathname === '/api/delete') {
          await runVercelHandler(deleteHandler, req, res, parsedUrl)
          return
        }

        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Đưa biến R2_* / BLOB_* trong .env.local vào process.env cho các hàm api/*.js khi chạy dev
  for (const [k, v] of Object.entries(env)) {
    if ((k.startsWith('R2_') || k.startsWith('BLOB_')) && !process.env[k]) process.env[k] = v
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      vercelBlobDevPlugin(env),
    ],
    server: {
      port: 5173,
    }
  }
})

