## Why

The delivery conformance contract (#102) defines the finite delivery states and observable transitions every conforming implementation must satisfy, but no independently packaged implementation exists. #103 starts the delivery vertical slice with one concrete, deterministic transport handoff in the provisional Node binding: request creation, stable attempt identity, acknowledgment classification, and retryable/non-retryable mapping for a single attempt. Retry scheduling (#104), backpressure (#105), and shutdown draining (#106) build on this state machine.

## What Changes

- Add a `delivery` module to `@bloodtrail/security-audit-sdk-node` implementing the single-attempt HTTP handoff state machine: admitted → attempting → (`acknowledged` | `retryable` | `non_retryable` | `protocol_error`).
- Create requests as pure bounded descriptors (method, path, closed headers, size-bounded serialized event body); the module never opens a socket. The actual exchange is an injected `HttpExchange` port returning a closed outcome union (`response`, `timeout`, `transport_failure`), so tests run without live network access and the package keeps its approved platform-coupling allowlist unchanged (no `node:http`, no host `fetch`).
- Classify acknowledgments fail-closed: only a well-formed acceptance records `acknowledged`; a malformed or ambiguous acknowledgment terminates in `protocol_error`, distinct from `non_retryable`; retryable responses, timeouts, and transport failures map to `retryable` with no delivery claim.
- Keep attempt identity stable: every attempt of one occurrence carries the identical `event.id` and a zero-based attempt ordinal, per the conformance contract. No retry budget, jitter, queue, capacity bound, shutdown deadline, or exactly-once claim is introduced; those belong to #104–#106 and are explicitly out of scope here.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: specify the single-attempt HTTP handoff state machine, its injected exchange port, acknowledgment classification, stable attempt identity, and fail-closed outcomes.

## Impact

- `packages/security-audit-sdk-node/src/`, `tests/`, and `README.md` gain the delivery module, deterministic fake-exchange tests, and boundary documentation.
- `openspec/specs/security-audit-sdk-node/spec.md` gains the handoff requirements on fold. The platform-neutral core, the frozen contract, the collector package, the platform-coupling policy allowlists, and CI topology remain untouched.
- The change remains synthetic and non-production: it authorizes no production delivery infrastructure, real-user processing, or exactly-once claim.

## Authorization boundary

The owner away-window instruction authorizes implementation, PR creation, and administrative merge only after exact-head CI has no failures. #102 is closed and its contract is folded into the canonical `delivery-conformance-contract` spec; #87 landed the provisional Node binding; both #103 dependencies are satisfied. This change authorizes neither retry scheduling, backpressure, shutdown behavior, collector validation, storage, nor any production deployment.
