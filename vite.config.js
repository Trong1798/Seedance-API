import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { put, del } from '@vercel/blob'

// Plugin to support Vercel Blob API routes in Vite dev server (npm run dev)
function vercelBlobDevPlugin(env) {
  return {
    name: 'vercel-blob-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url, 'http://localhost:5173')
        const token = env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN

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

        if (parsedUrl.pathname === '/api/delete' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', async () => {
            try {
              const { url: targetUrl } = JSON.parse(body || '{}')
              if (!targetUrl) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing target URL' }))
                return
              }
              await del(targetUrl, { token })
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message || 'Delete thất bại' }))
            }
          })
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

  return {
    plugins: [
      react(),
      tailwindcss(),
      vercelBlobDevPlugin(env),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'https://tuansuapi.store/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          bypass: (req) => {
            if (req.url && (req.url.startsWith('/api/upload') || req.url.startsWith('/api/delete'))) {
              return req.url
            }
          },
          timeout: 900000,
          proxyTimeout: 900000,
        }
      }
    }
  }
})

