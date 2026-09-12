// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import { createSandboxServer } from '../playground/proxy-server'
import { issueSandboxTicket, verifySandboxTicket } from '../deploy/sandbox/ticket'

const secret = 'test-only-secret-that-is-at-least-32-bytes-long'
const hostOrigin = 'https://host.example'
const servers: Server[] = []
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))) })
async function mount() {
  const server = createSandboxServer('<p>Proxy</p>', [hostOrigin], {
    publicOrigin: 'https://sandbox.example',
    authorize(request) {
      const token = request.method === 'GET' ? new URL(request.url!, 'https://sandbox.example').searchParams.get('ticket') : request.headers.authorization?.replace(/^Bearer /, '')
      return token ? verifySandboxTicket(token, secret) : undefined
    },
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const url = `http://127.0.0.1:${address.port}`
  const ticket = issueSandboxTicket({ hostOrigin, expiresAt: Date.now() + 60_000, csp: { connectDomains: ['https://api.example'] } }, secret)
  return { url, ticket, post: (params: unknown, token = ticket, origin = 'https://sandbox.example') => fetch(url + '/views', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Authorization: `Bearer ${token}` }, body: JSON.stringify(params),
  }) }
}
describe('sandbox launch authorization', () => {
  it('rejects expired, tampered and overlong-lived tickets', () => {
    const now = Date.now()
    const valid = issueSandboxTicket({ hostOrigin, expiresAt: now + 60_000 }, secret)
    expect(verifySandboxTicket(valid, secret, now)?.hostOrigin).toBe(hostOrigin)
    expect(verifySandboxTicket(valid, secret, now + 60_001)).toBeUndefined()
    expect(verifySandboxTicket(valid.replace(/^./, 'x'), secret, now)).toBeUndefined()
    expect(verifySandboxTicket(issueSandboxTicket({ hostOrigin, expiresAt: now + 600_000 }, secret), secret, now)).toBeUndefined()
    expect(() => issueSandboxTicket({ hostOrigin, expiresAt: now + 1000 }, 'short')).toThrow(/32 bytes/)
  })
  it('requires a signed ticket bound to the permitted host', async () => {
    const { url, ticket } = await mount()
    const query = '?hostOrigin=' + encodeURIComponent(hostOrigin)
    expect((await fetch(url + '/sandbox.html' + query)).status).toBe(403)
    expect((await fetch(url + '/sandbox.html' + query + '&ticket=' + ticket)).status).toBe(200)
    expect((await fetch(url + '/sandbox.html?hostOrigin=https://attacker.example&ticket=' + ticket)).status).toBe(403)
  })
  it('enforces authorization, fixed external origin, and approved resource privileges', async () => {
    const { post } = await mount()
    expect((await post({ html: '<p>App</p>' }, '')).status).toBe(403)
    expect((await post({ html: '<p>App</p>' }, undefined, 'https://attacker.example')).status).toBe(404)
    expect((await post({ html: '<p>App</p>', csp: { connectDomains: ['https://attacker.example'] } })).status).toBe(403)
    expect((await post({ html: '<p>App</p>', permissions: { camera: {} } })).status).toBe(403)
    expect((await post({ html: '<p>App</p>', sandbox: 'allow-scripts allow-same-origin' })).status).toBe(403)
  })
  it('serves a single-use view with enforced response-header policy', async () => {
    const { url, post } = await mount()
    const response = await post({ html: '<p>App</p>', csp: { connectDomains: ['https://api.example'] } })
    expect(response.status).toBe(200)
    const { path } = await response.json() as { path: string }
    const view = await fetch(url + path)
    expect(await view.text()).toBe('<p>App</p>')
    expect(view.headers.get('content-security-policy')).toContain('connect-src https://api.example')
    expect(view.headers.get('content-security-policy')).toContain('sandbox allow-scripts allow-forms;')
    expect(view.headers.get('referrer-policy')).toBe('no-referrer')
    expect(view.headers.get('cache-control')).toBe('no-store')
    expect((await fetch(url + path)).status).toBe(404)
  })
})
