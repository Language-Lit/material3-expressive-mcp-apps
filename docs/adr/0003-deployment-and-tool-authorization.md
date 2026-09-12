# ADR 0003: Deployment service and explicit app tool authorization

Status: accepted
Date: 2026-09-12
Task: T04 (owner requested completing the remaining production work)

The browser package stays free of runtime dependencies and retains its three
export paths. A standalone service under deploy/sandbox is built separately,
with Node crypto signing short-lived launch tickets. It requires a fixed public
origin, trusted host origins and a secret. Host-issued tickets bound requested
resource CSP and permissions; the view receives an enforced sandbox response
header. Deployment configuration and issuing tickets after authenticated host
session checks remain inputs owned by the application. No login provider is
selected without knowing the target host.

McpAppFrame gains an onAuthorizeToolCall callback. App-originated tool calls are
denied unless it explicitly returns true, including after asynchronous approval.
Only hosts with that callback advertise serverTools. The SDK still routes and
validates protocol messages; the callback lets the owning application apply its
session/role policy and approval UI before the connected client executes a tool.
The playground allows only its read-only refresh tool. Server-side authorization
must still enforce the same policy for access from clients outside this frame.

Version 0.2.0 records the required proxy and explicit tool authorization as
breaking changes from 0.1.0. The release is tested against both declared React
majors and three browser engines. No claim of certification in every external
host or of deployment to an unspecified production account is made.
