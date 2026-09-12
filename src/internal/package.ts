/**
 * The identity this package announces to an MCP App as the default `hostInfo`.
 * `scripts/verify-package.mjs` asserts the version matches `package.json`, so a
 * release bump cannot leave the wire identity behind.
 */
export const PACKAGE_NAME = '@language-lit/material3-expressive-mcp-apps'
export const PACKAGE_VERSION = '0.2.0'
