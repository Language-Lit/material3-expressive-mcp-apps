import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { buildContentSecurityPolicy } from '../src/host/csp'

/** Local demonstration server; a deployment must configure its own trusted hosts. */
export function createSandboxServer(proxyHtml: string, allowedHostOrigins: readonly string[]) {
  const views = new Map<string, { html: string; policy: string; expires: number }>()
  return createServer(async (request, response) => {
    try {
      const origin = `http://${request.headers.host}`
      const url = new URL(request.url ?? '/', origin)
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      if (request.method === 'GET' && url.pathname === '/sandbox.html') {
        const host = url.searchParams.get('hostOrigin')
        if (!host || !allowedHostOrigins.includes(host) || host === origin) {
          response.writeHead(403).end('Host not allowed')
          return
        }
        response.setHeader('Content-Type', 'text/html')
        response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors ${host}`)
        response.end(proxyHtml)
        return
      }
      if (request.method === 'POST' && url.pathname === '/views' && request.headers.origin === origin) {
        const chunks: Buffer[] = []
        let bytes = 0
        for await (const chunk of request) {
          bytes += chunk.length
          if (bytes > 8 * 1024 * 1024) { response.writeHead(413).end(); return }
          chunks.push(chunk)
        }
        const params = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (typeof params.html !== 'string') throw new Error('Missing HTML')
        for (const [key, value] of views) if (value.expires < Date.now()) views.delete(key)
        if (views.size >= 32) { response.writeHead(429).end(); return }
        const path = `/views/${randomUUID()}`
        views.set(path, { html: params.html, policy: buildContentSecurityPolicy(params.csp), expires: Date.now() + 60_000 })
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ path }))
        return
      }
      const view = views.get(url.pathname)
      if (request.method === 'GET' && view && view.expires >= Date.now()) {
        views.delete(url.pathname)
        response.setHeader('Content-Type', 'text/html')
        response.setHeader('Content-Security-Policy', `${view.policy}; frame-ancestors 'self' ${allowedHostOrigins.join(' ')}`)
        response.end(view.html)
        return
      }
      response.writeHead(404).end('Not found')
    } catch {
      response.writeHead(400).end('Invalid sandbox request')
    }
  })
}
