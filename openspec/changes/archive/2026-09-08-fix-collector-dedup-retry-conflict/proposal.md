## Why

The delivery-conformance-contract requires every retry of one occurrence to advance a zero-based `correlation.retry_attempt` in the wire body (#104), but the collector's deduplication ledger currently treats any byte difference between a retained body and a resubmission as a security-relevant conflict (#107/#108). Combined, a genuine retry of an already-admitted occurrence — the exact case at-least-once dedup exists for — is misclassified as a conflict, and the producer's own retry module reports a permanently failed delivery for an event that was actually admitted exactly once. Filed and reproduced in #391; it blocks #109 (verify the end-to-end delivery vertical slice) from a clean pass.

## What Changes

- The collector derives its per-identity deduplication key from a canonical projection of the submitted body that excludes the attempt-scoped `correlation.retry_attempt` field, instead of the raw byte-exact body. Every other field remains part of an exact structural comparison — no fingerprint or hash is introduced, preserving the collision-avoidance rationale already recorded for #108.
- `openspec/specs/security-audit-collector/spec.md` is updated so its "duplicate identity and retention" and "duplicate and conflicting reuse" requirements state the canonical-key comparison basis precisely, replacing "byte-exact" / "differs by any byte" wording that is no longer accurate once an attempt-scoped field is excluded by design.
- A new scenario proves the regression fix (same `event.id`, differing only in `correlation.retry_attempt`, is a duplicate). The existing conflict scenario is tightened to state explicitly that it covers a difference in a field *other than* `correlation.retry_attempt` — the null control that proves the key is not over-widened to swallow genuine conflicts.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `security-audit-collector`: the duplicate-identity retention requirement and the duplicate-vs-conflict requirement change their comparison basis from raw byte-exact equality to a canonical deduplication key that excludes `correlation.retry_attempt`; the ingress-order requirement's description of what the deduplication stage receives is updated to match.

## Impact

- `packages/security-audit-collector/src/ingress.ts`: derive and pass a canonical deduplication key instead of the raw submission body.
- `packages/security-audit-collector/tests/ingress.test.ts`: new regression test (retry-only-attempt-advance is a duplicate) plus a tightened assertion on the existing conflict test.
- No change to `packages/security-audit-collector/src/deduplication.ts` — the ledger stays a generic exact-string comparator; only what `ingress.ts` hands it changes.
- No change to the delivery-conformance-contract, the frozen event contract, or any producer code (`security-audit-sdk-node`) — `correlation.retry_attempt` continues to be emitted exactly as #104 requires.
- Does not cross the repository's authorization boundary: the collector is already-authorized, already-merged Wave 4 work (#107/#108); this corrects its implementation to match the delivery-conformance-contract's own already-ratified dedup intent, and adds no new transport, storage, or production capability.
