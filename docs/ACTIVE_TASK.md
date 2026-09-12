# Active task

## T01 — Material host and app integration for MCP Apps

Status: complete
Completed: 2026-09-12
Approved: 2026-09-12 (owner requested MCP Apps and authorized this sibling)

### Scope and expected files

Implement host `McpAppFrame`, app `McpAppProvider` and hooks, public host
helpers, styles and tests under `src/` and `tests/`. Add package/build guards,
in-memory fixtures, an interactive production-capable playground, README,
specification, architecture and ADR. Fix failures found during verification.
No core-library changes and no publication.

### Acceptance checks

- `npm run verify` and `npm run playground:build`.
- Real-browser initialization, tool input/result, refresh through server,
  chat/model-context callbacks, theme changes, display modes preserving state,
  mobile layout, and direct-frame CSP.
- Packed public entries/CSS and peer boundaries; no server SDK in app bundle.

### Verification record

- Initial recovered implementation: five test files, 40 tests pass; types,
  build and package guard pass.
- Final `npm run verify` passed: 6 test files, 42 tests, types, distributable
  build, stylesheet namespace guard and public package contract.
- `npm run playground:build` passed. Both development and production use the
  same self-contained iframe HTML, regenerated before typecheck and build.
- `npm run test:browser` passed against the production playground: handshake,
  host tool result, app-to-server refresh, selected-day model context, chat
  callback, fullscreen/pip transitions preserving state, and fresh host results
  replacing local refresh state. Light/dark checks passed at 320, 390, 1440px.
- Browser enforcement of CSP was proved with a blocked undeclared connection;
  normal interactions ran offline without external requests or browser errors.
- Visual review covered desktop/mobile. The narrow layout now lets the page
  scroll rather than squeezing the app into a short nested panel.
- The documentation site consumes the packed public entries and independently
  passes production iframe, replay, failed-tool, theme, keyboard and layout
  checks. It adds no private import or runtime dependency to the core package.
- No publication or commit was performed. External host interoperability is
  not certified. Fullscreen is explicitly a non-modal CSS display mode.
