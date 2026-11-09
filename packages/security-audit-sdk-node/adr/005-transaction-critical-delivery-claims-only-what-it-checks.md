# ADR-NODE-005: Transaction-critical delivery claims only what it checks

- Status: Accepted for SDK-node implementation
- Date: 2026-10-22
- Decision source: owner decision, 2026-10-22, via AskUserQuestion and grilling in Claude Code session
  https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay, recorded in the triage of #859 and #860. This ADR is
  accepted when the OpenSpec change `correct-transaction-critical-delivery-claims` merges.

## Context

Stage P run 4 (P-E, system ADR 0014) measured `createTransactionCriticalDelivery` claiming more than it checks.

- **Out-of-type values fail open (#859, P-E-x2).** A durability probe resolving a truthy non-boolean (`1`,
  `"no"`), or a commit gate resolving anything but `"declined"` (`undefined`, `"failed"`), continued to the
  durability point and settled `committed_and_durable`. The declared types exclude these values, but a
  JavaScript host, a cast or an `any` result still reaches the runtime check.
- **A commit claimed for an uncommitted occurrence (#860, P-E-3a).** A `not_committed` occurrence ran the commit
  gate and settled `committed_and_durable`. Two such occurrences sharing a transaction id ran the gate twice
  (P-E-6c).
- **One code for before and after the commit (#860, P-E-8).** A handoff that failed after the gate committed was
  reported as `audit_durability_unreachable`, the same code as a failure before the commit, while
  `failsClosedBeforeCommit` was declared.
- **Unstated scope (#860, P-E-7).** Deduplication is in memory per instance, and nothing said so.

The occurrences stayed truthful, because the consumer reads `event.commit_state`. The result and the declaration
did not.

## Decision

**Fail closed on anything the binding cannot confirm.** The probe and gate results are read as `unknown`, and a
rejection confirms no more than a wrong value does:
- **Probe:** only `true` continues; anything else, or a rejection, is `audit_durability_unreachable`, before the
  gate runs.
- **Gate:** only `"committed"` continues. `"declined"` keeps `business_commit_declined`, and anything else, or a
  rejection, is the new `business_commit_unconfirmed`, with the gate recorded as invoked.
- **Handoff:** a rejecting handoff counts as not acknowledged.

`deliver()` returns a result in every one of these cases and never rejects because of them.

**No commit claim for an uncommitted occurrence.** When the occurrence's commit state is `not_committed`, the
binding probes durability and hands the occurrence off but never runs the gate, and reports the new status
`durable_without_commit`. Denial records still reach durable delivery. The owner rejected refusing them, because
that would push them onto a path the class row does not govern. The pair is deduplicated like any delivery that
reached durability.

**Before and after the commit are distinct.** A handoff failure after the gate committed is the new
`audit_durability_failed_after_commit`. `failsClosedBeforeCommit` stays `true` and covers failures before the
gate runs. The shared `DeliveryClassGuarantees` type is unchanged, because a distinct code already carries the
difference.

**Stated limits.** The binding provides:
- no business and audit atomicity;
- no persistent retry (it makes one handoff attempt);
- no deduplication beyond one binding instance.

Hosts compose those themselves (G4, G5). Stage 2 (#833) measures the host-outbox composition.

**Unchanged:** every other commit state. The catalog's `transaction_critical` events normally arrive as
`committed`, before the gate runs.

**Known limits, filed separately:**
- `partially_committed` and `compensated` occurrences still receive a full commit claim (#869).
- No retry of durability alone exists after a commit. Calling `deliver()` again after
  `audit_durability_failed_after_commit` or `business_commit_unconfirmed` runs the gate again (#870).
  ADR-NODE-006 resolves this with a reconciling commit gate.

## What changed in the surface

No export is added, removed or renamed. `npm run test:exports` stays at 19 value and 44 type-only exports.

Two public unions widen:
- `DeliveryClassRefusalCode` gains `business_commit_unconfirmed` and `audit_durability_failed_after_commit`;
- `TransactionCriticalDeliveryResult` gains the `durable_without_commit` status.

`compatibility.json` records the widening as a `freezeRecord.amendments` entry with unchanged counts, as
ADR-NODE-001 requires a governed change to do. A host that switches exhaustively over the status or the code
gets a type error until it handles the new values. The README's migration note lists them.

## Reversal

Reverting means:
- restore the previous `runTransactionPipeline` and `deliver`;
- remove the three literals and the amendment;
- restore the two MODIFIED `security-audit-sdk-node` requirements and the `fraud-evidence-profile` scenario.

Reverting reopens #859's fail-open, which the `transaction_critical` row's fail posture forbids. Prefer
correcting forward.
