import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import generateHandler from './api/generate.js'

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('error', reject)
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Invalid JSON request body'))
      }
    })
  })
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [
      react(),
      {
        name: 'casecraft-local-generation-api',
        configureServer(server) {
          server.middlewares.use('/api/generate', async (req, res, next) => {
            res.status = statusCode => {
              res.statusCode = statusCode
              return res
            }
            res.json = payload => {
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(payload))
            }

            try {
              req.body = JSON.parse(JSON.stringify(await readJsonBody(req)))
              await generateHandler(req, res)
            } catch (error) {
              if (error.message === 'Invalid JSON request body') return res.status(400).json({ error: error.message })
              next(error)
            }
          })
        },
      },
    ],
  }
})
