# ADR-SDK-006: Initialization, lifecycle, and sink behavior

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

`createSecurityAuditSdk` validates, clones, and freezes configuration and returns a ready instance. State transitions are `ready -> shutting_down -> shut_down`; invalid configuration never creates an instance. Shutdown establishes a no-new-emission boundary, waits up to an immutable configurable timeout (default 5 seconds), calls optional `flush` then `shutdown` at most once, and returns bounded unknown results for unresolved work. Concurrent shutdown callers share the in-progress result; after shutdown completes, emission, flush, and repeated shutdown return `SDK_SHUT_DOWN` without invoking the sink again.

`AuditEventSink.emit` receives one immutable validated event and returns accepted, rejected, or unknown. The SDK supplies no retry, buffer, queue, durability, or universal fail-open/fail-closed behavior. Only in-memory and capturing test sinks are included. Console/file and production sinks are excluded.
