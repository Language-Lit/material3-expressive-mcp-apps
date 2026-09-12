import { createServer, type IncomingMessage } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { McpUiResourceCsp, McpUiResourcePermissions } from '@modelcontextprotocol/ext-apps'
import { buildContentSecurityPolicy } from '../src/host/csp'

export interface SandboxPolicy {
  hostOrigin: string
  csp?: McpUiResourceCsp
  permissions?: McpUiResourcePermissions
}
export interface SandboxServerOptions {
  publicOrigin?: string
  authorize?: (request: IncomingMessage) => SandboxPolicy | undefined
}

/** Shared service; the deployment entry supplies a fixed origin and signed authorization. */
export function createSandboxServer(proxyHtml: string, allowedHostOrigins: readonly string[], options: SandboxServerOptions = {}) {
  for (const host of allowedHostOrigins) {
    const url = new URL(host)
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== host) throw new Error('Host allowlist must contain HTTP(S) origins.')
  }
  const views = new Map<string, { html: string; policy: string; expires: number }>()
  const server = createServer(async (request, response) => {
    try {
      const origin = options.publicOrigin ?? `http://${request.headers.host}`
      const url = new URL(request.url ?? '/', origin)
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Referrer-Policy', 'no-referrer')
      const approval = options.authorize?.(request)
      if (options.authorize && ['/sandbox.html', '/views'].includes(url.pathname) && (!approval || !allowedHostOrigins.includes(approval.hostOrigin))) {
        response.writeHead(403).end('Sandbox authorization required')
        return
      }
      if (request.method === 'GET' && url.pathname === '/sandbox.html') {
        const host = url.searchParams.get('hostOrigin')
        if (!host || !allowedHostOrigins.includes(host) || host === origin || (approval && approval.hostOrigin !== host)) {
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
        if (approval) {
          for (const field of ['connectDomains', 'resourceDomains', 'frameDomains', 'baseUriDomains'] as const) {
            const requested: unknown = params.csp?.[field]
            if (requested !== undefined && (!Array.isArray(requested) || requested.some((domain) => typeof domain !== 'string' || !approval.csp?.[field]?.includes(domain)))) {
              response.writeHead(403).end('Resource policy exceeds authorization')
              return
            }
          }
          if (Object.keys(params.permissions ?? {}).some((permission) => !Object.hasOwn(approval.permissions ?? {}, permission)) || (params.sandbox && params.sandbox !== 'allow-scripts allow-forms')) {
            response.writeHead(403).end('Sandbox permissions exceed authorization')
            return
          }
        }
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
        response.setHeader('Content-Security-Policy', `${view.policy}; ${options.authorize ? 'sandbox allow-scripts allow-forms; ' : ''}frame-ancestors 'self' ${allowedHostOrigins.join(' ')}`)
        response.end(view.html)
        return
      }
      response.writeHead(404).end('Not found')
    } catch {
      response.writeHead(400).end('Invalid sandbox request')
    }
  })
  const expiry = setInterval(() => {
    for (const [path, view] of views) if (view.expires < Date.now()) views.delete(path)
  }, 60_000)
  expiry.unref()
  server.once('close', () => clearInterval(expiry))
  return server
}
