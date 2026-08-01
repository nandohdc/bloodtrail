# ADR-SDK-007: Transaction-aware operations

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

An operation handle is opaque at the public named-method boundary. Each SDK instance owns a private weak identity map that binds the exact issued handle to immutable operation, transaction, correlation, and allowed-event identity plus private monotonic state. `started` may become `committed`, `not_committed`, or `partially_committed`; `committed` may become `compensated`. Only sanctioned handle methods mutate that private state. Snapshots are immutable observational `GeneratedOperationContext` values and never carry authority back into named construction. Plain, copied, spread, cloned, serialized, modified, fake, and foreign-instance values are rejected before sink invocation.

Success that requires committed state is rejected before sink invocation until a trusted application boundary marks commit. A private event binding cannot be removed or reassigned through caller data. Authorization decision and business outcome remain distinct. Re-execution creates a new event ID linked to original identity; pure redelivery preserves the immutable event ID. Asynchronous completion requires cataloged causation. Generic complete-event APIs remain a trusted-producer boundary and do not prove application truthfulness.

The handle does not introspect databases and provides no outbox, atomicity, retry, or delivery claim.
