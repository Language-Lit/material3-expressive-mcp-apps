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
