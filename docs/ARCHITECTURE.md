# Architecture

`src/index.ts` exposes host helpers and `src/app/index.ts` exposes app APIs.
Both are client boundaries. `src/host/` owns the frame, resource loading,
protocol style projection, font collection, and sandbox policy. `src/app/`
owns provider state and hooks. `src/internal/` contains small shared utilities.
Neither entry imports playground, fixtures or another repository's internals.
The app entry does not import AppBridge or the server SDK.

The SDK owns protocol validation and request routing. `src/host/connection.ts`
binds the browser channel to the proxy window/origin and gates new app work
during teardown. React effects
own connection lifetimes; latest callback refs avoid reconnecting on a render.
The host keeps iframe DOM identity through display-mode changes. Resource
identity/content or handshake-capability changes recreate its bridge after bounded
teardown. Layout cleanup sends teardown before immediate React DOM removal;
active=false provides an acknowledgement period before unmounting.

CSS is colocated with each component and assembled by `src/styles/styles.css`.
`build:styles` validates the namespace and compiles the authored rules. The
package verifier checks exports, peers, directives, dependencies and design
system boundaries. `tests/` uses real linked SDK transports and `fixtures/`
contains an in-memory server; tests do not mock the wire protocol.

`playground/` is a consumer example with deterministic forecast data. Its app
is bundled into one generated HTML document by `build-playground-app.mjs`,
then served as a ui resource over an in-memory MCP connection. Vite bundles
the host separately. Both dev and production use the same isolated app.

`playground/proxy.ts` and `proxy-server.ts` provide a separate-origin demo proxy.
The relay accepts host messages only from the configured parent origin/window
and view messages only from its inner iframe. The server serves each view once
with a CSP response header. Build scripts generate both proxy assets.

`deploy/sandbox/` owns the standalone service entry, Node-only ticket helper,
Dockerfile and deployment guide. `scripts/build-sandbox.mjs` generates its
unpublished `dist/` independently from the browser package. `tests/` exercises
signed tickets, policy limits and independently implemented JSON-RPC peers;
`scripts/test-sandbox-container.mjs` runs the built image against local requests.
`McpAppFrame` installs an explicit tool-authorization gate after AppBridge's
standard client handlers are registered; absent approval never executes a tool.

The browser runner selects Chromium/Firefox/WebKit via M3E_BROWSER.
`scripts/verify-react.mjs` copies this repository into a temporary directory,
installs the requested React major and types with strict peer resolution, then
runs types, tests, builds and all three engines without changing the workspace.
