import type { McpUiResourceCsp } from '@modelcontextprotocol/ext-apps'

/**
 * Builds a Content-Security-Policy header value from a UI resource's `csp`
 * metadata, for hosts that serve MCP Apps through a sandbox origin.
 *
 * The policy follows the extension's guidance: nothing is allowed by default;
 * `resourceDomains` open images, scripts, styles, fonts and media;
 * `connectDomains` open `connect-src`; `frameDomains` open nested frames; and
 * `baseUriDomains` extend `base-uri` beyond the document itself. Inline
 * scripts and styles are allowed because a single-file app is inline by
 * construction and the sandbox, not the CSP, is what isolates it from the host.
 */
export function buildContentSecurityPolicy(csp: McpUiResourceCsp | undefined): string {
  const resources = unique(csp?.resourceDomains)
  const connect = unique(csp?.connectDomains)
  const frames = unique(csp?.frameDomains)
  const bases = unique(csp?.baseUriDomains)

  const directives = [
    `default-src 'none'`,
    `script-src 'self' 'unsafe-inline' ${resources}`,
    `style-src 'self' 'unsafe-inline' ${resources}`,
    `img-src 'self' data: blob: ${resources}`,
    `font-src 'self' data: ${resources}`,
    `media-src 'self' data: blob: ${resources}`,
    connect.length > 0 ? `connect-src ${connect}` : `connect-src 'none'`,
    frames.length > 0 ? `frame-src ${frames}` : `frame-src 'none'`,
    `base-uri 'self' ${bases}`,
    `form-action 'none'`,
    `object-src 'none'`,
  ]

  return directives.map((directive) => directive.trim().replace(/\s+/g, ' ')).join('; ')
}

function unique(domains: readonly string[] | undefined): string {
  const list = Array.from(new Set((domains ?? []).map((domain) => domain.trim()).filter(Boolean)))
  for (const domain of list) {
    if (/[\s;'"]/u.test(domain)) throw new Error(`Invalid CSP domain: ${domain}`)
  }
  return list.join(' ')
}
