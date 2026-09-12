import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFile } from 'node:fs/promises'
import { createSandboxServer } from './proxy-server'

export default defineConfig({
  root: 'playground',
  plugins: [react(), {
    name: 'local-sandbox-proxy',
    async configureServer(host) {
      const html = await readFile('playground/generated/proxy.html', 'utf8')
      const proxy = createSandboxServer(html, ['http://localhost:5473', 'http://127.0.0.1:5473'])
      await new Promise<void>((resolve, reject) => {
        proxy.once('error', reject)
        proxy.listen(5474, '127.0.0.1', resolve)
      })
      host.httpServer?.once('close', () => proxy.close())
    },
  }],
})
