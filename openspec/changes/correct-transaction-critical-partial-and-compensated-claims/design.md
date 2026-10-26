# Design: Correct transaction-critical delivery claims for partial and compensated occurrences

Decision source: agreed plan in `docs/plans/open-issues-implementation-plan.md` and owner direction via Q4 grilling.

## Context

See `proposal.md` - Why.
The single seam governing transaction-critical outcomes is `runTransactionPipeline` and `deliverWithCommit` in `packages/security-audit-sdk-node/src/delivery-classes.ts`.
Currently, `deliverWithCommit` returns `committed_and_durable` whenever the commit gate returns `"committed"` and durability is acknowledged, regardless of whether `event.commit_state` is `partially_committed` or `compensated`.

## Goals / Non-Goals

**Goals:**
- Provide truthful delivery outcomes for `partially_committed` and `compensated` occurrences: `partially_committed_and_durable` and `compensated_and_durable`.
- Retain the exact business commit gate execution: partial and compensated changes MUST still execute the gate and verify `"committed"`.
- Record both qualified durable outcomes as settled successes for in-memory deduplication.
- Retain existing failure handling (`business_commit_declined`, `business_commit_unconfirmed`, `audit_durability_failed_after_commit`).
- Preserve the frozen Node exports surface (#111) without bumping package version or adding runtime exports.

**Non-Goals:**
- Modifying the contract or Core schemas (the contract already allows `partially_committed` and `compensated` on specific transaction-critical events).
- Bypassing the commit gate for partial or compensated events (they represent transactions that did undergo a commit or compensation phase, unlike `not_committed` where no commit occurred).
- Adding multi-instance or cross-process deduplication (remains instance-local per existing design).

## Decisions

### Decision 1: Distinguish outcome at durability settlement in `deliverWithCommit`

In `deliverWithCommit`, determine the final status from `input.event.event.commit_state`:
- `commit_state === "partially_committed"` → `"partially_committed_and_durable"`
- `commit_state === "compensated"` → `"compensated_and_durable"`
- otherwise (`"committed"`) → `"committed_and_durable"`

*Rationale*: The commit gate must still verify that the host's partial or compensated transaction commit completed before audit durability is reached. Once acknowledged, the outcome reported to the caller truthfully matches what happened.

*Alternatives considered*:
- *Bypass commit gate like `not_committed`*: Rejected. A partial or compensated transaction involves real state mutation and commit coordination; bypassing the gate would fail to coordinate with the host's transactional boundary.
- *Use a single generic `qualified_commit_and_durable`*: Rejected. The catalog explicitly differentiates `partially_committed` from `compensated`; combining them discards valuable information.

### Decision 2: Include both new statuses in `reachedDurability`

Update `reachedDurability` to return `true` for `partially_committed_and_durable` and `compensated_and_durable`.

*Rationale*: Occurrences reaching acknowledged durability are settled and must be recorded in `settled` so subsequent attempts with the same `(event.id, transactionId)` are reported as `already_delivered`.

### Decision 3: Result union widening

Widen `TransactionCriticalDeliveryResult` with the two new readonly object shapes. This is a non-breaking union widening adhering to established repository precedent.

## Risks / Trade-offs

- **[Risk] Existing host code doing strict switch on `status === "committed_and_durable"`** → *Mitigation*: Widening the union is non-breaking at runtime; TypeScript exhaustiveness checks will alert consumers to handle the qualified outcomes when upgrading. Documentation notes will clearly describe migration.
- **[Risk] Frozen export check regression** → *Mitigation*: The change widens an existing exported type union without adding new runtime exports or changing export signatures, preserving frozen exports.
