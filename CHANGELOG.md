# Changelog

## 0.2.0 — 2026-09-12

### Migration

Browser hosts must supply a separate-origin `sandboxUrl`. App-originated server
tool calls now require `onAuthorizeToolCall` to explicitly return true. Handle
the new `closing` frame status if matching statuses exhaustively.

### Changes

- Correct controlled display-mode replies and resolved document color overrides.
- Send bounded graceful teardown, disconnect closed frames, reject work during
  closure and invalidate late tool approvals. Use active=false and wait for closed
  before unmounting when persistence needs an acknowledgement.
- Bind proxy messages to the configured origin and source window.
- Provide a separately built Docker sandbox service with signed expiring launch
  tickets, approved policy limits, single-use resources and enforced CSP headers.
- Verify React 18.3.1/19.3.0 across Chromium, Firefox and WebKit; 69 unit/protocol
  tests, including independent plain-JSON peers, pass.
- Initialize the fixture's CSP-safe dependency configuration before SDK schemas.

No runtime dependencies or browser package export paths were added. Production
hosting and integration with the application's login/approval rules require
owner-specific configuration. The standalone service is supplied in the repository,
not as an additional npm entry point.

## 0.1.0 — 2026-09-12

Initial Material host frame, app provider/hooks, public helpers and playground.
