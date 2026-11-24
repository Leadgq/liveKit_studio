import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const certificateDirectory = fileURLToPath(new URL('../../.certs/', import.meta.url))

function certificateDownload(): Plugin {
  return {
    name: 'development-certificate-download',
    configureServer(server) {
      server.middlewares.use('/dev-ca.cer', (_request, response) => {
        const path = certificateDirectory + 'ca.cer'
        if (!existsSync(path)) {
          response.statusCode = 404
          response.end('Run npm run certificate:generate first.')
          return
        }
        response.setHeader('Content-Type', 'application/x-x509-ca-cert')
        response.setHeader('Content-Disposition', 'attachment; filename="livekit-dev-ca.cer"')
        response.setHeader('Cache-Control', 'no-store')
        response.end(readFileSync(path))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const mobile = mode === 'mobile'
  return {
    plugins: [vue(), certificateDownload()],
    server: {
      host: '0.0.0.0',
      port: mobile ? 5174 : 5173,
      strictPort: true,
      https: mobile ? {
        key: readFileSync(certificateDirectory + 'server-key.pem'),
        cert: readFileSync(certificateDirectory + 'server.pem'),
      } : undefined,
      proxy: {
        '/api': 'http://127.0.0.1:3001',
        '/livekit': {
          target: 'http://127.0.0.1:7880',
          ws: true,
          rewrite: path => path.replace(/^\/livekit/, ''),
        },
      },
    },
  }
})
