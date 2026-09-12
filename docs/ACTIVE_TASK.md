# Active task

## T03 — Fix audit findings

Status: complete
Completed: 2026-09-12
Approved: 2026-09-12 (owner requested all audited issues be fixed)

### Scope

Require a separate-origin proxy for browser embedding; add a working two-origin
playground fixture. Correct controlled display-mode responses, graceful resource
teardown, post-close access, and document color-mode overrides. Add regression
and browser coverage and update the compatibility contract. No publication,
commit, runtime dependency, or public export-path changes.

### Acceptance

- Regression tests for each audited defect, including refused controlled modes,
  teardown acknowledgement/timeout/replacement/unmount, and closed tool access.
- Production browser checks through a separate-origin proxy, CSP, modes and themes.
- `npm run verify` and `npm run playground:build` pass.


### Verification record

- `npm run verify` passed: 7 test files, 59 tests, types, distributable build,
  and package contract checks. No runtime dependency or public path changed.
- `npm run playground:build` passed and regenerated app/proxy artifacts.
- Production Chromium audit passed through a separate-origin proxy: handshake,
  tools, callbacks, modes preserving state, light/dark at 320/390/1440px,
  CSP response header and blocked undeclared connection, graceful close/reopen.
- Visual review passed on mobile and desktop; screenshots disable transitions
  so the captured theme is the completed state rather than an intermediate frame.
- Added regression coverage for refused/accepted controlled modes, teardown
  acknowledgement/timeout/resource replacement/immediate unmount, blocked calls
  while closing and after close, invalid proxy URLs, origin/window validation,
  and forced light/dark/system document colors with restoration.
- Migration: browser consumers supply sandboxUrl; hosts use active=false and
  wait for closed before unmounting when acknowledgement is needed. Immediate
  React unmount can only send a best-effort teardown request before DOM removal.
- React 18, other browser engines and external-host interoperability were not
  newly verified. The two-origin proxy is a local deployment fixture, not a
  production service. Authentication and host policy remain owner responsibilities.
- No publication or commit was performed.

---

## T02 — Publish 0.1.0 to npm

Status: complete
Completed: 2026-09-12
Approved: 2026-09-12 (owner requested npm publication before pushing)

### Scope and expected files

Publish the existing 0.1.0 public package to npm with public access and the
latest tag. Update README installation instructions, specification release
status and this task record. No API or implementation change; no Git push.

### Acceptance checks

- Aggregate verification and production playground build pass.
- Inspect the packed artifact and publish that exact tarball.
- Registry version, exports, peers and integrity match the release artifact.
- Install the registry release in a clean consumer without legacy peer bypass.

### Release evidence

- Published `@language-lit/material3-expressive-mcp-apps@0.1.0` with public
  access on 2026-09-12 after owner npm browser authentication.
- `npm run verify` passed all 42 tests, types, build and package guard;
  `npm run playground:build` passed. No runtime implementation changed.
- Published the inspected 13-file tarball (45,599 bytes), SHA-1
  `9923db96da67b500e74f13f4e9a39a3b03def4d6`. Downloading it from npm produced
  byte-identical content; registry exports and dependencies match the contract.
- The release artifact installed with strict peer resolution in an isolated
  consumer. Both JS entries imported and the CSS export resolved successfully.
- Registry version and tarball are live, access is public, and `latest` points
  to 0.1.0. Package-name metadata took several minutes to propagate.
- Installing by package name and then running clean `npm ci` with strict peer
  resolution passed. The lockfile resolves the npm registry tarball; host/app
  imports and CSS resolution pass. The consumer audit reports zero vulnerabilities.
- No Git commit, tag, push or website deployment was performed by this task.

---

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
