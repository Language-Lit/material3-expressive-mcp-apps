# Standalone sandbox service

This service runs on a separate origin from the application. It requires signed,
short-lived host launch tickets, limits each resource to the ticket's approved
CSP and permissions, and serves app HTML once with CSP and sandbox HTTP headers.
The runtime uses Node built-ins only. The npm browser package does not include
this service; build it from this repository.

## Build and run

From the repository root:

```sh
npm ci
npm run sandbox:build
docker build -f deploy/sandbox/Dockerfile -t m3e-mcp-sandbox:0.2.0 .
npm run test:sandbox
docker run --rm --env-file /secure/path/sandbox.env -p 8080:8080 m3e-mcp-sandbox:0.2.0
```

Configure these values in the hosting platform's secret/environment settings:

- `SANDBOX_ORIGIN`: the exact external HTTPS origin, e.g. `https://sandbox.example.com`.
- `HOST_ORIGINS`: comma-separated exact application origins allowed to embed it.
- `SANDBOX_SECRET`: at least 32 random bytes, shared only with the host backend.
- `PORT`: optional, defaults to 8080.

Use a dedicated origin without application cookies. Terminate TLS at your
hosting platform or reverse proxy. The service uses the configured public origin,
not forwarded headers, when validating browser requests. HTTP is accepted only
for loopback local development. Resource storage is in memory, bounded to 32
pending views of at most 8 MiB, expires after 60 seconds and is single-use. Use
one instance or sticky routing for the proxy's POST and subsequent iframe GET.
Restarting drops pending views; the host can reopen the app.

## Connect an authenticated host

On the host **backend**, after checking the current session and authorizing the
resource for that user, issue a ticket using the generated helper:

```js
import { issueSandboxTicket } from './ticket.mjs';

const ticket = issueSandboxTicket({
  hostOrigin: 'https://app.example.com',
  expiresAt: Date.now() + 60_000,
  csp: { connectDomains: ['https://api.example.com'] },
  permissions: {},
}, process.env.SANDBOX_SECRET);

const sandboxUrl = new URL('https://sandbox.example.com/sandbox.html');
sandboxUrl.searchParams.set('hostOrigin', 'https://app.example.com');
sandboxUrl.searchParams.set('ticket', ticket);
// Return sandboxUrl.href to the authorized user's host page.
```

Copy `deploy/sandbox/dist/ticket.mjs` into that backend's build or use the source
helper there. Never place the signing secret or ticket-issuing endpoint without
session authorization in browser code. Ticket expiry must be at most five
minutes. The host refreshes the URL when opening a new app after expiry. Treat
launch URLs as bearer credentials; redact their query strings from access logs.
The service sends `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.

Ticket CSP lists are exact allowlists for resource-requested policy strings;
the service denies escalation. Permissions omitted from a ticket are denied.
The production service forces `allow-scripts allow-forms` on the inner view and
does not accept an `allow-same-origin` override.

Pass the URL to `McpAppFrame`. Also supply `onAuthorizeToolCall` to check the
current user's tool permissions and await any approval before returning `true`.
Without that callback, app-originated server tools are denied. Enforce the same
permissions on the MCP server; browser checks do not replace server authorization.

The deployment platform/domain and the host's login/approval implementation are
configuration inputs. This repository supplies the service and authorization
hooks; it does not create users or choose a login provider on the owner's behalf.
