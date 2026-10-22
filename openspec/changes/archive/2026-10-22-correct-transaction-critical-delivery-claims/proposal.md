# Transaction-critical delivery claims only what it checks: #859 and #860

## Why

Stage P run 4 (P-E, system ADR 0014) measured five gaps between what the Node binding's
`transaction_critical` delivery checks and what its results and declaration claim.

- **P-E-x2 (#859).** Two out-of-type values fail open:
  - a durability probe that resolves a truthy non-boolean (`1`, `"no"`);
  - a commit gate that resolves anything but `"declined"` (`undefined`, `"failed"`).

  Both continue to the durability point and settle `committed_and_durable`.
- **P-E-3a (#860).** A `not_committed` occurrence runs the commit gate and settles `committed_and_durable`, so the
  result claims a business commit the occurrence itself denies.
- **P-E-6c (#860).** Two `not_committed` occurrences sharing one transaction id run the commit gate twice.
- **P-E-8 (#860).** A handoff that fails after the gate ran is reported as `audit_durability_unreachable`, the
  same code as a failure before the commit, although `failsClosedBeforeCommit` is declared.
- **P-E-7 (#860).** Deduplication is per binding instance. Nothing says so.

The occurrences stay truthful, because the consumer reads `event.commit_state`. But a host reading the binding's
result or declaration is told things the binding never checked.

## What Changes

- **Probe and gate (#859).** `runTransactionPipeline` continues only when the durability probe returns exactly
  `true`, and when the commit gate returns exactly `"committed"`.
  - Any other probe value fails closed as `audit_durability_unreachable`.
  - `"declined"` keeps `business_commit_declined`.
  - Any other gate value fails closed with a new code, `business_commit_unconfirmed`.
- **Uncommitted occurrences (#860).** A `not_committed` occurrence is delivered **without a commit claim**: probe,
  then handoff, with the commit gate never run. It returns a new status, `durable_without_commit`. This also
  closes P-E-6c, because no `not_committed` occurrence reaches the gate.
- **Failure after the gate (#860).** A handoff that fails after the gate ran fails closed with a new code,
  `audit_durability_failed_after_commit`.
- **Documentation (#860):**
  - the binding provides no business/audit atomicity and no persistent retry;
  - it deduplicates only within one binding instance;
  - `failsClosedBeforeCommit` covers failures before the commit gate runs.

  The documentation goes in the source, the Node README, the Node glossary ("Commit claim") and a new
  ADR-NODE-005. The consumer integration profile's "Commit evidence" paragraph, which this change makes false,
  is rewritten.
- **Spec deltas:**
  - two `security-audit-sdk-node` requirements are MODIFIED;
  - one `fraud-evidence-profile` requirement is MODIFIED, because its scenario describes the behaviour this
    change removes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`:
  - "Transaction-critical delivery orders durability after the business commit and fails closed before it" gains
    out-of-type, uncommitted-occurrence and after-commit scenarios.
  - "Transaction-critical deduplication is keyed on event identity and transaction identity together" states the
    per-instance scope.
- `fraud-evidence-profile`: "Delivery results are not commit evidence" keeps its requirement. Its scenario no
  longer depends on the binding reporting `committed_and_durable` for a `not_committed` occurrence.

## Impact

- **Classification.** A non-breaking `fix(sdk-node)`. Both packages are private and never published.
- **API surface.** `DeliveryClassRefusalCode` gains two literals, and `TransactionCriticalDeliveryResult` gains
  one status. No export is added, removed or renamed, so the frozen counts stay at 19 value and 44 type-only
  exports. `compatibility.json` records the widening as a `freezeRecord` amendment.
- **Hosts.** Hosts that switch exhaustively over the status or the code get a compile-time prompt to handle the new
  values. The README carries a migration note for them.
- **Unchanged:**
  - commit states other than `not_committed`;
  - `best_effort` and `policy_critical`;
  - the guarantees object's shape;
  - the contract, generated artifacts and the collector.

## Decided authority

Decision source: owner decision, 2026-10-22, via AskUserQuestion and grilling in Claude Code session
https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay. The owner accepted every recommended option.

- #859 triage: https://github.com/nandohdc/bloodtrail/issues/859#issuecomment-6346902874
- #860 triage: https://github.com/nandohdc/bloodtrail/issues/860#issuecomment-6346904157
- Authoring lane and merges (G45): https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049

## Non-goals

- No judgement of `committed`, `partially_committed`, `compensated` or `not_applicable` occurrences at delivery
  time.
- No persistent or cross-instance deduplication.
- No outbox, no persistent retry and no `security_significant` binding (G4; Stage 2 #833 measures the host
  composition).
- No change to the guarantees type, the contract, generated code, the collector or the core SDK.
