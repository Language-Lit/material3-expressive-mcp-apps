import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { issueSandboxTicket } from '../deploy/sandbox/dist/ticket.mjs'
const exec = promisify(execFile)
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const directory = await mkdtemp(path.join(tmpdir(), 'm3e-sandbox-container-'))
const secret = randomBytes(32).toString('hex')
const envFile = path.join(directory, 'sandbox.env')
await writeFile(envFile, `SANDBOX_ORIGIN=https://sandbox.example\nHOST_ORIGINS=https://host.example\nSANDBOX_SECRET=${secret}\n`, { mode: 0o600 })
let container
try {
  container = (await exec('docker', ['run', '--rm', '-d', '--env-file', envFile, '-p', '127.0.0.1::8080', `m3e-mcp-sandbox:${pkg.version}`])).stdout.trim()
  const address = (await exec('docker', ['port', container, '8080/tcp'])).stdout.trim()
  const origin = `http://${address}`
  const hostOrigin = 'https://host.example'
  const ticket = issueSandboxTicket({ hostOrigin, expiresAt: Date.now() + 60_000 }, secret)
  const launch = `${origin}/sandbox.html?hostOrigin=${encodeURIComponent(hostOrigin)}`
  let ready = false
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch(launch, { signal: AbortSignal.timeout(1000) })).status === 403) { ready = true; break } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert(ready, 'Sandbox did not start and reject anonymous launches')
  assert.equal((await fetch(`${launch}&ticket=${ticket}`)).status, 200)
  assert.equal((await fetch(`${launch}&ticket=invalid`)).status, 403)
  const post = (params) => fetch(origin + '/views', {
    method: 'POST', headers: { Origin: 'https://sandbox.example', Authorization: `Bearer ${ticket}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  })
  assert.equal((await post({ html: '<p>Denied</p>', csp: { connectDomains: ['https://attacker.example'] } })).status, 403)
  const created = await post({ html: '<p>Authorized</p>' })
  assert.equal(created.status, 200)
  const { path: viewPath } = await created.json()
  const view = await fetch(origin + viewPath)
  assert.equal(await view.text(), '<p>Authorized</p>')
  assert(view.headers.get('content-security-policy').includes("connect-src 'none'"))
  assert(view.headers.get('content-security-policy').includes('sandbox allow-scripts allow-forms'))
  assert.equal((await fetch(origin + viewPath)).status, 404)
  console.log('Sandbox container passed: authorization, fixed HTTPS public origin, policy limits, CSP and single-use resources.')
} finally {
  if (container) await exec('docker', ['rm', '-f', container]).catch(() => {})
  await rm(directory, { recursive: true, force: true })
}
