# Design: transaction-critical delivery claims only what it checks

Decision source: owner decision, 2026-10-22, via AskUserQuestion and grilling in Claude Code session
https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay. The owner accepted every recommended option.

## Design Pattern Assessment

The full machine-readable assessment is `assessment.json`. This is a direct implementation, not catalog-pattern
conformance. A full assessment is required because the change widens a public result type, changes lifecycle
outcomes, is security-sensitive, and modifies canonical capability requirements.

## Context and forces

- **The binding claims only what it checked.** A host reads the result and the declaration to decide what
  happened, so neither may assert a commit, an order or a scope the binding did not verify.
- **Out-of-type values fail closed.** The `transaction_critical` row's posture is "fail_closed before business
  commit if audit durability cannot be reached". A malformed probe or gate result is exactly the case that
  posture exists for. JavaScript hosts, casts and `any` results reach the runtime check whatever the declared
  types say.
- **Everything else is preserved:**
  - the fixed order (probe, gate, durability point) and the existing outcomes for declined, unreachable and
    duplicate;
  - the frozen export surface (#111), the shared guarantees type, and the other delivery classes;
  - the contract.

The single seam is `runTransactionPipeline` and the `deliver` method in
`packages/security-audit-sdk-node/src/delivery-classes.ts`. Both P-E-x2 values and P-E-3a, 6c and 8 pass through
it. No other module decides a transaction-critical outcome.

**Normal path.** The catalog's eleven `transaction_critical` events allow `committed`, `not_committed`,
`partially_committed` and `compensated`, never `pending`. So the normal path is an occurrence emitted as
`committed` before the commit gate runs. Only `not_committed` contradicts the gate running at all, and only
`not_committed` was measured (P-E-3a).

## Selection and alternatives

Select `approach-pipeline-correction`. Correct the pipeline and `deliver` in place:
- strict `=== true` and `=== "committed"` checks against `unknown`-typed results;
- a commit-claim branch on `event.commit_state`;
- one new status and two new refusal codes.

Reject:
- **`approach-refuse-uncommitted`** (refuse a `not_committed` occurrence before the probe). The owner decided
  (D5) that denial records must still reach durable delivery. Refusal would push them onto a path the class row
  does not govern.
- **`approach-guarantee-field`** (add a declaration field such as `failsClosedAfterCommit`). It changes
  `DeliveryClassGuarantees`, which every delivery class shares, to say what one result code already says (Q4).
- **`approach-documentation-only`** (document the gaps and keep the behaviour). P-E-x2 is a fail-open defect in
  the fail posture. Documentation cannot make a malformed value fail closed.

## Placement and invariants

### `implementation-strict-probe-and-gate`

Read the probe and gate results as `unknown`, so the runtime check does not trust the declared types:
- **Probe.** Only `true` continues. Anything else returns `failed_closed` / `audit_durability_unreachable` with
  `commitGateInvoked: false` and `durabilityAttempted: false`.
- **Gate.** `"declined"` keeps `business_commit_declined`. Any value other than `"committed"` returns
  `failed_closed` / `business_commit_unconfirmed`, with `commitGateInvoked: true` and
  `durabilityAttempted: false`. No handoff is attempted.

### `implementation-uncommitted-without-claim`

When `event.commit_state === "not_committed"`, run the probe, never the gate, and then the handoff. On
acknowledgment, return `{ status: "durable_without_commit", event_id, transaction_id }`.

The pair is recorded for deduplication exactly like a committed delivery. A repeat is `already_delivered`; an
in-flight repeat is refused as `duplicate_transaction_delivery`.

A handoff failure on this path is `audit_durability_unreachable` with `commitGateInvoked: false` and
`durabilityAttempted: true`, because no commit happened.

Two `not_committed` occurrences sharing a transaction id therefore never run the gate (P-E-6c).

### `implementation-after-commit-distinct`

A handoff that fails after the gate committed returns `failed_closed` / `audit_durability_failed_after_commit`,
with both flags `true` (P-E-8). `failsClosedBeforeCommit` stays `true`; its documentation now says it covers
failures before the commit gate runs. Permanent and retryable handoff outcomes share this one code, because the
binding makes exactly one attempt and does not retry either.

### `implementation-preserved-surface`

**Unchanged:**
- no export is added, removed or renamed (`check-exports.mjs` stays at 19 value and 44 type-only exports);
- `DeliveryClassGuarantees`, `best_effort`, `policy_critical`, the admission and reservation logic, and the
  deduplication key;
- every other commit state, and every existing test in `tests/delivery-classes.test.ts`.

**Recorded and documented:**
- the new literals, as a `compatibility.json` `freezeRecord` amendment and in ADR-NODE-005;
- per-instance deduplication (P-E-7), stated in the source, the README, ADR-NODE-005 and the MODIFIED requirement,
  with no persistence added.

## Documentation

- **The source doc comments:**
  - `createTransactionCriticalDelivery` no longer says "audit durability atomic with a successful business
    commit". It says the binding orders durability around the caller's commit and provides no business/audit
    atomicity, no persistent retry, and only per-instance deduplication.
  - `BusinessCommitGate`, `durabilityProbe` and `failsClosedBeforeCommit` describe the exact values that
    continue.
- **README.** A new "Transaction-critical delivery" section with a migration note for hosts that switch
  exhaustively over the status or the code.
- **Glossary.** The Node `CONTEXT.md` gains "Commit claim".
- **ADR-NODE-005** records the decision and the union widening.
- **Profile.** The consumer integration profile's "Commit evidence" paragraph
  (`docs/fraud-evidence/consumer-integration-profile.md`) described #859 and #860 as open. It is rewritten to the
  corrected behaviour. Stage 2's #844 later rewrites the guarantees table from measurement.

## Verification and task mapping

- **1.1–1.2:** the artifacts, assessment-phase governance and strict validation, before the proposal commit.
- **2.1–2.2:** the runtime edit, then typecheck, build and the existing runtime tests, before the runtime commit.
- **3.1:** `tests/transaction-critical-claims.test.ts`:
  - every P-E-x2 value: probe `1`, `"no"`, `0`, `""` and `undefined`; gate `undefined` and `"failed"`;
  - P-E-3a, P-E-6c, P-E-7 (two instances) and P-E-8;
  - the unchanged committed, declined and duplicate controls.

  The differential runs the same tests against `main`'s `delivery-classes.ts`, where they fail.
- **4.1:** the documentation, ADR-NODE-005, the `freezeRecord` amendment and the profile paragraph.
- **5.1:** the full verification chain, recorded with exit codes. Local results do not imply remote CI or review.

## Delivery and boundaries

- **Baseline:** `79fa1270318513f5d17d06ea0508c8ef327f6b32` (`main`).
- **Commits:** five, in order: proposal, runtime, tests, documentation, evidence. Each says `Refs #859` and
  `Refs #860`.
- **Owned paths:** only those listed in `assessment.json`. No contract, generated, core SDK, collector, CI,
  governance-core or canonical-spec edits. Canonical specs change only in the separate fold PR.
- **Review:** AGY (read-only) and `/code-review high`. Required CI, merge, fold and archive stay pending.

## Review-driven refinements

`/code-review high` reviewed the first candidate, which AGY had accepted. These changes followed the review:

- **Rejections fail closed, too.** A probe, gate or handoff that rejects is treated like a value the binding
  cannot confirm. The binding returns the matching failed-closed result instead of rejecting `deliver()`. This
  extends #859's decision: a rejection confirms nothing, so it does not continue either.
- **No contradiction in the MODIFIED requirement.** "Only after a successful business commit SHALL the
  occurrence be made durable" is now qualified for `not_committed` occurrences, so the delta cannot both forbid
  and require their durable delivery.
- **One path per commit claim.** The pipeline splits into a commit path and a no-commit path, and success
  results are frozen like failures.
- **The README states both meanings of `audit_durability_unreachable`.** For a `not_committed` occurrence it can
  also follow a failed handoff (`durabilityAttempted: true`). The hosts' reconcile duty after
  `audit_durability_failed_after_commit` and `business_commit_unconfirmed` is stated as well.

Filed rather than fixed, per the owner's Q3:
- #869: `partially_committed` and `compensated` occurrences still receive a full commit claim.
- #870: there is no durability-only retry after a commit.

Not adopted:
- Re-gating when two committed occurrences share a transaction id. The contract row keys deduplication on event
  id plus transaction id, and each call supplies its own gate.
- Deriving the commit decision from something other than the occurrence's commit state. Consumers read that
  field; the binding stays consistent with it.

## Non-goals

- No judgement of `committed`, `partially_committed`, `compensated` or `not_applicable` at delivery time. A defect
  found there becomes a new issue.
- No persistent deduplication, outbox, persistent retry or `security_significant` binding (G4; Stage 2 #833).
