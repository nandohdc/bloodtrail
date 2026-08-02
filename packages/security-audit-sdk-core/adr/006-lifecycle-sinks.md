# ADR-SDK-006: Initialization, lifecycle, and sink behavior

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

`createSecurityAuditSdk` validates configuration, field-specifically copies SDK-owned value data, shallow-freezes the SDK-created normalized envelope, and returns a ready instance. Injected sinks, clocks, identifier providers, and transformation hooks are dependency-injected capability objects: the SDK retains exact references and never clones, binds, proxies, recursively freezes, or mutates them or their nested state. Transformation registration metadata is copied into SDK-owned immutable descriptors, while invocation targets the original hook object and preserves its receiver. This ownership-boundary plus shallow-immutable-configuration design is preferred over a facade, adapter, generalized defensive clone, or proxy because no wrapper is required and those alternatives risk identity, private-field, method, and debugging semantics.

State transitions are `ready -> shutting_down -> shut_down`; invalid configuration never creates an instance. Shutdown establishes a no-new-emission boundary, waits up to an immutable configurable timeout (default 5 seconds), calls optional `flush` then `shutdown` at most once, and returns bounded unknown results for unresolved work. Concurrent shutdown callers share the in-progress result; after shutdown completes, emission, flush, and repeated shutdown return `SDK_SHUT_DOWN` without invoking the sink again.

`AuditEventSink.emit` receives one immutable validated event and returns accepted, rejected, or unknown. The SDK supplies no retry, buffer, queue, durability, or universal fail-open/fail-closed behavior. Only in-memory and capturing test sinks are included. Console/file and production sinks are excluded.

The sink's queues, maps, counters, lifecycle state, and concurrency safety remain caller-owned. Configuration immutability is not ownership transfer, and callers remain responsible for any freezing or non-extensibility they impose before injection.
