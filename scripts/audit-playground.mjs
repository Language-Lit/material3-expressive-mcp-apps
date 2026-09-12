import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, stat, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSandboxServer } from '../playground/generated/proxy-server.mjs'
import { chromium } from 'playwright-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'playground/dist')
const executablePath = process.env.M3E_CHROMIUM_PATH
assert(executablePath, 'Set M3E_CHROMIUM_PATH to a Chromium executable.')
await stat(path.join(output, 'index.html'))
const screenshots = await mkdtemp(path.join(tmpdir(), 'm3e-mcp-apps-'))
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' }
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    let file = path.resolve(output, `.${pathname}`)
    if (file !== output && !file.startsWith(`${output}${path.sep}`)) throw new Error('Outside export')
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html')
    response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream')
    response.end(await readFile(file))
  } catch {
    response.writeHead(404).end('Not found')
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const proxy = createSandboxServer(await readFile(path.join(root, 'playground/generated/proxy.html'), 'utf8'), [origin])
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
const proxyOrigin = `http://127.0.0.1:${proxy.address().port}`
const browser = await chromium.launch({ executablePath })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' })
const page = await context.newPage()
const errors = []
const requests = []
const viewPolicies = []
page.on('response', (response) => { if (response.url().startsWith(`${proxyOrigin}/views/`)) viewPolicies.push(response.headers()['content-security-policy']) })
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
const app = () => page.frameLocator('iframe').frameLocator('iframe')
try {
  await page.goto(`${origin}/?sandboxUrl=${encodeURIComponent(`${proxyOrigin}/sandbox.html`)}`, { waitUntil: 'networkidle' })
  await page.locator('[data-status="ready"]').waitFor()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Call get_forecast', exact: true }).click()
  await app().getByRole('heading', { name: 'Lisbon', exact: true }).waitFor()
  const chips = app().getByRole('group', { name: 'Days' }).getByRole('button')
  await chips.nth(2).click()
  await page.waitForFunction(() => document.querySelector('.pg-log')?.textContent.includes('looking at Wed'))
  const initial = await chips.first().textContent()
  await app().getByRole('button', { name: 'Refresh', exact: true }).click()
  await chips.first().filter({ hasNotText: initial }).waitFor()
  await app().getByRole('button', { name: 'Add to chat', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.pg-log')?.textContent.includes('ui/message'))
  await app().getByRole('button', { name: 'Full screen', exact: true }).click()
  await page.locator('.m3e-mcp-frame[data-display-mode="fullscreen"]').waitFor()
  assert.equal(await chips.nth(2).getAttribute('aria-pressed'), 'true')
  await app().getByRole('button', { name: 'Back inline', exact: true }).click()
  await page.locator('.m3e-mcp-frame[data-display-mode="inline"]').waitFor()
  await app().locator('.fc--inline').waitFor()
  await page.getByRole('button', { name: 'Picture in picture', exact: true }).click()
  await page.locator('.m3e-mcp-frame[data-display-mode="pip"]').waitFor()
  assert.equal(await chips.nth(2).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: 'Return to the conversation', exact: true }).click()
  // A new host result must replace the app's refreshed local result.
  await page.getByRole('button', { name: 'Call get_forecast', exact: true }).click()
  await chips.first().filter({ hasText: initial }).waitFor()
  await app().getByRole('group', { name: 'Days' }).getByRole('button').first().waitFor()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme })
      await app().getByText(new RegExp(`${colorScheme} theme`)).waitFor()
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Host overflow')
      assert(await app().locator('html').evaluate((element) => element.scrollWidth <= innerWidth), 'App overflow')
      await page.screenshot({ path: path.join(screenshots, `playground-${width}-${colorScheme}.png`), animations: 'disabled', fullPage: true })
    }
  }
  assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts allow-same-origin allow-forms')
  assert.equal(await page.frameLocator('iframe').locator('iframe').getAttribute('sandbox'), 'allow-scripts allow-forms')
  assert.notEqual(new URL(await page.locator('iframe').getAttribute('src')).origin, origin)
  assert(viewPolicies.some((policy) => policy?.includes("connect-src 'none'")), 'Missing CSP response header')
  assert.deepEqual(requests.filter((request) => !request.url.startsWith(origin + '/') && !request.url.startsWith(proxyOrigin + '/')), [], 'External requests')
  assert.deepEqual(errors, [], 'Browser errors')
  await context.setOffline(false)
  const violations = await app().locator('html').evaluate(async () => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve('no violation'), 3000)
      document.addEventListener('securitypolicyviolation', (event) => {
        clearTimeout(timer)
        resolve(event.effectiveDirective)
      }, { once: true })
      void fetch('https://example.invalid/policy-probe').catch(() => {})
    })
  })
  assert.equal(violations, 'connect-src', 'Browser did not enforce resource CSP')
  await page.getByRole('button', { name: 'Close app', exact: true }).click()
  await page.locator('.m3e-mcp-frame[data-status="closed"]').waitFor()
  assert.equal(await page.locator('iframe').getAttribute('src'), null)
  await page.getByRole('button', { name: 'Reopen app', exact: true }).click()
  await page.locator('.m3e-mcp-frame[data-status="ready"]').waitFor()
  await app().getByRole('heading', { name: 'Lisbon', exact: true }).waitFor()
  await app().getByRole('button', { name: 'Refresh', exact: true }).click()
  assert.deepEqual(errors.filter((error) => !error.includes('Content Security Policy') && !error.includes('content security policy')), [], 'Unexpected browser errors')
  process.stdout.write(`Companion browser audit passed. Screenshots: ${screenshots}\n`)
} catch (error) {
  console.error('Browser errors:', errors)
  console.error(await page.locator('body').innerText())
  await page.screenshot({ path: path.join(screenshots, 'failure.png'), fullPage: true })
  console.error('Screenshots:', screenshots)
  throw error
} finally {
  await browser.close()
  server.close()
  proxy.close()
}
