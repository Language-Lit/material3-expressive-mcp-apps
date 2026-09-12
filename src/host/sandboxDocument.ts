import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps'
import { buildContentSecurityPolicy } from './csp'

/** Place policy before all resource content, including scripts originally before head. */
export function sandboxDocument(html: string, csp: McpUiResourceCsp | undefined): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const policy = document.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = buildContentSecurityPolicy(csp)
  document.head.prepend(policy)
  return '<!doctype html>\n' + document.documentElement.outerHTML
}
