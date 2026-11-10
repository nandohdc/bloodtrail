# Design: Document durability-only redelivery for transaction-critical delivery

Decision source: the owner, 2026-11-07, in the #870 triage grilling in Claude Code, accepting every recommended
option. The decisions and the agent brief are recorded at
https://github.com/nandohdc/bloodtrail/issues/870#issuecomment-6729305414. They keep the 10-26 plan's §E
(`docs/plans/open-issues-implementation-plan.md`), which the owner reaffirmed in the 10-27 re-plan: documentation
and specification only, with no new recovery API. That re-plan's record is not published in the repository, so §E
is the citable source. They revise one phrase of §E. Calling `deliver()` again *is* a durability-only redelivery
when the commit gate reconciles, so the documentation states that condition instead of saying it is never one.

## Context

See `proposal.md` - Why.

`createTransactionCriticalDelivery(...).deliver(event, transactionId, commitGate)` runs, in a fixed order:
1. the durability probe;
2. the business commit gate, unless the occurrence's commit state is `not_committed`;
3. the durability handoff.

Only a pair that reached durability is recorded for deduplication, so a pair that failed closed is attempted again
in full. On 2026-11-07, at `origin/main` `9f2ab64`, a scratch script ran against the built binding. A fresh
compile of the source was first checked byte-identical to the built JavaScript, with source maps and declaration
files excluded:

| Case | First `deliver()` | Second `deliver()` | Observed |
|---|---|---|---|
| A. The handoff fails after the gate committed; the gate commits every time it runs | `audit_durability_failed_after_commit` | `committed_and_durable` | two business commits |
| B. The gate rejects once | `business_commit_unconfirmed` | `committed_and_durable` | the gate ran twice |
| C. Same as A, but the gate checks the transaction first | `audit_durability_failed_after_commit` | `committed_and_durable` | one business commit, two handoff attempts |
| D. The same pair on a second binding instance | `committed_and_durable` | `committed_and_durable` | the gate ran twice (P-E-7 already covers this) |

The binding cannot tell a reconciling gate from one that commits every time it runs. Whether a second call commits
twice is therefore decided entirely by the host's gate.

## Goals / Non-Goals

**Goals:**
- Pin, in the specification and in tests, that a redelivery after a failure following the commit runs the commit
  gate again.
- State the host's obligation, a reconciling commit gate, and test that this route commits once.
- Make every statement about calling `deliver()` again true of the current binding.

**Non-Goals:**
- Any change to the binding's source. That includes the `BusinessCommitGate` doc comment, because the README carries
  the reconciling-gate contract for hosts.
- Any export, `compatibility.json` amendment or change to the frozen surface (#111).
- Persistence, an outbox, a queue or storage in the binding. The `security-audit-sdk-node` requirement
  "Implementing the remaining classes introduces no delivery substrate" forbids them.
- Deduplication across binding instances, and crash recovery inside the binding.
- The contract, which is frozen at 2.1.0, and ADR 0015, which records a point in time.

## Decisions

### Decision 1: The durability-only redelivery is `deliver()` with a reconciling commit gate

A host redelivers by calling `deliver()` again with a **reconciling commit gate**. For a transaction whose business
change already committed, that gate confirms the commit instead of committing again. Case C shows that this works on
the current binding.

*Alternatives considered:*
- *(a) Outbox only.* The documentation would say that calling `deliver()` again is not a durability-only
  redelivery, and that the host relays from its own outbox. Rejected for two reasons:
  - stated without a condition, that is false (case C);
  - it leaves a host without an outbox a choice between a second commit and a path the `transaction_critical` row
    does not govern. ADR-NODE-005 records the owner rejecting such a path for denial records.
- *(c) The binding remembers committed pairs and skips the gate.* Rejected:
  - it changes behaviour, beyond §E's "documentation and specification" scope;
  - it holds within one instance only, so a restart still needs a reconciling gate (case D).
- *A `redeliver()` export.* Rejected:
  - §E rules out any new recovery API;
  - the export would widen the frozen surface;
  - without persistence it could not survive a crash either.

### Decision 2: The gate recognises the transaction by its transaction identifier

A gate keyed on the event identifier would still commit twice when two occurrences share one transaction. A gate
keyed on the transaction identifier commits once whichever occurrence arrives first.

`BusinessCommitGate` is `() => Promise<"committed" | "declined">`, and the binding passes it no arguments. So the
host builds the gate for one transaction identifier on each delivery, by closing over it. A single gate shared
across transactions cannot know which one a call concerns. The README says so (task 3.2).

### Decision 3: The gate answers only what it can confirm

The gate returns:
- `committed` only for a business change it confirms committed, whether it commits it on that call or finds it
  already committed;
- `declined` for a change that has not committed and will not be. That record then never reaches durability, which
  is correct, because the occurrence claims a commit that did not happen;
- a rejection when it cannot tell. The binding reports `business_commit_unconfirmed` again.

The host limits redeliveries of one pair and alerts while a committed change's record is not durable. That alert is
the contract row's "backlog alert after commit". Surviving a process crash needs the record in the host's own durable
store (G5), because the binding holds nothing durable.

### Decision 4: Where each statement lives

- **The binding's behaviour.** `security-audit-sdk-node`, as one added scenario under the MODIFIED deduplication
  requirement. Its other text is unchanged.
- **The host's obligations.** `fraud-evidence-profile`, as one ADDED requirement. This follows the precedent of
  "Host-composed audit atomicity" and "Delivery results are not commit evidence", which already state the host's side
  of transaction-critical delivery.
- **Guidance.** A README subsection, "Redelivering after a failure following the commit", which applies to every
  host of the binding. It distinguishes a confirmed commit (`audit_durability_failed_after_commit`) from an unknown
  one (`business_commit_unconfirmed`). The consumer integration profile's "Persistence" bullet also changes.
- **Vocabulary.** The Node binding glossary gains "Reconciling commit gate" (avoid: *idempotent gate*, *retry-safe
  gate*). "Durability-only redelivery" is built from the existing term "Redelivery" and gets no entry of its own.
- **Record.** ADR-NODE-006 records Decision 1 and its rejected alternatives. ADR-NODE-005's #870 known limit gets a
  one-line pointer to it.

### Decision 5: The tests pin behaviour and must be able to fail

The tests go in the existing transaction-critical claims test file, use the contract's example events, and run
through the public binding:
- cases A and B: the gate runs twice;
- case C: one business commit, two handoff attempts;
- two occurrences sharing a transaction identifier: one business commit.

The tests pin current behaviour, so they pass on the unchanged binding from the start. Each one is therefore shown
to fail against a planted defect in a disposable copy:
- a binding that skips the commit gate for any pair whose earlier attempt ran it fails A and B. A plant that
  skips only pairs whose gate committed, like rejected option (c), would leave B passing;
- a binding that records a pair which failed after the commit as delivered fails C, because the second call
  reports `already_delivered`;
- a binding that deduplicates on the transaction identifier alone fails the shared-transaction case.

Changing a test's own gate is not a control, because it shows only that the test reads its own fixture.

The binding scenario and the profile requirement share one trigger: a failure reported as
`audit_durability_failed_after_commit` or `business_commit_unconfirmed`. A redelivery after
`business_commit_declined` also reruns the gate, but that is a retry of the business change, outside #870.

## Risks / Trade-offs

- **[Risk] A host keeps a gate that commits on every call and commits twice.**
  - *Mitigation:* the binding cannot detect this. The README, the profile requirement and ADR-NODE-006 state it,
    and test A demonstrates it.
- **[Risk] Reconciliation never settles, and redelivery loops.**
  - *Mitigation:* the requirement makes the host limit redeliveries and alert.
- **[Trade-off] The host obligation lives in `fraud-evidence-profile`, though it applies to any host of the binding.**
  - *Mitigation:* the README states it for every host; the profile is the normative home by precedent.
- **[Out of scope] The occurrence's commit state can attest a commit before the gate confirms it.** ADR 0015
  records that, in the run-9 harness, the SDK operation was marked committed while the SQLite transaction was still
  open. That is an observation of one synthetic host's call order, not a property of the binding. A `declined` answer keeps
  such a record non-durable, and related claims are tracked in #913.

## Migration Plan

None. Behaviour and the surface are unchanged. Hosts whose gate already reconciles need no change. Hosts whose gate
commits on every call learn, from the README, that redelivering through it commits twice. That is true today.

The change lands as separate PRs:
1. the proposal;
2. the implementation;
3. the fold;
4. the archive, merged with a merge commit.

Each PR says `Refs #870`. #870 is closed by hand after the archive merges.
