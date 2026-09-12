# Material 3 Expressive for MCP Apps

A React host frame for MCP Apps, plus a Material provider for the apps that
run inside it. Version 0.1.0 provides the host and app integration described below.

The host renders `ui://` HTML resources in an isolated iframe, passes tool
results, supplies Material-derived host styles, and supports inline, fullscreen
and picture-in-picture layouts. Apps use Material components and the provider's
hooks to read tool calls, follow host mode and request host actions.

## Local setup

```sh
npm ci
npm run verify
npm run playground
```

Open http://localhost:5473 and call the forecast tool. Refresh calls an app-only
server tool; selecting a day updates model context; Add to chat reports a user
message to the host. This is deterministic sample data with no model/backend.
`npm run playground:build` builds both the host and a self-contained iframe app.

## Installation

```sh
npm install @language-lit/material3-expressive-mcp-apps@0.1.0 @language-lit/material3-expressive @modelcontextprotocol/client@^2.0.0 @modelcontextprotocol/ext-apps@^2.0.0 react react-dom
```

Load `@language-lit/material3-expressive/styles.css`, then this package's
`styles.css`, in both host and app documents.

```tsx
import { Material3Provider } from '@language-lit/material3-expressive'
import { McpAppFrame, useMcpAppResource } from '@language-lit/material3-expressive-mcp-apps'
import type { Client } from '@modelcontextprotocol/client'

export function ToolView({ client, uri }: { client: Client; uri: string }) {
  const { resource, error } = useMcpAppResource(client, uri)
  if (error) return <p role="alert">{error.message}</p>
  return <Material3Provider>{resource &&
    <McpAppFrame client={client} resource={resource} title="Tool app" />
  }</Material3Provider>
}
```

Connect the client before rendering; advertise `mcpAppsClientCapabilities` when
constructing it. Pass `toolInput`, `toolResult` and `toolInfo` for the tool call.
Use `onMessage`, `onUpdateModelContext`, and `onDownloadFile` to explicitly
enable those capabilities. `onBridge` exposes the SDK bridge for advanced use.

```tsx
import { McpAppProvider, useToolCall } from '@language-lit/material3-expressive-mcp-apps/app'
import { Text } from '@language-lit/material3-expressive'

function View() {
  const { result } = useToolCall()
  return <Text as="p">{result ? 'Tool result received' : 'Waiting for the tool'}</Text>
}
export function App() {
  return <McpAppProvider appInfo={{ name: 'my-app', version: '1.0.0' }}>
    <View />
  </McpAppProvider>
}
```

Bundle the app to one HTML resource. Register it and its tool using the official
SDK's `registerAppResource` and `registerAppTool`, linking `_meta.ui.resourceUri`.
The playground server is a complete example.

## Limits and host policy

This is an MCP Apps adapter, not an agent runtime, server, or authentication
system. Hosts own tool authorization, resource trust, permissions, and message
dispatch. The default iframe has an opaque origin and a deny-by-default CSP;
resource metadata opens declared domains only after the host accepts them.
A `sandboxUrl` requires a host-operated proxy that enforces resource policy.
Do not grant same-origin access to untrusted HTML on the host's own origin.

Fullscreen is a CSS display mode with exit controls, not a modal dialog.
Custom host palettes are projected into MCP style variables; the app's Material
palette is its own `theme` prop. Host light/dark mode is followed automatically.
See [the specification](docs/SPEC.md) for mappings and the supported boundary.

Compatibility is tested against ext-apps/client 2.0.0 and core 1.2.2.
External host interoperability is not yet certified. Protocol documentation:
[official MCP Apps SDK](https://apps.extensions.modelcontextprotocol.io/api/).

## Verification

```sh
npm run verify
npm run playground:build
M3E_CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

The browser audit serves the production playground, runs interactions offline,
checks host and app layouts at 320, 390 and 1440px in light and dark mode, and
verifies that the browser blocks an undeclared connection through CSP. It saves
screenshots to a temporary directory. Tests use a real SDK connection and a
local server; no credentials, LLM or external backend are needed.
