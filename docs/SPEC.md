# MCP Apps companion specification

Status: 0.2.1 published; production deployment configuration pending
Task: T05, approved 2026-09-12

## Product

Provide a React host frame for MCP Apps and an app-side Material provider.
The core Material package remains independent of MCP. This companion consumes
only its public exports and owns no replacement Material controls or tokens.

## Protocol and dependencies

Target MCP Apps stable 2026-01-26 and the 2.0.0 releases of
`@modelcontextprotocol/ext-apps` and the split MCP client SDK. React 18/19,
React DOM, Material 3 Expressive ^1.2.0, ext-apps ^2.0.0 and client ^2.0.0
are required peers. No runtime dependencies are bundled. Server and Zod are
development fixtures, not implementation dependencies.

Primary references, checked 2026-09-12:

- https://apps.extensions.modelcontextprotocol.io/api/
- https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx

## Public surface

Exactly `.`, `./app`, and `./styles.css`. Root exports `McpAppFrame`, resource
readers and hook, capability constants, host context/style mapping helpers,
font collector, and CSP builder. App exports `McpAppProvider`, `useMcpApp`,
`useHostContext`, `useToolCall`, and `useDisplayMode`, with public types.

The host owns one bridge and iframe per resource. It registers handlers before
loading HTML, delivers tool input/result/cancellation after initialization,
forwards host context changes, follows inline height, and supports controlled
or uncontrolled inline/fullscreen/pip modes without moving the iframe. Controlled
requests return the committed mode, not an unaccepted request.

`active=false` and app teardown requests stop new app work, send resource teardown,
wait for acknowledgement or a one-second timeout, disconnect and clear the frame.
Resource replacement waits for the same cleanup. Immediate React unmount sends
a best-effort teardown request before DOM removal; use active=false followed by
the closed status to await persistence before unmounting. `closing` is a lifecycle
status; `closed` means the bridge is disconnected.

The app provider owns one App connection, exposes protocol state and hooks,
follows host light/dark mode, applies host style variables/fonts, and represents
safe areas. A caller may override its Material theme and color mode. The resolved
Material mode also governs the document theme; prior document settings are restored
when this behavior is disabled or the provider unmounts.

## Isolation and host responsibility

Browser embedding requires an HTTP(S) `sandboxUrl` on a different origin from
the host, per the targeted stable protocol. Missing, same-origin, opaque and
credential-bearing URLs fail before resource loading. The outer proxy uses
`allow-scripts allow-same-origin allow-forms`; `sandbox` configures the inner
view only. The host channel checks both source window and configured origin.
The proxy must enforce resource CSP and permissions. The playground supplies
a two-origin example with CSP response headers. A separately built service under
`deploy/sandbox` requires signed, expiring host tickets, limits resource policy
to the ticket's grants and forces the view sandbox in a response header. It
requires configured host/public origins and a server-side secret; production
deployment and integration with user sessions remain application inputs. Custom transports explicitly own
embedding policy for native integrations/tests.
Resource policy is a requested policy, not a host trust decision: hosts must
validate allowed origins and privileges before accepting it.

AppBridge routes calls through the supplied connected client. The frame denies
app-originated tool execution unless `onAuthorizeToolCall` explicitly returns
true. Only hosts providing that callback advertise serverTools. The callback
can await host permission/approval checks; closing or cancellation invalidates
pending approval. The application's backend still authenticates users and
enforces tool/resource authorization for all clients. Message/model-context
and download capabilities are advertised only with handlers. The default link
handler accepts only HTTP(S). An app can send messages through an explicitly
provided callback; the library does not execute an agent or send user messages
on its own. No claim of compatibility with every external MCP host is made.

## Styling and accessibility

Load core CSS before companion CSS. Companion CSS is namespaced `m3e-mcp`
and consumes core tokens. Host controls are Material IconButtons with names;
iframe title, busy state, progress, error and closed states are accessible.
Fullscreen is a CSS display mode, not a modal dialog or browser Fullscreen
API. It provides exit controls; iframe keyboard events do not bubble to the
host, so apps must provide their own keyboard exit when needed.

## Mapping deviations

MCP success and warning colors map to Material tertiary and secondary roles;
they are not new Material semantic roles. The protocol mono font uses a system
monospace stack because Material supplies no mono token. The regular border is
1px; semibold maps to Material medium. Host protocol variables are exposed
inside the app; arbitrary host colors are not reverse-converted into a full
Material theme. Hosts needing identical custom palettes pass a shared theme.

## Acceptance

`npm run verify` checks types, protocol interaction tests, build and package
boundaries. `npm run playground:build` must produce a working offline iframe
app, not development-only script references. Browser verification must cover
handshake, tools, theme, layout, modes and callback interactions. Generated
files are regenerated; publication requires a separate owner instruction.
