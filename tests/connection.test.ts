import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxyTransport, resolveSandboxUrl } from '../src/host/connection'

const frames: HTMLIFrameElement[] = []
afterEach(() => { for (const frame of frames.splice(0)) frame.remove() })
function frameWindow() {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  frames.push(frame)
  return frame.contentWindow!
}

describe('proxy channel', () => {
  it('accepts messages only from the configured window and origin and removes listeners on close', async () => {
    const target = frameWindow()
    const other = frameWindow()
    const transport = proxyTransport(target, 'https://sandbox.example')
    const received = vi.fn()
    transport.onmessage = received
    await transport.start()
    const data = { jsonrpc: '2.0' as const, method: 'ui/notifications/sandbox-proxy-ready', params: {} }
    const dispatch = (source: Window, origin: string, message: unknown = data) => window.dispatchEvent(new MessageEvent('message', { source, origin, data: message }))
    try {
      dispatch(other, 'https://sandbox.example')
      dispatch(target, 'https://attacker.example')
      dispatch(target, 'https://sandbox.example', { jsonrpc: '2.0', method: 123 })
      expect(received).not.toHaveBeenCalled()
      dispatch(target, 'https://sandbox.example')
      expect(received).toHaveBeenCalledTimes(1)
      await transport.close()
      dispatch(target, 'https://sandbox.example')
      expect(received).toHaveBeenCalledTimes(1)
      await expect(transport.send(data)).rejects.toThrow(/closed/)
    } finally { await transport.close() }
  })

  it('targets only the configured origin when sending', async () => {
    const target = frameWindow()
    const post = vi.spyOn(target, 'postMessage').mockImplementation(() => {})
    const transport = proxyTransport(target, 'https://sandbox.example')
    const data = { jsonrpc: '2.0' as const, method: 'ping', id: 1 }
    await transport.send(data)
    expect(post).toHaveBeenCalledWith(data, 'https://sandbox.example')
    await transport.close()
  })

  it('resolves a separate HTTP(S) origin and rejects credential-bearing URLs', () => {
    expect(resolveSandboxUrl('https://sandbox.example/app', 'https://host.example')).toBe('https://sandbox.example/app')
    expect(() => resolveSandboxUrl('https://user:secret@sandbox.example', 'https://host.example')).toThrow(/credentials/)
  })
})
