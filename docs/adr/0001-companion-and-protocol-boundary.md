# ADR 0001: Separate host and app entries

Status: accepted
Date: 2026-09-12
Task: T01

MCP Apps integration needs protocol peers that the Material core expressly
excludes. It lives in this companion with no core export or dependency change.
The root entry hosts applications through AppBridge. `./app` connects views
through App and keeps the host bridge out of the app import graph. Both use
the same Material public API and one namespaced stylesheet.

The protocol SDK owns transport, schemas, capabilities and proxy behavior.
The companion owns React lifetimes, Material composition, host style mapping,
and display layout. The iframe is never reparented, preserving app state.
Inline uses reported height; fullscreen and pip reposition its surrounding
surface. Fullscreen is not modal and does not claim modal focus semantics.

Direct resource HTML is parsed without executing it and serialized with a CSP
meta element before all app content. A separate-origin sandbox proxy can be
supplied when hosts require response-header policy. The host still owns trust,
authentication, allowed capabilities, tool approvals and proxy deployment.

Protocol style roles lack exact Material equivalents. Success/warning use
tertiary/secondary roles, mono is a system stack, border width is 1px, and
semibold uses Material medium. The provider follows host mode but does not
invent a Material palette from a small set of protocol colors. A shared
Material theme is an explicit provider input.
