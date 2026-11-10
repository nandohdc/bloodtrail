# Proposal

## Why

The Node binding's `transaction_critical` delivery has no stated route for making an audit record durable after
the business commit already ran (#870). `deliver(event, transactionId, commitGate)` always runs the durability
probe, then the commit gate, then the handoff. A pair that failed closed stays deliverable, so offering it again
after `audit_durability_failed_after_commit` or `business_commit_unconfirmed` runs the commit gate again. On
2026-11-07 a repro against the built binding showed that a gate which commits every time it runs commits the
business change twice. The same repro showed that a gate which checks the transaction first commits it once and
still makes the record durable.

Nothing in the specification, the documentation or the tests states either fact. The README and ADR-NODE-005 only
point at #870. The owner settled the resolution in the #870 triage
(https://github.com/nandohdc/bloodtrail/issues/870#issuecomment-6729305414). The fix is documentation, a
specification change and tests, with no new recovery API (the 10-26 plan's §E, reaffirmed by the owner on 10-27),
and the route is a reconciling commit gate.

## What Changes

- **The binding's behaviour is pinned, not changed.** The `security-audit-sdk-node` deduplication requirement
  gains a scenario. When a pair that failed closed after the commit gate ran is offered again, the durability probe
  and the commit gate run again.
- **The host's redelivery obligation is stated.** `fraud-evidence-profile` gains a requirement for a host that
  offers such a pair again: it supplies a **reconciling commit gate**, one that confirms an already-committed
  business change instead of committing it again. The requirement fixes what the gate returns:
  - `committed` only once the change is confirmed committed;
  - `declined` when the change has not committed and will not be;
  - a rejection when the gate cannot tell.

  The host builds the gate for one transaction identifier on each delivery. The host limits how many times it redelivers
  one pair, and alerts while the record of a committed change is still not durable. Crash recovery stays with the
  host's own durable record (G5).
- **Tests** through the public binding cover four cases:
  - **(A)** the gate runs again after `audit_durability_failed_after_commit`;
  - **(B)** the gate runs again after `business_commit_unconfirmed`;
  - **(C)** a reconciling gate commits once and the record still becomes durable;
  - two occurrences that share a transaction identifier commit once.
- **Documentation:**
  - a README subsection on redelivering after a failure following the commit, replacing the line that only points
    at #870;
  - the consumer integration profile's "Persistence" bullet;
  - the glossary term "Reconciling commit gate";
  - ADR-NODE-006, and a pointer from ADR-NODE-005's #870 known limit.
- **Unchanged:**
  - every export: `test:exports` stays at 19 value and 44 type-only exports;
  - `deliver()` behaviour and the binding's source;
  - `compatibility.json`;
  - the contract, which is frozen at 2.1.0;
  - ADR 0015.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: "Transaction-critical deduplication is keyed on event identity and transaction
  identity together" gains a scenario for a redelivery after a failure following the commit. Its other text is
  unchanged.
- `fraud-evidence-profile`: ADDED "Host redelivery after a failure following the commit", which states the
  reconciling commit gate the host supplies, the redelivery bound and alert, and crash recovery through the host's
  own durable record.

## Impact

- **Code:** no change to the binding's source.
- **Tests:** new cases in the Node binding's transaction-critical claims tests.
- **Documentation:**
  - the Node binding's README, `CONTEXT.md` and ADRs (a new ADR-NODE-006, and a pointer in ADR-NODE-005);
  - `docs/fraud-evidence/consumer-integration-profile.md`.
- **Hosts:** a host that redelivers after a failure following the commit must use a reconciling commit gate. A host
  whose gate commits on every call risks committing the business change twice. That is true today, and it is now
  stated.
- **Out of scope:**
  - a `redeliver()`-style export;
  - any outbox, queue, storage or persistent retry in the binding;
  - deduplication across binding instances;
  - #921, #913 and #932.
