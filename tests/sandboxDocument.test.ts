import { describe, expect, it } from 'vitest'
import { sandboxDocument } from '../src/host/sandboxDocument'
import { buildContentSecurityPolicy } from '../src/host/csp'

describe('direct iframe policy', () => {
  it('installs a deny-by-default policy before app code', () => {
    const html = sandboxDocument('<script>window.loaded = true</script><p>Hello</p>', undefined)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.head.firstElementChild?.getAttribute('http-equiv')).toBe('Content-Security-Policy')
    expect(doc.head.firstElementChild?.getAttribute('content')).toContain("connect-src 'none'")
    expect(doc.querySelector('script')?.textContent).toContain('window.loaded')
    expect(doc.body.textContent).toBe('Hello')
  })
  it('rejects directive injection through declared domains', () => {
    expect(() => buildContentSecurityPolicy({ resourceDomains: ['https://cdn.test; connect-src *'] })).toThrow('Invalid CSP domain')
  })
})
