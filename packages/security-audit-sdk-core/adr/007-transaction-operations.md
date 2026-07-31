# ADR-SDK-007: Transaction-aware operations

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

An operation handle owns immutable IDs and a private monotonic state: `started` may become `committed`, `not_committed`, or `partially_committed`; `committed` may become `compensated`. Success that requires committed state is rejected before sink invocation until a trusted application boundary marks commit. Authorization decision and business outcome remain distinct. Re-execution creates a new event ID linked to original identity; pure redelivery preserves the immutable event ID. Asynchronous completion requires cataloged causation.

The handle does not introspect databases and provides no outbox, atomicity, retry, or delivery claim.
