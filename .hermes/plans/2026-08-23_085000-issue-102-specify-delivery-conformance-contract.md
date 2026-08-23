# Issue #102 — Specify the Delivery Conformance Contract — Plan

> **For Hermes:** #102 is `ready-for-agent` and **spec-only** — the triage pass explicitly typed it that
> way. It is the highest-value item in Wave 4 because eleven other issues (#103–#109, #113, #126, and by
> reference #112) consume the artefact it produces, and none of them can be specified coherently until it
> exists. Two hard boundaries: the four delivery classes are **already defined in the frozen contract** at
> `delivery_class_contracts`, so this change *conforms to* them and never redefines them; and the words
> `transport`, `collector`, `queue`, `outbox`, and `storage` are forbidden **filenames and exports** by
> `check-scope.mjs` — a specification may name them, an implementation may not. Nothing here authorizes
> code. Do NOT merge — the owner merges.

**Goal:** One governed specification of the observable delivery semantics — attempt identity,
acknowledgment, retry eligibility, ordering scope, capacity, backpressure response, shutdown deadlines,
terminal failure — that any transport must satisfy, drawn from the contract's existing
`delivery_class_contracts` rather than invented beside it.

**Status at this baseline:** READY — start now. Its declared dependencies (#66 closed, #75 open) are
discussed in F5; #75 does not block the *specification*.

**Architecture:** An OpenSpec change producing a delta spec, plus a design that carries a state model and
canonical conformance scenarios. **No code, no package, no file under `packages/*/src/`.**

**Tech Stack:** openspec CLI 1.10.0, Markdown, the frozen contract as the source of the class semantics.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #102, OPEN, labels `enhancement` `openspec-change-needed` `area:server` `ready-for-agent` |
| Declared dependencies | #66 CLOSED; #75 OPEN and `ready-for-human` (see F5) |
| Native GitHub blockers | `blocked_by` is `0` |
| Class semantics source | `contracts/security-audit/source/contract.source.json` → `delivery_class_contracts`, frozen at `1.0.0` |
| The four classes | `best_effort`, `security_significant`, `transaction_critical`, `policy_critical` |
| Per-class dimensions already fixed | `semantic`, `durability`, `idempotency`, `retry`, `backpressure`, `shutdown`, `outage`, `business_failure_posture` |
| First class to specify | `security_significant` — PLAN-051 says begin there; its `semantic` is "At-least-once after required producer boundary accepts the occurrence" |
| Authorization boundary | `check-scope.mjs` forbids filenames/exports containing `transport`, `collector`, `queue`, `outbox`, `storage`, `adapter`, `exporter`, `instrumentation`, `browser`, `telemetry`, `siem`, `analytics`, `detection`, `framework`, and named frameworks |
| Existing sink surface | `packages/security-audit-sdk-core/src/sink.ts` — bare `emit` / `flush?` / `shutdown?`; in-flight promises tracked so `shutdown()` drains under a timeout |
| Existing shutdown semantics | `compatibility.json.shutdownTimerOwnership` — `unref`, idempotent clear in a structured `finally`, no signal handlers, no intervals |
| Downstream consumers | #103, #104, #105, #106, #107, #109, #112, #113, #126 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The semantics are not a blank page; two-thirds are already frozen

`delivery_class_contracts` already fixes eight dimensions per class. For `security_significant`:
at-least-once after the producer boundary accepts; same event id on retry with consumer dedupe; bounded
retry with jitter and a retry-exhaustion alert; **alert before silent loss** as the backpressure posture;
bounded flush or durable handoff at shutdown; delay accounting and operator alert on outage; and
"normally fail_open unless event-specific policy strengthens".

**This change's job is to make those observable, not to choose them.** Anything the specification says
that contradicts a `delivery_class_contracts` row is a contract change, which is out of scope and would
require the whole PLAN-022 apparatus (regeneration, provenance, immutability-gate literals,
`verification-lifecycle.json` protected prefix).

### F2 — The exactly-once boundary is already drawn, and the contract draws it

`transaction_critical.durability` reads "transactional outbox or equivalent behavior, **product not
selected**". `security_significant` is at-least-once. Nothing in the contract claims exactly-once. #102's
fourth acceptance criterion — distinguish at-most-once/at-least-once from exactly-once claims — is
therefore a *restatement* of a contract fact, and the spec should cite the row rather than argue it.

### F3 — `policy_critical` cannot be fully specified here, and that is by design

Its row reads "Policy owner must approve exact fail-open, fail-closed, or deferred-completion behavior
before production" and `business_failure_posture: blocked_pending_qualified_review`. The conformance
contract must therefore have a **hole** for `policy_critical`, shaped so that the absence of a
policy-owner record is itself a conformance failure. #112 later enforces exactly that. Specify the hole;
do not fill it.

### F4 — The sink interface already exists and constrains the vocabulary

`src/sink.ts` is `emit` / `flush?` / `shutdown?`, and `shutdown()` drains tracked in-flight promises under
a timeout. The conformance contract sits **above** that interface: it describes what a delivery
implementation behind a sink must do, not a new SDK surface. Reusing the existing shutdown vocabulary —
admission boundary, drain, deadline, accounting — keeps #106 from inventing a second one.

### F5 — The #75 dependency binds the *version* dimension only, and can be handled by deferral

#102 declares a dependency on #75 (contract-version support policy) because a delivery contract must say
which contract versions an attempt carries. #75 is `ready-for-human` and unanswered. **Do not block on
it.** Specify the version dimension as "the producer's single bound contract version, per the policy
selected in #75", and record it as an explicit open parameter. That keeps ten downstream issues moving
while one decision waits.

### F6 — This is a specification, and specifications are cheap to get wrong in an expensive way

Eleven issues will be written against it. The cost of an under-specified state model is eleven
re-openings. Two disciplines are worth the time: (a) every state transition has an **externally
observable** outcome — if a transition cannot be observed by a test, it is not in the model; (b) every
scenario names the class it belongs to, because a scenario that silently applies to all four classes will
be wrong for at least one.

### F7 — Governance shape is modest, and no `src/` file may appear

`openspec/changes/` and `openspec/specs/` are `governed_implementation`. No `governance_core` trigger
fires. **Critically: a new, uncommitted file under `packages/security-audit-sdk-core/src/` fails
`test:changed-paths`** unless its exact path is listed in `ownership.reviewedNewSdkSourcePaths`. This
change creates no such file, and if it seems to need one, the change has stopped being a specification.

### F8 — `area:server` is right, and it is a warning

The label places this outside the SDK core. Every downstream implementation issue is unauthorized until
its own change is authorized. The specification is authorized; nothing it describes is.

---

## Decisions taken

1. **Specify `security_significant` fully; specify the other three by reference to their rows**, with
   `policy_critical`'s hole made explicit (F3). PLAN-051 says begin with `security_significant`.
2. **Cite `delivery_class_contracts` as normative**; never restate a row in different words (F1).
3. **Defer the version dimension to #75** as a named open parameter (F5).
4. **Every transition externally observable; every scenario class-scoped** (F6).
5. **No code, no `src/` file, no package** (F7).
6. **Sit above the existing sink interface**; reuse its shutdown vocabulary (F4).

---

## The state model to specify (draft — settle in design)

| State | Entered when | Observable |
| --- | --- | --- |
| `admitted` | the producer boundary accepts the occurrence | capacity consumed; attempt identity assigned |
| `attempting` | an attempt is in flight | attempt counter incremented |
| `acknowledged` | the peer returns a well-formed acceptance | terminal success; event id recorded |
| `retryable` | retryable response, timeout, or transport failure | attempt counter, next-delay bound |
| `non_retryable` | permanent response | terminal failure, classified |
| `protocol_error` | malformed acknowledgment | terminal failure, **distinct** from `non_retryable` |
| `exhausted` | retry budget spent | terminal failure with exhaustion alert (contract row) |
| `rejected_overload` | admission at capacity | terminal, counted, **never silent** (contract row) |
| `abandoned` | shutdown deadline expired with work outstanding | counted, **never reported as delivered** |

Nine states, each with a required observable. `abandoned` and `rejected_overload` are the two that a naive
implementation will collapse into "failed"; keeping them distinct is what makes #105, #106 and #109
testable.

---

## Task 0: Preflight

- [ ] 0.1 `git switch --no-track -c docs/specify-delivery-conformance-contract origin/main`
- [ ] 0.2 Read `delivery_class_contracts` for all four classes, verbatim, and paste the
      `security_significant` row into the design. Every requirement must trace to a dimension in it.
- [ ] 0.3 Read `src/sink.ts` and `compatibility.json.shutdownTimerOwnership`. Reuse the vocabulary.
- [ ] 0.4 Confirm `openspec/changes/` holds only `archive/`.

## Task 1: Propose

- [ ] 1.1 `openspec-propose`, id `specify-delivery-conformance-contract`.
- [ ] 1.2 Proposal: what is specified, what is deliberately left open (#75's version dimension,
      `policy_critical`'s behaviour), and that nothing is authorized.
- [ ] 1.3 Design: the nine-state model, the transition table, the class-scoped scenarios, and the
      boundary between platform-neutral semantics and transport-specific adapters.
- [ ] 1.4 Delta spec: one requirement per dimension, each with scenarios for retry, overflow, timeout,
      shutdown, validation rejection, and downstream failure — #102 names all six.
- [ ] 1.5 Assessment. Expect `lifecycle_or_state` and `concurrency` to fire; justify all fifteen dimensions.
- [ ] 1.6 `openspec validate --strict specify-delivery-conformance-contract`.

## Task 2: Prove the specification is testable before anyone implements it

- [ ] 2.1 For each of the nine states, write down the assertion a conformance test would make. If a state
      has no assertion, it is not observable and must be merged or removed (F6a).
- [ ] 2.2 For each scenario, name the class it applies to. Any scenario applying to all four is suspect —
      re-read the rows (F6b).
- [ ] 2.3 Record that **no** requirement claims exactly-once, citing the `transaction_critical` row (F2).

## Task 3: Verify, commit, PR

- [ ] 3.1 Both `validate` chains; `check:generated` before `validate`; index empty first.
- [ ] 3.2 Verify governance **after** the commit exists (#191).
- [ ] 3.3 One commit, `docs(openspec):`. Explicit staging allowlist.
- [ ] 3.4 PR body states: specification only, no authorization, no code.
- [ ] 3.5 Report readiness. **Do not merge.**

## Task 4: Fold, archive, and unblock the wave

- [ ] 4.1 PR 2: `openspec-sync-specs`. PR 3: archive, **staging both paths of the move**.
- [ ] 4.2 Comment on #103, #104, #105, #106, #107, #109, #113, #126 that the conformance contract exists,
      naming the spec path. Do **not** promote them — they remain blocked on their own prerequisites.
- [ ] 4.3 Close #102; tick it in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#102) | Where satisfied |
| --- | --- |
| Every delivery state and transition with deterministic observable outcomes | Task 2.1 — nine states, nine assertions |
| Retry, overflow, timeout, shutdown, validation-rejection, downstream-failure scenarios | delta spec, Task 1.4 |
| At-most-once / at-least-once distinguished from exactly-once | Task 2.3, citing the contract row |
| Transport-specific runtime dependencies excluded from the neutral contract | design's boundary section |
| Artifacts pass strict validation | Task 1.6 |

## Risks, tradeoffs, and open questions

- **Specifying all four classes at once is the tempting mistake.** PLAN-051 says start with
  `security_significant` "because it is the only class that exercises every claimed property". Specifying
  `transaction_critical` fully would drag in the durability substrate, which the authorization boundary
  forbids and #112 explicitly scopes out.
- **The version dimension (F5) will be raised in review.** Have the deferral written down.
- **Ordering scope is the dimension the contract does *not* fix.** `delivery_class_contracts` says nothing
  about ordering. That makes it a genuine decision this change must take — and the safe answer is
  **no ordering guarantee across attempts**, stated explicitly, because any stronger claim becomes a
  constraint on every future adapter.
- **Open question for the owner:** does `security_significant`'s "required producer boundary accepts the
  occurrence" mean the SDK's `emit` returning `ok`, or the sink's handoff? The whole at-least-once claim
  hinges on where that boundary is. Raise it in the proposal.

## What this does not authorize

Implementing HTTP transport, queues, collector validation, or storage. Claiming exactly-once delivery.
Selecting a production deployment. Adding any file under `packages/*/src/`.

## What this plan did not verify

Whether a conformance suite can be written without a transport to run it against — that is #109's problem,
and if the answer turns out to be "no", this specification is under-determined and must be revised.
