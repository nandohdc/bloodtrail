# Vertical-slice delivery conformance evidence (#109)

## Frozen baseline

| Role | Value |
| --- | --- |
| Repository commit under test | `main` at `2833852489e162954bdd495a4c466cbdc75fee84` (the proposal PR #397's merge commit — `packages/security-audit-sdk-node` and `packages/security-audit-collector` source is unmodified by this change, so this is the exact tree the harness below exercises) |
| `@bloodtrail/security-audit-sdk-node` version | `0.1.0` |
| `@bloodtrail/security-audit-collector` version | `0.1.0` |
| Node.js | `v26.8.1` |
| Delivery class exercised | `security_significant` (the only implemented delivery class as of this baseline) |
| Conformance contract | `openspec/specs/delivery-conformance-contract/spec.md`, as folded on `main` |

**Reproduction command** (from a clean clone, repository root):

```bash
npm run build --prefix packages/security-audit-sdk-node
npm run build --prefix packages/security-audit-collector
node openspec/changes/verify-delivery-vertical-slice/harness/vertical-slice.mjs
```

Raw output of the run this evidence reports is saved alongside this document at `harness/run-output.txt`.

## What this harness proves, and what it does not

It proves that `security-audit-sdk-node`'s HTTP delivery handoff, bounded retry, bounded backpressure, and deadline-bounded shutdown compose correctly with a real, in-process `security-audit-collector` ingress instance, for the nine arms below, against the delivery-conformance-contract's own state vocabulary. It does **not** prove:

- **Any deployed system's behavior.** The network peer is an in-process fake (a function call, not a socket); no TLS, partial write, DNS failure, or real transport failure mode is exercised. This is the harness's stated topology, not a hidden gap.
- **Exactly-once delivery or durable storage of any kind.** No claim of either appears anywhere in this document or in the harness; the `duplicate` arm demonstrates idempotent *deduplication*, which the delivery-conformance-contract itself states is not exactly-once delivery.
- **Independence.** This verification was performed by the same category of automated session that also authored the fix and prior work in this delivery chain. This repository's delivery chain has no separate-reviewer mechanism analogous to #60 in the remediation lifecycle (see the comment posted on #109). A genuinely independent pass — a different reviewer/session bound to the exact commit named above — remains open if the owner wants one.
- **Producer-side event validation.** The harness starts from an already-valid fixture event and does not exercise `security-audit-sdk-core`'s own construction/validation pipeline; the delivery-conformance-contract's "validation rejection precedes admission" requirement concerns that boundary, not the collector's HTTP-level rejection tested here (see the scenario matrix below).
- **Every scenario in the delivery-conformance-contract.** #109 itself names exactly seven failure injections plus the happy path plus a null control — nine arms, not "every scenario that could exist." The matrix below scores every scenario in the contract, marking the ones outside this nine-arm scope as **not exercised** rather than omitting them or mismarking them PASS.

## Nine-arm matrix

Each arm ran three times; every arm was deterministic (identical `resultClass` across all three runs — see `run-output.txt` for the full per-run detail).

| # | Arm | Expected delivery-conformance-contract result class | Observed (3/3 runs) | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Happy path | `acknowledged` | `acknowledged` (attempts: 1) | PASS |
| 2 | Timeout | `retryable` → eventually `acknowledged` | attempt 0 classified `retryable`/`timeout`; attempt 1 `acknowledged` (attempts: 2) | PASS |
| 3 | Retry exhaustion | `exhausted` + alert | `exhausted` (attempts: 3), `onExhausted` fired | PASS |
| 4 | Overload | `rejected_overload`, never silent | `rejected_overload` (depth: 1, capacity: 1) | PASS |
| 5 | Shutdown at deadline | `abandoned`, never counted delivered | `abandoned` (accepted: 1, completed: 0, abandoned: 1) | PASS |
| 6 | Invalid authentication | rejected before acceptance | `non_retryable` (attempts: 1, never admitted) | PASS |
| 7 | Unsupported version | rejected, distinct from schema rejection | `non_retryable` (attempts: 1); collector diagnostic `COLLECTOR_VERSION_UNSUPPORTED`, distinct from `COLLECTOR_SCHEMA_INVALID` | PASS |
| 8 | Duplicate | duplicate outcome, no reprocessing | `acknowledged` (attempts: 2); attempt 0 → collector `admitted`, attempt 1 (retry_attempt=1 only) → collector `duplicate`, not `conflict` — proves #391's fix through the full vertical slice | PASS |
| 9 | Null control | happy path with no injection, `acknowledged`, no diagnostics | `acknowledged` (attempts: 1), identical to arm 1 | PASS |

All nine arms PASS. No mismatch was found, so there is no finding to record for this baseline.

## Full delivery-conformance-contract scenario coverage

The contract defines 21 scenarios. Scoring every one of them, not only the nine the harness directly targets:

| Requirement / Scenario | Status | Basis |
| --- | --- | --- |
| Conformance statement traces to a frozen row | not exercised | Documentation/traceability property of the spec text itself, not a runtime behavior a harness observes |
| State transition is never silent | PASS | Every arm's transition was recorded through an observable outcome (attempt counter, backpressure depth/capacity, shutdown report, or diagnostic code) |
| Retry preserves event identity | PASS | Arms 2 and 8: identical `event.id` across attempts, `correlation.retry_attempt` advancing |
| Malformed acknowledgment is never acceptance | not exercised | Not one of #109's nine named arms; the fake exchange only returns well-formed acknowledgments or classified failures |
| Validation rejection precedes admission and is terminal | not exercised | Concerns producer-side event validation (`security-audit-sdk-core`), a boundary this harness does not exercise — it starts from an already-valid fixture |
| Retry exhaustion alerts before terminating | PASS | Arm 3 |
| Attempt timeout is retryable and never reported delivered | PASS | Arm 2 |
| Admission at capacity rejects with a counted overload | PASS | Arm 4 |
| Shutdown deadline expires with outstanding work | PASS | Arm 5 |
| Downstream outage is accounted and alerted | not exercised | Distinct from retry exhaustion (arm 3 covers the retry-budget path, not outage-specific delay accounting); no dedicated arm |
| Best-effort occurrence is lost with bounded reporting | not exercised | `best_effort` delivery class has no implementation yet |
| Security-significant occurrence is delivered at least once | PASS | Arms 2 and 8 |
| Transaction-critical durability is atomic with business commit | not exercised | `transaction_critical` delivery class has no implementation yet |
| Exactly-once is never claimed | PASS | Verified by review of this document's own language (see "What this harness proves") |
| Policy-critical production without a reviewed policy fails conformance | not exercised | `policy_critical` delivery class has no implementation yet |
| Conformance claim is verifiable without a transport runtime | not applicable | Property of the claim's own verifiability, satisfied by construction (this harness needs no transport runtime) rather than something a single arm tests |
| Cross-occurrence ordering is not a conformance requirement | not exercised | No arm submits two distinct concurrent occurrences; each arm exercises one occurrence |
| Malformed flood fails closed at the validation boundary | not exercised | No flood/volume arm; single-submission arms only |
| Retry pressure stays within bounds | PASS | Arm 3 demonstrates a bounded (not unbounded) attempt count under repeated retryable failures |
| Attempt carries the producer's single bound contract version | PASS | Every arm's fixture event carries `schema.version: "1.0.0"` consistently across attempts |
| Outage signal never claims delivery | not exercised | Same gap as "Downstream outage is accounted and alerted" — no dedicated outage arm |

**11 PASS, 1 not applicable, 9 not exercised, 0 FAIL.** No scenario is marked PASS without a specific arm or review step supporting it.

## Residual limitations

1. **Fakes, one topology.** The network peer and collector wiring are in-process fakes; this proves the implementation's conformance, not any deployed system's behavior (delivery-conformance-contract requirement: "the semantic contract is platform-neutral" — verifiable from observable outcomes, which this harness supplies, but transport-specific behavior remains separately unverified).
2. **One class.** Only `security_significant` is exercised; the other three delivery classes have no implementation to test.
3. **Not independently actored.** No separate-reviewer mechanism exists in this delivery chain (see #109's comment thread).
4. **Nine arms, not every scenario.** #109 itself scopes this to nine arms; the scenario table above states plainly which of the remaining twelve are out of that scope, rather than omitting or mismarking them.
5. **No implementation was changed.** This document and the harness are the entire deliverable; no defect was found requiring a fix in this pass.
