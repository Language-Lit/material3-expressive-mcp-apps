# Material 3 Expressive for MCP Apps

A React host frame for MCP Apps, plus a Material provider for the apps that
run inside it. Version 0.2.1 provides the host and app integration described below.

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

Open http://localhost:5473 and call the forecast tool. The dev command also starts
the sandbox proxy at http://127.0.0.1:5474. Refresh calls an app-only
server tool; selecting a day updates model context; Add to chat reports a user
message to the host. This is deterministic sample data with no model/backend.
`npm run playground:build` builds both the host and a self-contained iframe app.

## Installation

```sh
npm install @language-lit/material3-expressive-mcp-apps@0.2.1 @language-lit/material3-expressive @modelcontextprotocol/client@^2.0.0 @modelcontextprotocol/ext-apps@^2.0.0 react react-dom
```

Load `@language-lit/material3-expressive/styles.css`, then this package's
`styles.css`, in both host and app documents.

```tsx
import { Material3Provider } from '@language-lit/material3-expressive'
import { McpAppFrame, useMcpAppResource } from '@language-lit/material3-expressive-mcp-apps'
import type { Client } from '@modelcontextprotocol/client'

export function ToolView({ client, uri, sandboxUrl }: { client: Client; uri: string; sandboxUrl: string }) {
  const { resource, error } = useMcpAppResource(client, uri)
  if (error) return <p role="alert">{error.message}</p>
  return <Material3Provider>{resource &&
    <McpAppFrame client={client} resource={resource} sandboxUrl={sandboxUrl} title="Tool app" />
  }</Material3Provider>
}
```

Connect the client before rendering; advertise `mcpAppsClientCapabilities` when
constructing it. Pass `toolInput`, `toolResult` and `toolInfo` for the tool call.
Use `onMessage`, `onUpdateModelContext`, and `onDownloadFile` to explicitly
enable those capabilities. App-originated server tool calls are denied unless
`onAuthorizeToolCall` explicitly returns `true`. Use that callback to check the
current user's permissions and await any required approval; enforce the same
rules on the MCP server. The playground allows only its read-only refresh tool:

```tsx
<McpAppFrame
  client={client}
  resource={resource}
  sandboxUrl={sandboxUrl}
  onAuthorizeToolCall={({ name }) => name === 'refresh_forecast'}
/>
```

Replace that example whitelist with your application's session/role policy.
A missing callback advertises no server tools and also denies direct protocol
requests. A late approval after closing cannot execute a tool.
`onBridge` exposes the SDK bridge for advanced use.

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
dispatch. Browser embedding requires `sandboxUrl` pointing to a host-operated HTTP(S)
proxy on a different origin. Missing or same-origin proxy URLs produce an error
without loading the app. The outer proxy iframe has fixed sandbox permissions;
`sandbox` configures its inner view. The proxy must enforce resource CSP and
validate message sources; resource permissions remain a host trust decision.
This is a migration from 0.1.0's direct `srcdoc` default. Custom `transport`
implementations are an explicit escape hatch for native hosts and tests; those
hosts own their embedding policy. See [the local proxy fixture](playground/proxy-server.ts)
and [its relay](playground/proxy.ts) for a working example. Production deployments
must configure their trusted host origins and resource policy. A standalone
Docker service with signed launch tickets is provided under
[deploy/sandbox](deploy/sandbox/README.md); its signing secret stays on the host
backend. Tickets limit requested network origins and browser permissions.

Do not grant same-origin access to untrusted HTML on the host's own origin.

For graceful host closure, set `active={false}`, wait for
`onStatusChange('closed')`, then unmount. The frame sends `ui/resource-teardown`,
waits for acknowledgement (up to one second), and disconnects. New app requests
are rejected as soon as closing starts. App-requested teardown follows the same
sequence; `onTeardownRequest` runs after disconnection. Resource replacement
also waits for teardown. Immediate React unmount sends the request before DOM
removal but cannot await a response; use `active` when the app needs to persist
state. The status union now includes `closing`.

Controlled display-mode requests report the mode actually committed by the
owner. If the owner defers a transition, the reply retains the current mode;
the eventual update arrives through host context.

Fullscreen is a CSS display mode with exit controls, not a modal dialog.
Custom host palettes are projected into MCP style variables; the app's Material
palette is its own `theme` prop. Host light/dark mode is followed automatically. An app `colorMode` override
also controls the document theme and native controls, including system mode.
See [the specification](docs/SPEC.md) for mappings and the supported boundary.

Compatibility is tested against ext-apps/client 2.0.0 and core 1.2.2.
See [the compatibility record](docs/COMPATIBILITY.md) for React and browser
versions. Independent plain-JSON host/app peers are tested as well; this is not
certification in a named third-party host. Protocol documentation:
[official MCP Apps SDK](https://apps.extensions.modelcontextprotocol.io/api/).

## Verification

```sh
npm run verify
npm run playground:build
npx playwright-core install chromium firefox webkit
npm run test:browser
M3E_BROWSER=firefox npm run test:browser
M3E_BROWSER=webkit npm run test:browser
npm run test:react18
```

The browser audit serves the production playground and a separate-origin proxy,
verifies CSP response headers and closing/reopening, runs loaded-app interactions offline,
checks host and app layouts at 320, 390 and 1440px in light and dark mode, and
verifies that the browser blocks an undeclared connection through CSP. It saves
screenshots to a temporary directory. Tests use a real SDK connection and a
local server; no credentials, LLM or external backend are needed.

Firefox reports even caught CSP eval probes. The playground initializes Zod's
public `jitless` setting in a side-effectful module before importing SDK schemas;
it never adds `unsafe-eval`. If building your own strict-CSP app, preserve that
initialization order and module side effects (see `playground/csp-runtime.ts`).
Zod remains an SDK peer/development fixture, not a companion runtime dependency.

## Migration from 0.1.0

- Supply a separate-origin `sandboxUrl` for browser embedding.
- Supply `onAuthorizeToolCall` to permit app-originated server tools.
- Handle `closing` if you exhaustively match frame statuses. For graceful host
  removal, use `active=false`, wait for `closed`, then unmount.
- Controlled display-mode responses now reflect the mode actually committed.
- App color-mode overrides now apply consistently to the document as well.
