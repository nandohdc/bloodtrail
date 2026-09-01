## Context

Issue #102 asks for one common conformance contract for retries, backpressure, shutdown, validation, and handoff semantics. The source plan (`.hermes/plans/2026-08-23_085000-issue-102-specify-delivery-conformance-contract.md`) traces to PLAN-001 (preserve the normative contract to semantic core to platform binding to delivery to collector layering), PLAN-003 (reuse existing delivery mechanisms rather than duplicating them), and PLAN-051 (treat delivery as conformance to existing delivery-class semantics, beginning with `security_significant`).

The four delivery classes already exist, frozen, in `contracts/security-audit/source/contract.source.json` at `delivery_class_contracts` (lines 516-557), with eight fixed dimensions per class: `semantic`, `durability`, `idempotency`, `retry`, `backpressure`, `shutdown`, `outage`, and `business_failure_posture`. The canonical `security-audit-event-contract` capability already requires that catalog entries declare exactly one delivery class and that event delivery failure be itself observable. The SDK core already fixes a transport-neutral sink boundary and explicitly claims no delivery guarantees beyond the sink's documented boundary. The exact-one contract-version policy (#75, closed) fixes the version dimension this conformance contract consumes.

This change therefore conforms to existing authority; it never redefines a frozen row and never selects a mechanism. Its job is to make the frozen semantics observable, testable, and conformance-checkable.

## Goals / Non-Goals

**Goals:**

- One governed capability specifying the observable delivery semantics any conforming delivery implementation must satisfy.
- A finite state model in which every transition has a deterministic externally observable outcome.
- Class-scoped conformance scenarios for retry, overflow/capacity, timeout, shutdown deadlines, validation rejection, and downstream failure.
- Explicit at-most-once / at-least-once classification per class and an explicit exactly-once prohibition.
- A platform-neutral boundary: observable semantics only, no transport runtime dependencies.

**Non-Goals:**

- Implementing HTTP transport, queues, collector validation, or storage; adding any file under `packages/*/src/`; changing any package.
- Redefining, extending, or weakening any `delivery_class_contracts` row.
- Claiming exactly-once delivery; designing the transactional outbox or any durability substrate.
- Selecting a production deployment, authorizing production transports, collectors, queues, storage, browser telemetry, or real-user processing.
- Re-deciding the exact-one contract-version cardinality (settled in #75).

## Decisions

### D1 — Cite the frozen rows; never restate them in different words

Every class statement in the delta traces to a `delivery_class_contracts` dimension using the contract's wording: class names, postures (`fail_open`, `fail_closed`, `blocked_pending_qualified_review`), durability ("direct attempt or bounded memory buffer", "durable or protected bounded queue in later implementation", "transactional outbox or equivalent behavior, product not selected"), idempotency ("same event id on retry; consumers dedupe", "dedupe by event id and transaction id"), retry ("none or bounded retry", "bounded retry with jitter and retry exhaustion alert", "persistent retry after commit"), backpressure ("drop with bounded counter and health signal", "alert before silent loss", "commit gate before durability point; backlog alert after commit"), shutdown ("no unbounded delay", "bounded flush or durable handoff", "durable handoff required"), and outage ("health signal records loss estimate", "delay accounting and operator alert", "defer downstream delivery from durable record", "production blocked until reviewed policy exists").

A contradictory statement would be a contract change requiring the full regeneration and immutability-gate apparatus — out of scope by definition.

### D2 — Nine states, every transition externally observable

The delta fixes nine delivery states. A state with no observable is not a state, so each state carries its observable:

| State | Entered when | Observable |
| --- | --- | --- |
| `admitted` | the producer boundary accepts the occurrence | capacity consumed; attempt identity assigned |
| `attempting` | an attempt is in flight | attempt counter incremented |
| `acknowledged` | the peer returns a well-formed acceptance | terminal success; acknowledgment recorded |
| `retryable` | retryable response, timeout, or transport failure | attempt counter; next-delay bound |
| `non_retryable` | permanent rejection | terminal failure, classified |
| `protocol_error` | malformed or ambiguous acknowledgment | terminal failure, classified distinctly from `non_retryable` |
| `exhausted` | retry budget spent | terminal failure; retry-exhaustion alert for `security_significant` |
| `rejected_overload` | admission while at capacity | terminal, counted through a bounded counter and health signal, never silent |
| `abandoned` | shutdown deadline expired with outstanding work | counted; never reported delivered |

Transition rules: admission → `admitted`; `admitted` → `attempting`; `attempting` → `acknowledged` (well-formed acceptance), `retryable` (retryable response, timeout, or transport failure), `non_retryable` (permanent rejection), or `protocol_error` (malformed acknowledgment); `retryable` → `attempting` (retry within budget) or `exhausted` (budget spent); `admitted` → `rejected_overload` (at capacity); any non-terminal state → `abandoned` (shutdown deadline with work outstanding). Validation rejection never reaches `admitted`.

### D3 — One exact scenario per normative point

Scenarios are single-outcome and preconditioned. Where the plan draft would have combined alternative outcomes into one scenario ("X or Y"), the delta splits them: the timeout scenario asserts only the `retryable` classification, the exhaustion scenario asserts only the `exhausted` termination. Every scenario names its delivery class when class behavior is at stake, because a scenario that silently applies to all four classes is wrong for at least one of them.

### D4 — At-most-once / at-least-once per class; exactly-once never

`best_effort` is at-most-once acceptable with bounded loss reporting. `security_significant` and `transaction_critical` are at-least-once after their respective boundaries (the producer boundary for `security_significant`; the durable record after the atomic commit for `transaction_critical` downstream). The delta adds one dedicated scenario whose sole outcome is that no exactly-once claim exists anywhere, because the issue's third acceptance criterion is a restatement of a contract fact, not a new guarantee: `transaction_critical.durability` says "product not selected", and nothing in the contract claims exactly-once.

### D5 — The producer boundary is a declared conformance parameter

The frozen `security_significant` row anchors at-least-once to "after required producer boundary accepts the occurrence". The conformance contract does not re-bind the SDK's existing sink boundary and does not decide whether a future SDK delivery implementation draws that boundary at `emit` resolution or at sink handoff; that is a later implementation change's decision. Instead, a conformance claim SHALL identify the producer boundary at which the claimed implementation accepts occurrences, and at-least-once counts from that declared boundary. This resolves the plan's open question at the specification level without constraining any future adapter.

### D6 — Ordering scope is per-occurrence only

`delivery_class_contracts` says nothing about ordering, so any cross-occurrence ordering claim would be a new constraint invented beside the contract. The delta fixes the safe answer: no cross-occurrence ordering guarantee; within one occurrence, attempts are sequential, non-overlapping, and ordered by zero-based `correlation.retry_attempt`.

### D7 — `policy_critical` keeps its hole, shaped as a conformance failure

The frozen row makes the policy owner approve exact fail-open, fail-closed, or deferred-completion behavior before production. The delta specifies the hole rather than filling it: production is blocked until a reviewed policy exists, the absence of that policy is itself a conformance failure recorded as `blocked_pending_qualified_review`, and retries use the same event id with policy-specific reconciliation. #112 later enforces the policy-record mechanism; this change does not design it.

### D8 — Platform-neutral semantics; adapters stay outside

The delta requires verifiable observable outcomes only and prohibits naming or requiring any transport, queue, outbox, collector, or storage runtime mechanism. The scope gate forbids those words as filenames and exports; this change creates no code at all, so no gate surface exists. Spec prose may name the concepts because the contract itself does.

### D9 — Version dimension consumes the settled exact-one policy

#75 closed with `EXACT_ONE`; the delta applies it rather than re-deciding it: every attempt carries the producer's single bound canonical contract version and no attempt spans multiple versions.

### D10 — Acceptance stays closed under attacker-controlled pressure

Validation precedes admission, so a payload can never ride a validation defect onto the delivery path. Attempt counts, retry budgets, jittered delays, buffered capacity, and counters are all bounded. Acceptance results only from a well-formed acknowledgment, so malformed traffic and retry pressure cannot manufacture ambiguous acceptance.

## Canonical scenario coverage

| Issue #102 scenario family | Delta requirement |
| --- | --- |
| Retry | Attempt identity is stable and retry attempts are zero-based; Retry is bounded, jittered, and exhausted with an alert |
| Overflow / capacity | Capacity is bounded and overflow is counted, never silent |
| Timeout | Retry is bounded, jittered, and exhausted with an alert (attempt-timeout scenario) |
| Shutdown deadlines | Shutdown has a deadline with bounded flush or durable handoff |
| Validation rejection | Validation rejection precedes admission and is terminal |
| Downstream failure | Downstream failure and outage are classified and accounted |

Every requirement and scenario is class-scoped where class behavior differs, with primary depth on `security_significant` per PLAN-051 while the common contract covers all four classes.

## Migration Plan

1. Land this proposal, capability delta, design, and task plan as the proposal commit (this change; no code).
2. In the governed pipeline, obtain an exact-commit technical review bound to the proposal head and an identity-preserving merge to `main`; the project owner merges.
3. In a dedicated canonical-fold commit, fold the delta into `openspec/specs/delivery-conformance-contract/spec.md` and prove a second semantic application is a no-op.
4. In a separate archive-relocation commit, move the active change into `openspec/changes/archive/` with byte identity for the authored artifacts.
5. After the fold, comment on the downstream issues (#103-#109, #113, #126, and #112 by reference) naming the canonical spec path; do not promote or close them here.

Before merge, rollback is removal of the unmerged proposal. After the canonical fold, changing the contract requires a new governed capability change; editing the proposal alone must not leave the canonical requirement behind.

## Risks / Trade-offs

- [A class row is restated in different words] → The delta quotes the frozen wording per dimension and D1 makes contradiction a contract change, which this change cannot perform.
- [The producer boundary is read as the SDK's `emit`] → D5 keeps it a declared conformance parameter; the review should confirm this anchoring before the fold.
- [A scenario is read as applying to all four classes] → Class-scoped scenario names and D3's single-outcome discipline; the class coverage matrix above.
- [Exactly-once creeps in through deduplication prose] → The dedicated exactly-once prohibition scenario states deduplication is idempotency only.
- [The specification is read as authorization] → Non-goals, the proposal's scope statement, and D8 restate that nothing here authorizes implementation.
- [Conformance is unverifiable without a transport to run against] → That is #109's problem; the delta keeps every observable defined independently of any runtime.
