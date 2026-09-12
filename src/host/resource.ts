import { useEffect, useState } from 'react'
import type { Client, ClientCapabilities, ReadResourceResult, Resource } from '@modelcontextprotocol/client'
import { RESOURCE_MIME_TYPE, type McpUiResourceMeta } from '@modelcontextprotocol/ext-apps'

/** A UI resource ready to render: the HTML document and its declared metadata. */
export interface McpAppResource {
  /** The `ui://` URI the tool named in its `_meta.ui.resourceUri`. */
  readonly uri: string
  /** The HTML document to load into the sandbox. */
  readonly html: string
  /** The resource's MIME type as the server reported it. */
  readonly mimeType?: string
  /** `_meta.ui` from the content item, falling back to the read result. */
  readonly meta?: McpUiResourceMeta
}

/** The extension id MCP Apps hosts declare support under. */
export const MCP_APPS_EXTENSION_ID = 'io.modelcontextprotocol/ui'

/**
 * The client capability a host must declare so servers know it renders MCP
 * Apps. Spread it into your `Client`'s `capabilities` option.
 */
export const mcpAppsClientCapabilities: ClientCapabilities = {
  extensions: {
    [MCP_APPS_EXTENSION_ID]: { mimeTypes: [RESOURCE_MIME_TYPE] },
  },
}

/** Whether a resource content item is an MCP App document. */
export function isMcpAppMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false
  const normalized = mimeType.replace(/\s+/g, '').toLowerCase()
  return normalized === RESOURCE_MIME_TYPE
}

/**
 * Picks the MCP App document out of a `resources/read` result. Prefers the
 * item whose MIME type is `text/html;profile=mcp-app`, then any text item;
 * throws when the result carries no text content.
 */
export function toMcpAppResource(uri: string, result: ReadResourceResult): McpAppResource {
  const contents = result.contents ?? []
  const preferred =
    contents.find((item) => 'text' in item && isMcpAppMimeType(item.mimeType)) ??
    contents.find((item) => 'text' in item)
  if (!preferred || !('text' in preferred) || typeof preferred.text !== 'string') {
    throw new Error(`Resource ${uri} has no text content to render as an MCP App`)
  }
  const itemMeta = (preferred._meta as { ui?: McpUiResourceMeta } | undefined)?.ui
  const resultMeta = (result._meta as { ui?: McpUiResourceMeta } | undefined)?.ui
  return {
    uri,
    html: preferred.text,
    ...(preferred.mimeType ? { mimeType: preferred.mimeType } : {}),
    ...(itemMeta ?? resultMeta ? { meta: itemMeta ?? resultMeta } : {}),
  }
}

/** The client surface `readMcpAppResource` needs. */
export type McpAppResourceReader = Pick<Client, 'readResource'> & Partial<Pick<Client, 'listResources'>>

const MAX_LIST_PAGES = 20

/**
 * Reads a UI resource through a connected client.
 *
 * The extension puts a resource's UI metadata on the `resources/read` content
 * item, with the `resources/list` entry as the fallback. When the read result
 * carries none, the listing is consulted, page by page, until the URI is found.
 */
export async function readMcpAppResource(client: McpAppResourceReader, uri: string): Promise<McpAppResource> {
  const result = await client.readResource({ uri })
  const resource = toMcpAppResource(uri, result)
  if (resource.meta || !client.listResources) return resource
  const listed = await findListedResource(client as Pick<Client, 'listResources'>, uri)
  const listedMeta = (listed?._meta as { ui?: McpUiResourceMeta } | undefined)?.ui
  return listedMeta ? { ...resource, meta: listedMeta } : resource
}

async function findListedResource(
  client: Pick<Client, 'listResources'>,
  uri: string,
): Promise<Resource | undefined> {
  let cursor: string | undefined
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const result = await client.listResources(cursor ? { cursor } : undefined)
    const found = result.resources.find((entry) => entry.uri === uri)
    if (found) return found
    if (!result.nextCursor) return undefined
    cursor = result.nextCursor
  }
  return undefined
}

export interface McpAppResourceState {
  readonly resource: McpAppResource | null
  readonly error: Error | null
  readonly loading: boolean
}

/**
 * Reads a UI resource for a component's lifetime. Re-reads when the client or
 * the URI changes; a `null` URI yields an idle state.
 */
export function useMcpAppResource(
  client: McpAppResourceReader | null,
  uri: string | null | undefined,
): McpAppResourceState {
  const [state, setState] = useState<McpAppResourceState>({ resource: null, error: null, loading: false })

  useEffect(() => {
    if (!client || !uri) {
      setState({ resource: null, error: null, loading: false })
      return
    }
    let cancelled = false
    setState({ resource: null, error: null, loading: true })
    readMcpAppResource(client, uri).then(
      (resource) => {
        if (!cancelled) setState({ resource, error: null, loading: false })
      },
      (cause: unknown) => {
        if (!cancelled) {
          setState({
            resource: null,
            error: cause instanceof Error ? cause : new Error(String(cause)),
            loading: false,
          })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [client, uri])

  return state
}
