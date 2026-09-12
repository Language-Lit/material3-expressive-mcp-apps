# Active task

## T05 — 0.2.1 core prerelease compatibility

Status: complete
Approved: 2026-09-12 (owner requested deployment of the current documentation
site, which must install with the published `1.3.0-rc.1` core candidate.)
Completed: 2026-09-12

### Scope

Publish a peer-range-only patch allowing the current core prerelease line,
`>=1.3.0-rc.1 <1.4.0`. Update package and lockfile versions, the release status,
and this record. Verify package behavior and strict peer resolution; no API,
implementation, or runtime dependency changes are included.

### Acceptance

- `npm run verify` and `npm run playground:build` pass at `0.2.1`.
- npm publishes `0.2.1` with the expanded core peer range.
- A strict site install resolves core `1.3.0-rc.1` and all three companions.

### Verification record

- `npm run verify` passed: 9 test files / 69 tests, typecheck, distributable
  build, package boundaries, and package identity; `npm run playground:build`
  also passed.
- npm published `@language-lit/material3-expressive-mcp-apps@0.2.1`; registry
  metadata exposes the expanded core peer range.
- The documentation site's strict lockfile resolves this release alongside
  core `1.3.0-rc.1`.


## T04 — Compatibility, release and deployment readiness

Status: complete for compatibility, release and local deployment readiness;
production deployment awaiting owner configuration
Approved: 2026-09-12 (owner instructed continuing the remaining work)

### Scope

Run and automate React 18/19 and Chromium/Firefox/WebKit verification; fix issues
found. Prepare and publish 0.2.0 with the prior audited fixes and migration notes.
Provide concrete deployment setup for the sandbox proxy and host authorization
integration where configuration is available. Production host/domain and access
rules are requested from the owner; do not invent credentials or deploy to an
unspecified service. No Git commit or push, no private-consumer inspection, and
no runtime dependency or public export-path changes.

### Acceptance

- Required verification and production build pass.
- Repeatable compatibility matrix and recorded versions/results.
- Inspect and test the packed release, publish that tarball, and verify registry
  integrity plus a clean consumer install.
- Test deployment artifacts locally; report any remaining external configuration.

### Verification and release evidence

- `npm run verify` passed: 69 tests in 9 files, types, distributable build and
  package contract checks. `npm run playground:build` passed.
- React 18.3.1 and 19.3.0 passed production browser checks in Chromium, Firefox
  and WebKit. Versions, limitations and repeatable commands are recorded in
  `docs/COMPATIBILITY.md`. Independent JSON-RPC peers exercise interoperability;
  this is not certification in a named external host.
- Tool calls require explicit host authorization and deny by default. The
  standalone sandbox service verifies signed grants, enforces granted CSP and
  permissions, and serves one-use resources. Docker build and real container
  smoke checks passed. Deployment instructions are in `deploy/sandbox/README.md`.
- Published `@language-lit/material3-expressive-mcp-apps@0.2.0` with public access
  after npm browser authentication. Registry `latest` is 0.2.0. The downloaded
  tarball is byte-identical to the inspected and tested 13-file, 52,585-byte
  artifact; SHA-1 `55f534d793d21255197a9e5f35a0407425de915c`.
- Fresh registry installs and clean `npm ci` passed with strict peers for both
  React versions. Host/app imports, CSS resolution and public types passed.
- Production deployment and login integration still require the owner's host
  URL, hosting platform, login provider and access rules. No external deployment,
  Git commit or push was performed. Fullscreen remains a documented non-modal
  CSS display mode; custom palettes require sharing the Material theme.

---

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
