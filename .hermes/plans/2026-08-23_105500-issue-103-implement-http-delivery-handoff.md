# Issue #103 — Implement the HTTP Delivery Handoff State Machine — Plan

> **For Hermes:** Blocked on #102 (conformance contract, `ready-for-agent` and startable) and #87 (Node
> binding, deep in Wave 2). **Stop and read the authorization boundary before anything else**: HTTP
> delivery is a *transport*, and transports are unauthorized. `check-scope.mjs` forbids the filename and
> export terms `transport`, `adapter`, `exporter`, `collector`, `queue`, `outbox`, `storage`, and this
> issue cannot land in `packages/security-audit-sdk-core/`. It needs **its own OpenSpec change and its own
> explicit authorization** before a line is written — CLAUDE.md says each such capability needs that, and
> "alongside another change" is not a route. This plan is a readiness plan; it does not authorize.

**Goal:** One concrete transport whose state transitions are testable against #102's conformance contract:
request creation, attempt identity, acknowledgment classification, retryable/non-retryable mapping,
terminal handoff.

**Status at this baseline:** DEFERRED — UNAUTHORIZED CAPABILITY. Blocked on #102, #87, and an authorization
that does not exist.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #103, OPEN, labels `enhancement` `security-audit-sdk` `area:server` `needs-triage` |
| Declared dependencies | #102 (**startable now**), #87 (blocked deep in Wave 2) |
| Native GitHub blockers | `blocked_by` is `0` |
| Authorization boundary | transports, exporters, collectors, queues, outboxes and storage are **unauthorized**; only a transport-neutral sink interface and non-production test sinks exist |
| Mechanical enforcement | `check-scope.mjs` — forbidden filename terms and forbidden export substrings, per package |
| Sink interface | `src/sink.ts` — bare `emit` / `flush?` / `shutdown?`; in-flight promises tracked so `shutdown()` drains under a timeout |
| Contract row | `delivery_class_contracts.security_significant` — at-least-once after the producer boundary accepts; same event id on retry; bounded retry with jitter and exhaustion alert; alert before silent loss; bounded flush or durable handoff |
| Result classes named by #102's plan | `admitted`, `attempting`, `acknowledged`, `retryable`, `non_retryable`, `protocol_error`, `exhausted`, `rejected_overload`, `abandoned` |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — This issue cannot be implemented inside the SDK core package, by mechanical enforcement

`check-scope.mjs` runs per package and rejects a filename or export containing `transport`. Whatever
package hosts HTTP delivery is a **new package**, and its creation is gated on #80/#83 (topology) as well
as on an authorization. Say this plainly on the issue: it is not a design preference, it is a gate.

### F2 — The authorization is a separate artefact and does not exist

CLAUDE.md: "each needs its own OpenSpec change and explicit authorization". #116 is the pilot
authorization; nothing authorizes *implementation*. #103 has no equivalent of #121 (the client-evidence
owner gate). **That is a gap in the roadmap**, and it is worth recording on #103 and on #132: the delivery
chain #103–#109 has no owner-authorization issue of its own, unlike Wave 5 which has #121.

Recommend: raise with the owner whether delivery implementation needs an authorization issue before #103,
mirroring #121. Do not assume the answer.

### F3 — #102 is the real prerequisite and it is startable today

Everything #103 implements is defined by #102. Working #102 is the highest-leverage action available for
the whole of Wave 4. If someone wants to advance #103, the correct move is to finish #102.

### F4 — The state machine is nine states and #102 owns them

Do not invent transitions here. #103's job is to map HTTP's observable outcomes onto #102's result classes:
status codes and connection behaviour → `acknowledged` / `retryable` / `non_retryable` / `protocol_error`.
The mapping is the deliverable; the classes are not.

### F5 — `protocol_error` must stay distinct from `non_retryable`

A malformed acknowledgment is not the same as a permanent rejection: one means the peer said something the
protocol does not allow, the other means the peer refused. #103's third acceptance criterion names both.
Collapsing them loses the ability to detect a broken peer.

### F6 — No live network in tests, and that is achievable

#103's verification says "deterministic HTTP fakes for every conformance result class". A fake at the
`fetch`-shaped boundary covers success, retryable status, permanent status, timeout, malformed body and
connection failure. Note that `fetch` as a *global* is undeclared coupling under #71's policy — the
transport package's coupling policy must declare it, which is #88's shape applied to a new package.

### F7 — Core must gain no HTTP dependency, and #88 is the gate that proves it

#103's fourth criterion. The instrument is the per-package coupling policy from #88. Without #88, the
criterion is an assertion; with it, it is a control.

---

## Task 0: The gate — three separate blockers

- [ ] 0.1 **Authorization.** Confirm an explicit authorization for delivery implementation exists. If not,
      **stop** and do Task 1 instead.
- [ ] 0.2 **#102 complete** — the conformance contract exists and is folded into the canonical spec.
- [ ] 0.3 **#87 complete** — the Node binding exists and Core is neutral.
- [ ] 0.4 **A host package exists** with a coupling policy that declares HTTP capabilities (#88's shape).

## Task 1: The action available today

- [ ] 1.1 Post on #103: it is blocked on an authorization that has no issue (F2), and the delivery chain
      lacks a #121-equivalent. Ask the owner whether one should be filed.
- [ ] 1.2 Note that #102 is startable and is the whole chain's prerequisite (F3).
- [ ] 1.3 Carry the AI-triage disclaimer. Keep `needs-triage`.

## Task 2: When authorized — propose

- [ ] 2.1 A dedicated OpenSpec change, not a rider on another.
- [ ] 2.2 Full assessment — `integration`, `lifecycle_or_state`, `concurrency`, `security_sensitive_behavior`
      all fire.
- [ ] 2.3 The design is one table: HTTP observable → #102 result class. Nothing else (F4).
- [ ] 2.4 Declare the host package's coupling policy entries for HTTP (F6).

## Task 3: Implement, with the mapping as the specification

- [ ] 3.1 Request creation and attempt identity — an attempt id that survives retries (#104 depends on it).
- [ ] 3.2 Acknowledgment classification per the mapping table.
- [ ] 3.3 `protocol_error` distinct from `non_retryable` (F5).
- [ ] 3.4 Consume Core's semantic types only; no HTTP type crosses into Core (F7).

## Task 4: Prove it with fakes

| Arm | Fake behaviour | Expected class |
| --- | --- | --- |
| success | 2xx, well-formed body | `acknowledged` |
| retryable status | 429 / 503 | `retryable` |
| permanent status | 400 / 403 | `non_retryable` |
| timeout | no response within the deadline | `retryable` |
| malformed acknowledgment | 2xx, unparseable body | `protocol_error` |
| network failure | connection refused / reset | `retryable` |
| **null** | unmutated harness, success path | `acknowledged`, no diagnostics |

- [ ] 4.1 All seven arms, deterministic, **no live network**.
- [ ] 4.2 `#88`'s Core-neutrality arm: adding an HTTP specifier to Core fails.

## Task 5: Verify, commit, PR, close

- [ ] 5.1 Both `validate` chains plus the new package's; index empty; governance verified after the commit.
- [ ] 5.2 Closing comment: the mapping table, the seven arms, and the statement that a handoff
      acknowledgment proves neither remote persistence nor exactly-once processing.
- [ ] 5.3 Tick #103 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#103) | Arm |
| --- | --- |
| Successful response → terminal accepted | `success` |
| Retryable responses and timeouts → retryable outcome | `retryable status`, `timeout`, `network failure` |
| Permanent and malformed → non-retryable or protocol error | `permanent status`, `malformed acknowledgment` |
| No Node HTTP dependency in Core | Task 4.2, via #88 |
| Targeted tests pass without live network | Task 4.1 |

## Risks and open questions

- **Starting without authorization** is the dominant risk, and `blocked_by` is `0` so nothing stops it.
- **The missing authorization issue (F2)** means the chain has a hole where Wave 5 has a gate.
- **`fetch` vs `node:http`** is an unmade decision. `fetch` is a language-level global on both supported
  Node majors and keeps the transport closer to portable; `node:http` gives finer control over timeouts and
  connection reuse. Raise it in the design; it changes the coupling policy either way.
- **Attempt identity vs event identity** must not be conflated. The contract row says "same event id on
  retry"; the attempt id is a different thing and #104 depends on the distinction being clean.

## What this does not authorize

Retry scheduling (#104), backpressure (#105), shutdown draining (#106), collector validation (#107),
storage (#115), browser transports, or any claim of exactly-once delivery.

## What this plan did not verify

Whether the owner intends delivery implementation to require its own authorization issue (F2). That
question gates the entire chain and only the owner can answer it.
