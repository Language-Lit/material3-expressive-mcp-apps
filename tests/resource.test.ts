import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps'
import { describe, expect, it, vi } from 'vitest'

import {
  MCP_APPS_EXTENSION_ID,
  isMcpAppMimeType,
  mcpAppsClientCapabilities,
  readMcpAppResource,
  toMcpAppResource,
} from '../src/host/resource'
import { VIEW_HTML, VIEW_URI, connectTestServer } from '../fixtures/server'

describe('mcpAppsClientCapabilities', () => {
  it('declares the UI extension with the MCP App MIME type', () => {
    const extensions = mcpAppsClientCapabilities.extensions as Record<string, { mimeTypes: string[] }>
    expect(extensions[MCP_APPS_EXTENSION_ID]?.mimeTypes).toEqual([RESOURCE_MIME_TYPE])
  })
})

describe('isMcpAppMimeType', () => {
  it('accepts the profile with or without whitespace and in any case', () => {
    expect(isMcpAppMimeType('text/html;profile=mcp-app')).toBe(true)
    expect(isMcpAppMimeType('text/html; profile=MCP-APP')).toBe(true)
    expect(isMcpAppMimeType('text/html')).toBe(false)
    expect(isMcpAppMimeType(undefined)).toBe(false)
  })
})

describe('toMcpAppResource', () => {
  it('prefers the MCP App item over other text and takes its own metadata first', () => {
    const resource = toMcpAppResource('ui://x', {
      _meta: { ui: { prefersBorder: false } },
      contents: [
        { uri: 'ui://x', mimeType: 'text/plain', text: 'readme' },
        { uri: 'ui://x', mimeType: RESOURCE_MIME_TYPE, text: '<p>app</p>', _meta: { ui: { prefersBorder: true } } },
      ],
    })
    expect(resource.html).toBe('<p>app</p>')
    expect(resource.mimeType).toBe(RESOURCE_MIME_TYPE)
    expect(resource.meta).toEqual({ prefersBorder: true })
  })

  it('falls back to the result metadata and to any text item', () => {
    const resource = toMcpAppResource('ui://x', {
      _meta: { ui: { csp: { connectDomains: ['https://a.example'] } } },
      contents: [{ uri: 'ui://x', mimeType: 'text/html', text: '<p>legacy</p>' }],
    })
    expect(resource.html).toBe('<p>legacy</p>')
    expect(resource.meta).toEqual({ csp: { connectDomains: ['https://a.example'] } })
  })

  it('refuses a result with no text to render', () => {
    expect(() =>
      toMcpAppResource('ui://x', { contents: [{ uri: 'ui://x', mimeType: 'image/png', blob: 'AAAA' }] }),
    ).toThrow(/no text content/)
  })
})

describe('readMcpAppResource', () => {
  it('takes the metadata from the content item without consulting the listing', async () => {
    const listResources = vi.fn()
    const client = {
      readResource: async () => ({
        contents: [{ uri: 'ui://x', mimeType: RESOURCE_MIME_TYPE, text: '<p>x</p>', _meta: { ui: { prefersBorder: false } } }],
      }),
      listResources,
    }
    const resource = await readMcpAppResource(client as never, 'ui://x')
    expect(resource.meta).toEqual({ prefersBorder: false })
    expect(listResources).not.toHaveBeenCalled()
  })

  it('walks the listing pages when the read result carries no metadata', async () => {
    const listResources = vi
      .fn()
      .mockResolvedValueOnce({ resources: [{ uri: 'ui://other', name: 'other' }], nextCursor: 'p2' })
      .mockResolvedValueOnce({ resources: [{ uri: 'ui://x', name: 'x', _meta: { ui: { prefersBorder: true } } }] })
    const client = {
      readResource: async () => ({ contents: [{ uri: 'ui://x', mimeType: RESOURCE_MIME_TYPE, text: '<p>x</p>' }] }),
      listResources,
    }
    const resource = await readMcpAppResource(client as never, 'ui://x')
    expect(resource.meta).toEqual({ prefersBorder: true })
    expect(listResources).toHaveBeenNthCalledWith(1, undefined)
    expect(listResources).toHaveBeenNthCalledWith(2, { cursor: 'p2' })
  })

  it('reads the document and its UI metadata through a real client', async () => {
    const { client, close } = await connectTestServer()
    try {
      const resource = await readMcpAppResource(client, VIEW_URI)
      expect(resource.uri).toBe(VIEW_URI)
      expect(resource.html).toBe(VIEW_HTML)
      expect(resource.mimeType).toBe(RESOURCE_MIME_TYPE)
      expect(resource.meta?.prefersBorder).toBe(true)
      expect(resource.meta?.csp?.connectDomains).toEqual(['https://api.example.com'])
      expect(resource.meta?.permissions).toEqual({ clipboardWrite: {} })
    } finally {
      await close()
    }
  })
})
