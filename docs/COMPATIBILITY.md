# Compatibility verification — 0.2.0

Verified locally on 2026-09-12, macOS arm64, Node 26.7.0. Browser automation uses
Playwright Core 1.62.1. The standalone Docker service was also built and tested
on its Node 24 Linux arm64 image.

| React / React DOM | Types, 69 tests, package build | Chromium 153.0.8010.36 | Firefox 153.0 | WebKit 26.5 |
| --- | --- | --- | --- | --- |
| 18.3.1 | Passed | Passed | Passed | Passed |
| 19.3.0 | Passed | Passed | Passed | Passed |

Each browser run uses the production playground through a separate-origin
proxy with signed launch authorization and CSP response headers. It covers
initialization, host input/results, app-to-server tools, message/model-context
callbacks, fullscreen/pip state preservation, closing/reopening, undeclared
connection blocking, and light/dark layout at 320, 390 and 1440 pixels.
Representative Firefox mobile and WebKit desktop screenshots were visually
reviewed. Screenshot capture finishes CSS transitions before recording images.

The React 18 run installs React, React DOM and React 18 types into an isolated
copy of the repository with strict peer resolution. It does not downgrade the
working tree. Expected exception output from the outside-provider negative test
on React 18 is not an application failure; all 69 tests pass.

Protocol tests also connect the provider to a plain-JSON host and the frame to
a plain-JSON app, independently of the ext-apps App/AppBridge implementation on
the other side. They cover handshake, tool input/results, controlled mode refusal
and teardown. This proves those exchanges work beyond a matched pair of the
SDK wrappers, but is not certification inside a named third-party host.

The SDK/client version is 2.0.0 and the Material package is 1.2.2. Browser targets
in browser-support.json remain compilation/support targets; this run does not
claim testing every minimum browser version, a physical iPhone, or Safari's
branded application. WebKit is the engine used for Safari-related coverage.

Firefox exposed an import-time Zod eval probe before the SDK constructor could
switch it off. The fixture now sets public Zod jitless configuration in a
preserved side-effect module before schema imports; CSP remains unchanged and
unsafe-eval remains prohibited. Browser assertions allow only the diagnostic
from the explicitly injected blocked-connection test, not other CSP errors.

## Reproduce

```sh
npm ci
npm run verify
npm run playground:build
npx playwright-core install chromium firefox webkit
npm run test:browser
M3E_BROWSER=firefox npm run test:browser
M3E_BROWSER=webkit npm run test:browser
npm run test:react18
npm run sandbox:build
docker build -f deploy/sandbox/Dockerfile -t m3e-mcp-sandbox:0.2.0 .
npm run test:sandbox
```

M3E_CHROMIUM_PATH may select a system Chromium/Chrome executable. The other
engines use the versions installed for Playwright Core. React 18 and screenshot
artifacts are retained in temporary directories printed by the runners.
