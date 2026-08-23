# Issue #107 — Enforce Collector Authentication and Contract-Version Validation — Plan

> **For Hermes:** `severity:high`, and the most heavily boundary-restricted issue in Wave 4. A **collector**
> is unauthorized by name: `collector` is a forbidden filename term *and* a forbidden export substring in
> `check-scope.mjs`, and CLAUDE.md lists collectors among the capabilities that each need their own
> OpenSpec change and explicit authorization. Blocked on #102 and #76. Nothing here is startable. What is
> startable is recording, on the issue, the two structural facts nobody has written down: the collector
> chain has **no owner-authorization issue** the way Wave 5 has #121, and the version half of this issue is
> the *asymmetric* half of #75's decision — the producer binds one version, the collector supports a set.

**Goal:** Collector ingress authenticates before accepting evidence, enforces body and record limits,
validates against the generated schema, and enforces the approved version-support policy — failing closed
before any downstream processing.

**Status at this baseline:** DEFERRED — UNAUTHORIZED CAPABILITY. Blocked on #102, #76.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #107, OPEN, labels `enhancement` `severity:high` `openspec-change-needed` `area:server` `needs-triage` |
| Declared dependencies | #102 (startable), #76 (blocked on #75) |
| Native GitHub blockers | `blocked_by` is `0` |
| Authorization | collectors are **unauthorized**; `collector` is a forbidden filename and export term |
| Bounds already in the contract | event 65536 B, depth 8, strings 256 B, arrays 32 elements |
| Generated validator | `schema-validator.generated.cjs` — a standalone Ajv 2020 validator, already the structural check |
| Version policy | #75 decides EXACT_ONE vs EXPLICIT_SET; PLAN-065 makes the **collector** side an explicit set regardless |
| Prohibited-data scan | `src/validation/prohibited.ts` — already exists producer-side |
| Error discipline | bounded: code, category, path; never caller data |
| Wave 5 precedent | #121 is an explicit owner-authorization gate; the collector chain has no equivalent |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The version asymmetry is the whole reason this issue depends on #76

PLAN-065: producers bind one version; **collector migration support is an explicit set**. So even if #75
ratifies EXACT_ONE for the producer, the collector supports a set. That is not a contradiction — it is the
deliberate asymmetry #75's acceptance criteria require to be recorded. #107 is where it becomes code.

Consequence: #107 cannot be built against "the SDK's version policy". It is built against a *separate*
collector policy that #75's ADR must state. **Check that #75's ADR actually records it**; if it only
records the producer side, #107 inherits an unmade decision.

### F2 — The structural validation already exists and should be reused, not rewritten

The generated Ajv validator is standalone CJS with no runtime dependencies. A collector validating
Bloodtrail events should run **that exact artifact**, so producer and collector cannot disagree about what
is valid. Rewriting the validation is how the two sides drift.

### F3 — Bounds are contract facts, not collector configuration

65536 B / depth 8 / 256 B / 32 elements are in the contract. The collector's size limits derive from them.
A collector with a larger limit accepts what the producer could not have emitted; a smaller one rejects
valid events. Derive, do not configure.

### F4 — Authentication must precede everything, and "before acceptance" is testable

#107's second criterion: missing, malformed and invalid authentication fail **before acceptance**. That is
an ordering assertion — the fixture must prove that an unauthenticated request with an *otherwise valid*
body is rejected without the body ever being parsed. Measure it by instrumenting the parse, not by reading
the code.

### F5 — Authentication is not trust, and the issue says so

"Treating authenticated clients as trustworthy evidence sources" is out of scope. An authenticated producer
is identified, not believed. This matters for #126/#127 (client evidence mapping), which must not promote
trust because the relaying producer authenticated.

### F6 — Diagnostics must not leak secrets or payloads, and there are two leak paths

Rejection diagnostics **and** metrics. #107's fourth criterion names both. The producer-side discipline —
code, category, bounded path — extends here. A metric labelled by, say, tenant id is a payload leak in a
different costume.

### F7 — The chain has no authorization gate, and that is a roadmap hole

Wave 5 has #121 ("Obtain owner authorization for client-evidence implementation") before any
implementation. Wave 4's collector chain (#107, #108, #114, #115) has none. Given `severity:high` and a
network trust boundary, that asymmetry is worth raising explicitly with the owner.

---

## Task 0: The gate

- [ ] 0.1 **Confirm collector implementation is authorized.** It is not today. Stop.
- [ ] 0.2 Confirm #102 is complete and #76 resolved, including the **collector-side** version policy (F1).

## Task 1: What is available today

- [ ] 1.1 Post on #107: the collector chain has no owner-authorization issue (F7); ask whether one should
      be filed before #107.
- [ ] 1.2 Post the F1 finding: #75's ADR must record the collector-side explicit set, or #107 inherits an
      unmade decision. Cross-post the note on #75.
- [ ] 1.3 Carry the AI-triage disclaimer. Keep `needs-triage`.

## Task 2: When authorized — propose

- [ ] 2.1 Dedicated OpenSpec change, in a new package outside `security-audit-sdk-core`.
- [ ] 2.2 Full assessment — `integration`, `security_sensitive_behavior`, `public_api` all fire.
- [ ] 2.3 The design fixes the ingress order: **authenticate → size → parse → schema → version →
      accept**, and states that each stage fails closed.

## Task 3: RED — eight arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| E1 | authenticated, size-bounded, schema-valid, supported version | **accept** |
| E2 | missing authentication, otherwise valid | reject **before parse** (F4) |
| E3 | malformed authentication | reject before parse |
| E4 | invalid authentication (well-formed, wrong) | reject before parse |
| E5 | body over the derived limit | reject (F3) |
| E6 | schema-invalid body | reject, generated validator's diagnostic |
| E7 | unsupported contract version | reject, distinct from E6 |
| E8 | diagnostics and metrics inspected | **no secrets, no payload** (F6) |
| N0 | **null control** — E1 repeated | accept, no diagnostics |

- [ ] 3.1 E2's ordering assertion is instrumented, not inferred (F4).
- [ ] 3.2 E7 must be distinguishable from E6 — a version rejection is not a schema rejection.

## Task 4: GREEN

- [ ] 4.1 Authenticate first, unconditionally (F4).
- [ ] 4.2 Derive size limits from the contract bounds (F3).
- [ ] 4.3 Run the **generated** validator artifact (F2).
- [ ] 4.4 Enforce the collector-side version set from #75's ADR (F1).
- [ ] 4.5 Stable rejection classes; bounded diagnostics and metrics (F6).
- [ ] 4.6 Re-run all nine arms.

## Task 5: Verify, commit, PR, close

- [ ] 5.1 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 5.2 Closing comment: the nine arms, the ingress order, and the statement that authentication
      identifies a sender and **does not prove evidence truth** (F5).
- [ ] 5.3 Tick #107 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#107) | Arm |
| --- | --- |
| Authenticated, bounded, valid, supported-version fixture passes | E1 |
| Missing/malformed/invalid authentication fails before acceptance | E2, E3, E4 |
| Oversized, schema-invalid, unsupported version fail | E5, E6, E7 |
| Diagnostics and metrics carry no secrets or payloads | E8 |
| Collector test suite and strict OpenSpec validation pass | Task 5.1 |

## Risks and open questions

- **No authorization gate (F7)** on a `severity:high` network boundary.
- **Rewriting validation instead of reusing the generated artifact (F2)** guarantees eventual drift.
- **Metrics as a leak path (F6)** is the one that gets missed.
- **Open question:** what authentication mechanism? #107 deliberately excludes "selecting production
  credentials or infrastructure", so the change must implement a mechanism without selecting one — which
  in practice means an interface plus one non-production implementation. State that shape in the design,
  or the change will drift into choosing a credential system.

## What this does not authorize

Deduplication (#108), storage (#115), treating authenticated clients as trustworthy, selecting production
credentials or infrastructure, or any deployment.

## What this plan did not verify

Whether #75's ADR will record the collector-side policy (F1). If it does not, #107 must not proceed on an
assumption.
