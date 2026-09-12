import { createHmac, timingSafeEqual } from 'node:crypto'
import type { McpUiResourceCsp, McpUiResourcePermissions } from '@modelcontextprotocol/ext-apps'

export interface SandboxGrant {
  hostOrigin: string
  expiresAt: number
  csp?: McpUiResourceCsp
  permissions?: McpUiResourcePermissions
}

function key(secret: string) {
  if (Buffer.byteLength(secret) < 32) throw new Error('SANDBOX_SECRET must contain at least 32 bytes.')
  return secret
}
function signature(payload: string, secret: string) {
  return createHmac('sha256', key(secret)).update(payload).digest()
}
export function issueSandboxTicket(grant: SandboxGrant, secret: string): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url')
  return `${payload}.${signature(payload, secret).toString('base64url')}`
}
export function verifySandboxTicket(ticket: string, secret: string, now = Date.now()): SandboxGrant | undefined {
  key(secret)
  if (ticket.length > 16384) return undefined
  const [payload, mac, extra] = ticket.split('.')
  if (!payload || !mac || extra !== undefined) return undefined
  const received = Buffer.from(mac, 'base64url')
  const expected = signature(payload, secret)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return undefined
  try {
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SandboxGrant
    const origin = new URL(grant.hostOrigin)
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== grant.hostOrigin) return undefined
    if (!Number.isFinite(grant.expiresAt) || grant.expiresAt <= now || grant.expiresAt > now + 5 * 60_000) return undefined
    return grant
  } catch { return undefined }
}
