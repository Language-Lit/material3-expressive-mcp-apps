# ADR 0002: Required web proxy and graceful lifecycle

Status: accepted
Date: 2026-09-12
Task: T03 (owner authorized fixing the audited defects)
Supersedes ADR 0001's optional proxy behavior.

Browser embedding requires an HTTP(S) sandboxUrl on an origin different from
window.location.origin. Missing, opaque and same-origin URLs fail before loading
resource content. The outer iframe always uses allow-scripts allow-same-origin
allow-forms; the sandbox prop controls only the inner view. Custom transports
remain available for native/non-browser hosts and protocol tests; they own their
embedding policy. No runtime dependency or public export path changes.

The playground provides a two-origin proxy fixture, including CSP enforcement
and message source/origin checks. Deploying and trusting a production proxy
remains the host's responsibility.

Controlled display-mode replies report the mode committed by React, including
when the owner refuses or defers a requested transition.

Setting active=false or receiving an app teardown request stops new app requests,
sends resource-teardown, waits at most one second, then disconnects and clears the
iframe. Resource replacement waits for the same bounded cleanup before loading.
Immediate React unmount sends teardown from layout cleanup before DOM removal,
but React cannot wait for its acknowledgement; hosts needing graceful persistence
set active=false and wait for closed before unmounting. Closed means disconnected.

Document theme follows the resolved Material provider color mode, including
explicit light/dark/system overrides, and restores previous document attributes
when disabled or unmounted.
