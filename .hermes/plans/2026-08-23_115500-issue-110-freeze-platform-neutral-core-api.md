# Issue #110 — Freeze the Platform-Neutral Core API After Vertical Evidence — Plan

> **For Hermes:** Blocked on #109. A freeze is a **governance act**, not a code change: it records an
> export surface, binds it to evidence, and adds a check that detects an unapproved change to it. Two
> things the issue does not say. First, this repository **already has an API-surface check** —
> `scripts/check-exports.mjs`, run as `test:exports` — so "add or approve an API-surface
> snapshot/check using repository conventions" means extending an existing instrument, not building one.
> Second, `check-coherence.mjs` pins the export map (`[".", "./testing"]`) as a literal in two places, so
> the export surface is already partially frozen by accident; the freeze makes it deliberate.

**Goal:** An explicit, versioned frozen export list for Core; no Node runtime symbol or dependency in it;
an API-surface check that detects an unapproved exported-symbol mutation; and the freeze record bound to
#109's exact evidence.

**Status at this baseline:** DEFERRED — blocked on #109 and the whole delivery chain.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #110, OPEN, labels `documentation` `security-audit-sdk` `area:core` `needs-triage` |
| Declared dependency | #109 — blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| **Existing API-surface check** | `packages/security-audit-sdk-core/scripts/check-exports.mjs`, script `test:exports`, in both `validate` and `test:matrix` |
| Export map pinned twice | `check-coherence.mjs` rules `public-subpaths` and `compat-exports`, against `compatibility.json.packageExports` = `[".", "./testing"]` |
| Semver policy | `compatibility.json.semverClassification.major` includes "public API removal", "generated type incompatibility", "Node or TypeScript baseline removal", "error code removal or meaning change" |
| Error-code policy | additive is minor; removal or meaning change is major |
| Deprecation policy | document in a minor; removal requires a major unless an immediate security correction is explicitly governed |
| Neutrality gate | #88's per-package coupling policy — Core's `hostGlobals` empty |
| Publication | never; a freeze does not lift the authorization boundary |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The instrument exists; the freeze is a change of what it asserts

`check-exports.mjs` already runs on every `validate` and every matrix leg. A freeze changes it from
"exports are consistent" to "exports are **exactly this list**, and a change requires governance". That is
a smaller change than #110 implies, and it inherits an already-required check — so the freeze is enforced
by an existing required CI context rather than a new one.

### F2 — Part of the surface is already frozen, accidentally

`packageExports` is `[".", "./testing"]` and pinned by two coherence rules. So subpath additions already
require moving a pinned literal. What is **not** frozen is the set of **symbols** exported from those
subpaths. That is the actual gap, and naming it precisely keeps the change small.

### F3 — "Supported versus experimental" needs a mechanism, not a label in prose

#110's first required-work item asks for that classification. Options: a naming convention, a separate
subpath (`./experimental`), or a machine-readable list in `compatibility.json`. **Recommend the list** —
`compatibility.json` is already the repository's compatibility record, already coherence-checked, and
already the place `semverClassification` lives. A subpath would move `packageExports` and trip F2's pins.

### F4 — The freeze must bind to evidence, and this repository has a shape for that

`verification-lifecycle.json` binds changes to exact commits. The freeze record should name #109's
evidence document, its exact commits, and its matrix result. **AI review is not approval**, and a formal
review must bind to the exact reviewed commit hash — the same rule applies to a freeze record.

### F5 — A freeze constrains the future and the constraint must be stated in enforceable terms

"Future incompatible changes require the approved version/governance process" — the enforceable form is:
a symbol removal or signature change fails `test:exports`, and unfreezing requires an OpenSpec change with
a full assessment. Write it as those two sentences, not as an aspiration.

### F6 — Neutrality is part of the frozen surface

#110's second criterion: no Node-specific runtime symbol or dependency in the supported Core surface. The
gate is #88's coupling policy with Core's `hostGlobals` empty. So the freeze *references* #88's control;
it does not re-implement it.

### F7 — Freezing does not authorize publication, and the record must say so

The package is `private`, `UNLICENSED`, never published, and `check-publication-path.mjs` exists to keep
it that way. A freeze is about compatibility, not distribution.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #109's evidence exists and passed.** If not, stop — #110's fourth criterion cannot be
      met without it.
- [ ] 0.2 Read `check-exports.mjs` and record exactly what it asserts today (F1).
- [ ] 0.3 Record the current Core export list, symbol by symbol, from the built `dist/index.d.ts`.

## Task 1: Propose

- [ ] 1.1 OpenSpec change `freeze-platform-neutral-core-api`.
- [ ] 1.2 Full assessment — `public_api` fires by definition.
- [ ] 1.3 The design records: the frozen list, the supported/experimental split mechanism (F3), the
      enforcement sentences (F5), and the evidence binding (F4).

## Task 2: Implement

- [ ] 2.1 Add the frozen export list to `compatibility.json`, with each symbol classified supported or
      experimental (F3).
- [ ] 2.2 Extend `check-exports.mjs` to assert the built surface **equals** the list.
- [ ] 2.3 Add a coherence rule cross-checking the list against `compatibility.json`, matching the existing
      `compat-exports` pattern.
- [ ] 2.4 Record the freeze in an ADR, binding #109's exact commits and evidence path (F4).
- [ ] 2.5 State in the ADR that the freeze authorizes no publication (F7).

## Task 3: RED then GREEN — three arms

| Arm | Mutation | Expected |
| --- | --- | --- |
| G1 | add an exported symbol not in the list | `test:exports` **fails** |
| G2 | remove a listed symbol | `test:exports` **fails** |
| G3 | rename a listed symbol | `test:exports` fails, naming both the missing and the unexpected symbol |
| G4 | add a **Node-specific** symbol to Core | fails via #88's coupling policy (F6) |
| N0 | **null control** — unmodified tree | passes; the list matches exactly |

- [ ] 3.1 Confirm G1–G4 currently pass (wrongly) before the change.
- [ ] 3.2 Confirm N0 passes both before and after.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 `check:generated` before `validate`; both chains; `test:matrix` on both Node majors.
- [ ] 4.2 Index empty; governance verified after the commit (#191).
- [ ] 4.3 Closing comment: the frozen list's size, the four arms, the evidence binding, and F7.
- [ ] 4.4 Tick #110 in #132's Wave 4 checklist.

---

## Validation matrix

| Acceptance criterion (#110) | Arm |
| --- | --- |
| Frozen core export list explicit and versioned | Task 2.1 |
| No Node-specific runtime symbols or dependencies in the supported surface | G4, via #88 |
| API-surface check detects an unapproved mutation | G1, G2, G3 |
| Freeze record references passing vertical-slice evidence | Task 2.4 |
| Future incompatible changes require the governance process | Task 2.4, stated enforceably (F5) |

## Risks and open questions

- **Freezing type-level surface as well as value-level** is harder and easy to skip. `dist/index.d.ts` is
  the honest source; a value-only freeze lets a type change break consumers silently.
- **A freeze recorded in prose enforces nothing** (F5).
- **Experimental as an escape hatch:** if everything is experimental, nothing is frozen. Cap it — the ADR
  should say what fraction or which specific symbols may be experimental and why.
- **Open question:** does the freeze cover `./testing` as well as `.`? The testing subpath exists for
  non-production test sinks; freezing it constrains test ergonomics. Recommend freezing `.` and
  classifying `./testing` as experimental, stated explicitly.

## What this does not authorize

Freezing the Node adapter API (#111), adding behaviour, or publishing a package.

## What this plan did not verify

Whether `check-exports.mjs` currently reads the built `.d.ts` or the source. That decides whether a
type-level freeze is a small extension or a new mechanism.
