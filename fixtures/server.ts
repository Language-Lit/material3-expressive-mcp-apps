import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps'
import { registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { mcpAppsClientCapabilities } from '../src/host/resource'

export const VIEW_URI = 'ui://m3e-test/view.html'
export const VIEW_HTML = '<!doctype html><html><body><p>Test view</p></body></html>'

/**
 * A real MCP server with one app tool and one UI resource, connected to a real
 * client over the SDK's in-memory transport. Tests go through the same
 * `tools/call` and `resources/read` plumbing a production host would.
 */
export async function connectTestServer() {
  const server = new McpServer({ name: 'm3e-test-server', version: '1.0.0' })

  registerAppResource(
    server,
    'view',
    VIEW_URI,
    {
      _meta: {
        ui: {
          prefersBorder: true,
          csp: { connectDomains: ['https://api.example.com'] },
          permissions: { clipboardWrite: {} },
        },
      },
    },
    async () => ({
      contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: VIEW_HTML }],
    }),
  )

  registerAppTool(
    server,
    'greet',
    {
      title: 'Greet',
      description: 'Greets someone by name.',
      inputSchema: z.object({ name: z.string() }),
      _meta: { ui: { resourceUri: VIEW_URI } },
    },
    async ({ name }) => ({ content: [{ type: 'text', text: `Hello, ${name}.` }] }),
  )

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client(
    { name: 'm3e-test-host', version: '1.0.0' },
    { capabilities: mcpAppsClientCapabilities },
  )
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  return {
    client,
    server,
    async close() {
      await client.close()
      await server.close()
    },
  }
}
