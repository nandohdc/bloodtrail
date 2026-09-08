## Why

The Node delivery path has no governed shutdown protocol: nothing stops admitting new work when the process is stopping, and nothing bounds how long shutdown waits for in-flight deliveries before giving up. Issue #106 requires a deterministic admission boundary plus a deadline-bounded drain with exact accounting, as pre-approved execution work under PLAN-052, composing with the existing retry (#104) and backpressure (#105) modules.

## What Changes

- Add `createDeliveryShutdown`, a new module that gates admission to any injected async delivery operation with a lifecycle boundary: `submit()` admits and tracks the operation while the module is running, and rejects immediately and synchronously with `rejected_shutting_down` once `shutdown()` has been called — no gap in which a concurrent submission could sneak past the boundary.
- `shutdown()` stops admitting new work immediately, then races draining every currently in-flight operation against a configured deadline (using the injected timer provider, mirroring the existing `createShutdownTimeout` pattern in `security-audit-sdk-core`'s SDK shutdown). It returns an exact `{ accepted, completed, abandoned }` report.
- `shutdown()` is idempotent: repeated calls return the same report without re-draining or double-counting.
- Deadline expiry marks whatever is still outstanding as `abandoned` (counted, never reported delivered) without attempting to forcibly cancel the caller-supplied operation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: gains a new requirement for deadline-bounded delivery shutdown, composing with (but independent of) the existing single-attempt handoff, retry-scheduling, and backpressure requirements.

## Impact

- `packages/security-audit-sdk-node/src/delivery-shutdown.ts` (new)
- `packages/security-audit-sdk-node/src/index.ts` (exports)
- `packages/security-audit-sdk-node/tests/delivery-shutdown.test.ts` (new)
- `packages/security-audit-sdk-node/README.md`
- `openspec/specs/security-audit-sdk-node/spec.md`
