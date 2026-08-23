# Issue #124 — Implement the Browser Evidence SDK Package — Plan

> **For Hermes:** `P3_DEFERRED`, NOT AUTHORIZED, blocked on #123 and #121. Read the 2026-08-10 correction
> before anything else: the issue originally required this package to "consume platform-neutral core
> semantics", which **contradicted PLAN-086 and plan §D.5/§H/§K**. It now requires the opposite — **no
> import of, and no dependency on, the Core package** — with the envelope as the sole contract surface,
> and dependency/bundle inspection proving it. The `#86` dependency was deliberately **not** added, to
> preserve parallelism with #131. Do not "helpfully" reintroduce it. Also: `browser` and `telemetry` are
> forbidden filename and export terms in `check-scope.mjs`.

**Goal:** A browser package using Web APIs only, collecting only approved claims, applying required privacy
transformations, constructing ClientEvidenceEnvelope v1, with bounded behaviour on missing capabilities and
deterministic failure on forbidden or oversized claims.

**Status at this baseline:** DEFERRED — NOT AUTHORIZED. Blocked on #123 and #121.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #124, OPEN, labels `enhancement` `security-audit-sdk` `openspec-change-needed` `area:device` `needs-triage`; `P3_DEFERRED` |
| Declared dependencies | #123, #121 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| **Correction (2026-08-10)** | `SCOPE_EXPANSION` — Core-consumption language removed; criterion added requiring dependency and bundle inspection to prove **no Core import**; no `#86` dependency added |
| Plan basis | `@bloodtrail/client-evidence-browser` — **no Core dep · no transport · no collector credentials** |
| Forbidden terms | `browser`, `telemetry`, `transport`, `collector`, `adapter`, `detection`, `analytics` — filenames and exports |
| Prior owner decision | 2026-07-31 — no adoption for detection; no identity attribution, authentication use, risk scoring, enforcement, or real-user collection |
| Prior research posture | `research/browser-telemetry/` is isolated investigation, **not shipping code** |
| Existing dependency gate shape | `check-dependencies.mjs` + `shipped-import-policy.mjs` — AST over packed artifacts |
| Existing packed-closure gate shape | `check-package-contents.mjs` — production-only install |
| Downstream | #130 declares #124 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The no-Core-dependency rule is a *tested* property, not a convention

#124's second acceptance criterion demands dependency **and bundle** inspection proving no Core import.
The instruments already exist in shape: `shipped-import-policy.mjs` walks packed artifacts with the
TypeScript AST and collects module specifiers. Point it at this package's tarball with a policy that
declares Core's package name **forbidden**, and the criterion becomes a gate rather than a claim.

### F2 — The independence is what makes #124 and #131 parallel, and merging them destroys that

The 2026-08-10 correction says so explicitly: #131 (React Native) *is* a Core binding and correctly depends
on #86; this package is a separate box outside the Core stack, "and that independence is what makes B3/B5
parallel-capable". So #124 can proceed on the #123 envelope alone, without waiting for Wave 2's Core
extraction. **That is a scheduling asset**, and it is lost the moment someone shares code between them.

### F3 — The malicious host page is the distinctive threat and it cannot be fully defended

A hostile page can shadow globals, monkey-patch the SDK's own methods, read its data, and fabricate every
input. #124's acceptance criterion asks that a malicious-host input "deterministically fail or be excluded
as specified" — the honest scope is *input validation*, not *host integrity*. The SDK cannot prove it runs
on an uncompromised page, and #124's own assurance limitation says so.

Practical consequence: capture Web API references **at module initialization**, before host code can
replace them, and state plainly that this raises the cost of tampering rather than preventing it.

### F4 — "Missing browser capability" must have documented bounded behaviour, not a throw

Browsers differ. A missing API must produce a documented, bounded outcome — a claim omitted with a recorded
reason — not an exception into the host page's console. #124's fourth criterion.

### F5 — Naming must survive the scope gate

`browser` and `telemetry` are forbidden **filename and export** terms. A package *name* is neither, so
`@bloodtrail/client-evidence-browser` is fine; a file named `browser.ts` inside a governed package is not.
Settle the file naming in the design and verify against the gate rather than assuming.

### F6 — No collector credentials, ever

The plan's own description: "no transport · no collector credentials". A browser package holding a
collector credential would ship it to every visitor. The package **constructs an envelope**; something else
transmits it. That boundary is the reason `transport` is forbidden here too.

### F7 — This package needs its own gates, because the SDK's do not apply to it

`check-scope.mjs` runs against the SDK package. A new package needs its own coupling policy — Web APIs
declared, Node APIs forbidden, Core forbidden — which is #88's shape applied to a third package. Budget
that work; it is not free and it is what makes F1 and F3 enforceable.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #121 authorized the browser platform specifically** and #123's envelope is final.
      If not, stop.
- [ ] 0.2 Read the 2026-08-10 correction on #124 in full. **Do not add a Core dependency.**
- [ ] 0.3 Read #117's approved claim set and #119's prohibited data — together they define what may be
      collected.

## Task 1: Propose

- [ ] 1.1 Task group inside #120's change.
- [ ] 1.2 Full assessment — `public_api`, `integration`, `security_sensitive_behavior`.
- [ ] 1.3 The design states: no Core dependency and how it is proven (F1); the malicious-host posture and
      its limits (F3); missing-capability behaviour (F4); file naming (F5); no credentials (F6); the new
      package's coupling policy (F7).

## Task 2: RED then GREEN — nine arms

| Arm | Fixture | Expected |
| --- | --- | --- |
| P1 | package imported in the approved browser test environment | loads; **no Node built-ins** |
| P2 | dependency + bundle inspection | **no Core import, no Core dependency** (F1) |
| P3 | canonical collection | only approved claims appear in the envelope |
| P4 | a browser capability absent | documented bounded outcome, no throw (F4) |
| P5 | oversized claim | deterministic failure (envelope rejects, per #123) |
| P6 | forbidden claim | excluded or failed as specified |
| P7 | malicious host replaces a Web API after load | references captured at init still used (F3) |
| P8 | any file or export named with a forbidden term | scope gate **fails** (F5) |
| P9 | any collector credential present in the package | **fails** (F6) |
| N0 | **null control** — normal collection | envelope valid; no diagnostics |

## Task 3: Verify, commit, PR, close

- [ ] 3.1 Browser-runtime tests; bundle and dependency inspection; pack/install smoke test; envelope
      validation fixtures.
- [ ] 3.2 All `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 3.3 Closing comment: the ten arms, and the statement that the SDK **cannot** prove it runs on an
      uncompromised browser or that the host page supplied truthful context.
- [ ] 3.4 Comment on #130, which declares #124.
- [ ] 3.5 Tick #124 in #132's Wave 5 checklist.

---

## Validation matrix

| Acceptance criterion (#124) | Arm |
| --- | --- |
| Imports and executes in the approved browser environment without Node built-ins | P1 |
| Dependency and bundle inspection prove no Core import or dependency | P2 |
| Only approved claims appear in a canonical envelope | P3 |
| Missing capabilities produce documented bounded behaviour | P4 |
| Oversized/forbidden claim and malicious-host input fail or are excluded as specified | P5, P6, P7 |
| NOT AUTHORIZED until the owner gate and package prerequisites are complete | Task 0 |

## Risks and open questions

- **Reintroducing the Core dependency** (F2) is the specific defect a prior audit already caught once.
- **Over-claiming host-integrity defence** (F3) — the SDK raises tampering cost, nothing more.
- **Shipping a credential** (F6) would be the single worst outcome available in this backlog.
- **Open question for the owner:** how does the envelope leave the browser, if the package has no
  transport? Presumably the host application sends it alongside its own request. That is a real
  integration story nobody has written, and it determines whether the package is usable at all. Raise it
  before implementation, not after.

## What this does not authorize

Backend acceptance or mapping (#126, #127), React Native support (#131), device fingerprinting, hidden
collection, unapproved claims, production deployment, or publication.

## What this plan did not verify

How the envelope reaches the backend (the open question) — the package's usefulness depends on it.
