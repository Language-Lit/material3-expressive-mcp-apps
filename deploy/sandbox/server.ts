import { readFile } from 'node:fs/promises'
import { createSandboxServer } from '../../playground/proxy-server'
import { verifySandboxTicket } from './ticket'

const publicOrigin = process.env.SANDBOX_ORIGIN
const secret = process.env.SANDBOX_SECRET
const hosts = process.env.HOST_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean)
if (!publicOrigin || !secret || !hosts?.length) throw new Error('Set SANDBOX_ORIGIN, HOST_ORIGINS and SANDBOX_SECRET.')
if (Buffer.byteLength(secret) < 32) throw new Error('SANDBOX_SECRET must contain at least 32 bytes.')
const origin = new URL(publicOrigin)
if (origin.origin !== publicOrigin || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
  throw new Error('SANDBOX_ORIGIN must be an HTTPS origin (HTTP is allowed only on loopback).')
}
const html = await readFile(new URL('./proxy.html', import.meta.url), 'utf8')
const server = createSandboxServer(html, hosts, {
  publicOrigin,
  authorize(request) {
    const url = new URL(request.url ?? '/', publicOrigin)
    const ticket = request.method === 'GET' ? url.searchParams.get('ticket') : request.headers.authorization?.replace(/^Bearer /, '')
    return ticket ? verifySandboxTicket(ticket, secret) : undefined
  },
})
const port = Number(process.env.PORT ?? 8080)
server.listen(port, '0.0.0.0', () => console.log(`Sandbox listening on ${port}; public origin ${publicOrigin}`))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)))
