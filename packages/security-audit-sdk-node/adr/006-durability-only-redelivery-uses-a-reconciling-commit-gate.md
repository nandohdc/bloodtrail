# ADR-NODE-006: A durability-only redelivery uses a reconciling commit gate

- Status: Accepted for SDK-node implementation
- Date: 2026-11-07
- Decision source: owner decision, 2026-11-07, in the #870 triage grilling in Claude Code, accepting every
  recommended option. The decisions are recorded at
  https://github.com/nandohdc/bloodtrail/issues/870#issuecomment-6729305414. This ADR is accepted when the
  OpenSpec change `document-transaction-critical-redelivery` merges.

## Context

ADR-NODE-005 left one known limit open (#870). After `audit_durability_failed_after_commit` or
`business_commit_unconfirmed`, nothing stated how a host makes the audit record durable without committing the
business change again.

`createTransactionCriticalDelivery(...).deliver(event, transactionId, commitGate)` runs the durability probe,
then the commit gate, then the handoff. Only a pair that reached durability is recorded for deduplication, so a
pair that failed closed runs in full when it is offered again. A repro against the built binding on 2026-11-07
showed:

| Case | Observed |
|---|---|
| The handoff fails after the gate committed, and the gate commits every time it runs | two business commits |
| The gate rejects once | the gate ran twice |
| As the first case, but the gate checks the transaction before committing | one business commit, and the record became durable |
| The same pair through a second binding instance | the gate ran twice |

The binding cannot tell a gate that reconciles from one that commits every time it runs, so the host's gate alone
decides whether a second call commits twice.

The 10-26 plan's §E (`docs/plans/open-issues-implementation-plan.md`) asked for a documentation and
specification resolution using host-owned outbox recovery, explaining why calling `deliver()` again is not a
durability-only retry, and for no new recovery API. The third case shows that, with a reconciling gate, calling
`deliver()` again is one. On 2026-11-07 the owner therefore revised §E's explanation into the condition this ADR
records, and kept its "no new recovery API".

## Decision

**Calling `deliver()` again is the durability-only redelivery when the host supplies a reconciling commit gate.**
No export is added, and the binding's behaviour and source are unchanged. For one transaction, a reconciling
commit gate:
- returns `"committed"` only for a business change it confirms committed, whether it commits the change on that
  call or finds it already committed, and never commits the change twice;
- returns `"declined"` for a change that has not committed and will not be, so that record never becomes durable;
- rejects when it cannot tell, so the binding reports `business_commit_unconfirmed` again.

**The gate is built for one transaction identifier.** `BusinessCommitGate` takes no arguments, so the host
builds the gate on each delivery by closing over the transaction identifier. A gate keyed on the event identifier
would still commit twice for two occurrences that share one transaction.

**The host carries the rest.** It bounds the redeliveries of one pair, and alerts while a committed change's
record is not durable, which is the `transaction_critical` row's backlog alert after commit. Surviving a crash
needs the occurrence in the host's own durable store (G5), because the binding holds nothing durable.

**Where each statement lives:**
- the binding's behaviour, as a scenario under the `security-audit-sdk-node` deduplication requirement: a
  redelivery runs the probe and, once the probe confirms, the commit gate again;
- the host's obligations, as the `fraud-evidence-profile` requirement "Host redelivery after a failure following
  the commit";
- guidance, in the README subsection "Redelivering after a failure following the commit" and the consumer
  integration profile's "Persistence" bullet;
- vocabulary, as the glossary term "Reconciling commit gate".

The transaction-critical claims tests pin the rerun and the reconciling route. Each was shown to fail against a
planted binding defect.

## Alternatives rejected

- **Outbox only**, as §E first worded it. The documentation would say that calling `deliver()` again is never
  a durability-only redelivery, and that the host relays the record from its own outbox. Stated without its
  condition, that is
  false: the third case shows a reconciling gate committing once and reaching durability. It would also leave a
  host without an outbox a choice between a second commit and a path the `transaction_critical` row does not
  govern.
- **The binding remembers committed pairs and skips the gate.** This changes `deliver()` behaviour, beyond a
  documentation and specification resolution. It would also hold inside one binding instance only, so a restarted
  host would still need a reconciling gate.
- **A `redeliver()` export.** The 10-26 plan's §E rules out a new recovery API. The export would widen the frozen
  surface (ADR-NODE-001), and without persistence in the binding it could not survive a crash either.

## Consequences

- A host whose gate commits every time it runs commits the business change twice on redelivery. The binding
  cannot detect this, so the README, the profile requirement and this ADR state it, and a test demonstrates it.
- A host whose gate already reconciles needs no change.
- The obligation lives in `fraud-evidence-profile`, though it applies to any host of the binding, following the
  precedent of "Host-composed audit atomicity". The README states it for every host.

## What changed in the surface

Nothing. No export is added, removed or renamed, `npm run test:exports` stays at 19 value and 44 type-only
exports, and `compatibility.json` is unchanged.

## Reversal

The change is documentation, specification and tests only, so reverting it removes them and changes no
behaviour. Reverting reopens #870's gap: hosts would again have no stated route to durability after a commit.
