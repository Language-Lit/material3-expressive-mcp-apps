import type { Transport } from '@modelcontextprotocol/client'

/** Bind the host channel to both the proxy window and its configured origin. */
export function proxyTransport(target: Window, origin: string): Transport {
  let closed = false
  const receive = (event: MessageEvent) => {
    if (event.source !== target || event.origin !== origin) return
    const message = event.data
    if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') return
    if ('method' in message && typeof message.method !== 'string') return
    if ('id' in message && typeof message.id !== 'string' && typeof message.id !== 'number') return
    if (!('method' in message) && (!('id' in message) || !('result' in message || 'error' in message))) return
    try {
      transport.onmessage?.(message)
    } catch (cause) {
      transport.onerror?.(cause instanceof Error ? cause : new Error(String(cause)))
    }
  }
  const transport: Transport = {
    async start() { window.addEventListener('message', receive) },
    async send(message) {
      if (closed) throw new Error('The proxy connection is closed.')
      target.postMessage(message, origin)
    },
    async close() {
      if (closed) return
      closed = true
      window.removeEventListener('message', receive)
      transport.onclose?.()
    },
  }
  return transport
}

/** Keep teardown responses flowing while refusing all new app work. */
export function gateTransport(inner: Transport) {
  let accepting = true
  const transport: Transport = {
    start() {
      inner.onmessage = (message, extra) => {
        if (!accepting && 'method' in message) {
          if ('id' in message) {
            void inner.send({
              jsonrpc: '2.0', id: message.id,
              error: { code: -32000, message: 'The app is closing.' },
            }).catch(() => {})
          }
          return
        }
        transport.onmessage?.(message, extra)
      }
      inner.onclose = () => transport.onclose?.()
      inner.onerror = (error) => transport.onerror?.(error)
      return inner.start()
    },
    send: (message, options) => inner.send(message, options),
    close: () => inner.close(),
  }
  return { transport, stopRequests: () => { accepting = false } }
}

export function resolveSandboxUrl(value: string | undefined, hostUrl: string): string {
  if (!value) throw new Error('McpAppFrame requires a separate-origin sandboxUrl for browser embedding.')
  const url = new URL(value, hostUrl)
  if (!['https:', 'http:'].includes(url.protocol) || url.origin === new URL(hostUrl).origin) {
    throw new Error('sandboxUrl must use HTTP(S) on a different origin from the host.')
  }
  if (url.username || url.password) throw new Error('sandboxUrl must not include credentials.')
  return url.href
}
