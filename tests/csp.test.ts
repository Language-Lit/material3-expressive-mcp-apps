import { describe, expect, it } from 'vitest'

import { buildContentSecurityPolicy } from '../src/host/csp'

describe('buildContentSecurityPolicy', () => {
  it('locks everything down when the resource declares nothing', () => {
    const policy = buildContentSecurityPolicy(undefined)
    expect(policy).toContain("default-src 'none'")
    expect(policy).toContain("connect-src 'none'")
    expect(policy).toContain("frame-src 'none'")
    expect(policy).toContain("script-src 'self' 'unsafe-inline';")
    expect(policy).toContain("base-uri 'self';")
  })

  it('opens exactly the declared origins', () => {
    const policy = buildContentSecurityPolicy({
      connectDomains: ['https://api.example.com', 'wss://live.example.com'],
      resourceDomains: ['https://cdn.example.com', 'https://cdn.example.com'],
      frameDomains: ['https://www.youtube.com'],
      baseUriDomains: ['https://cdn.example.com'],
    })
    expect(policy).toContain('connect-src https://api.example.com wss://live.example.com')
    expect(policy).toContain("img-src 'self' data: blob: https://cdn.example.com;")
    expect(policy).toContain("script-src 'self' 'unsafe-inline' https://cdn.example.com;")
    expect(policy).toContain('frame-src https://www.youtube.com')
    expect(policy).toContain("base-uri 'self' https://cdn.example.com")
    expect(policy.match(/https:\/\/cdn\.example\.com/g)).toHaveLength(6)
  })
})
