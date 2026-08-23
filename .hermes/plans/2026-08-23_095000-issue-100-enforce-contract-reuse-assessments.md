# Issue #100 — Enforce Contract Reuse Assessments with Negative Proof — Plan

> **For Hermes:** Blocked on #99, which is blocked on #98. This is the task group that turns a record into
> a gate, and PLAN-074 governs it: **every enforcement gate must demonstrate a passing fixture and a
> deterministic failing mutation.** This repository has learned that lesson expensively — `codescene delta`
> was a no-op for its entire life because `cs delta` exits 0 unless `--error-on-warnings` is passed, and
> two separate probes in this repository have produced an exit 1 that turned out to be a harness artefact
> rather than detection. **Prove the gate can fail before trusting it, and give every arm a null control.**
> CI wiring is #101, not here.

**Goal:** A checker that deterministically fails a change requiring a Contract Reuse Assessment and not
carrying a valid one, with stable diagnostics, plus five fixture classes proving it.

**Status at this baseline:** BLOCKED ON #99 → #98.

**Architecture:** One checker module reading the trigger from the change's own path set, resolving
`mechanism_references` against `contracts/security-audit/source/contract.source.json`, validating the
record against the #99 schema, and emitting bounded diagnostics. It runs locally by a documented command;
CI invocation is #101.

**Tech Stack:** ESM `.mjs`, `node --test`, disposable-repository fixtures.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #100, OPEN, labels `enhancement` `verification` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependency | #99 → #98 — neither started |
| Native GitHub blockers | `blocked_by` is `0` |
| Canonical negative fixture named in the issue | `registries.trust_levelz` instead of the approved path |
| Real path it misspells | `registries.trust_levels` in `contracts/security-audit/source/contract.source.json` |
| Governing plan obligations | PLAN-071, PLAN-072, PLAN-074 |
| Existing checker precedents | `openspec/scripts/check-design-pattern-governance.mjs`; SDK gates under `packages/security-audit-sdk-core/scripts/` |
| Existing diagnostic idiom | `[diagnostic-id] path: message`, bounded, no caller data |
| Path class | `openspec/scripts/` → `governance_core`; `openspec/governance/` → `governance_core` |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The diagnostic idiom already exists; reuse it exactly

Every governance diagnostic in this repository reads `[id] path: message` and every SDK gate error is
bounded — code, category, and a bounded path only, never caller data. A CRA diagnostic that echoes the
record's `rationale` back into a CI log breaks that invariant. Bound every field.

### F2 — Exit status is not evidence, twice over

Two independent findings in this repository: (a) `cs delta` exits 0 unless `--error-on-warnings` is
passed, so a gate that looked green had never run; (b) a probe's exit 1 was traced to an `npm ls`
`extraneous` complaint from a symlinked `node_modules` in the copy harness, not to detection. **Every arm
asserts the diagnostic id and the named path. Every arm has a null control.**

### F3 — The trigger must be computable from a commit range, or the gate cannot run in CI

#101 will invoke this on pull requests. So the trigger cannot be "the author thinks this touches contract
semantics"; it must be a function of the changed path set, exactly like the design-pattern perimeter's
`classifyPaths`. Settle this in #98's design (its F4) and implement it here without re-opening it.

### F4 — Resolution against the frozen contract is what makes the misspelling arm work

`registries.trust_levelz` must fail *because it does not resolve*, not because it is on a deny-list. That
means the checker loads `contract.source.json` and walks the reference path. Consequence worth stating:
**the contract is frozen at `1.0.0`, so resolution is stable today**; if the contract ever versions, the
resolver must take the version from the record's `affected_contracts`, not from whatever is on disk.

### F5 — Fail closed on parser errors, missing records, and unknown exemptions

#100's security note says these must not downgrade to warnings. That is three separate code paths, each
needing an arm. A malformed JSON record is the easiest one to accidentally treat as "no record", which is
a *different* diagnostic — keep them distinct.

### F6 — This is `governance_core` and needs the dual check

`openspec/scripts/` is `governance_core`. The candidate checker is never its own judge (R14). Run
`run-governance-dual-check.mjs` and record both verdicts distinctly. Read that file with `sed`, not
`grep` — it contains literal NUL bytes and greps as binary.

### F7 — A new control file, not an arm in a hotspot

Prior sessions record that adding controls to a hotspot file fails `codescene delta` on file-level rules
regardless of the new code. Create
`openspec/tests/design-pattern-governance/contract-reuse-enforcement.test.mjs` rather than extending an
existing suite.

---

## Decisions taken

1. **Diagnostic ids, fixed now:** `cra-record-absent`, `cra-record-malformed`,
   `cra-field-invalid`, `cra-mechanism-unresolved`, `cra-exemption-unauthorized`. Five ids, five failure
   classes, no overloading.
2. **Assert on diagnostic id + named path, never exit status** (F2).
3. **Null control on every arm** (F2).
4. **Resolve references against the contract source**, versioned from the record (F4).
5. **New control file** (F7).
6. **No CI wiring here** — #100's own out-of-scope line.

---

## Fixture matrix (implement all seven)

| Arm | Fixture | Expected |
| --- | --- | --- |
| P1 | change requiring a CRA, valid record present | PASS |
| P2 | change **not** requiring a CRA, no record | PASS — the skip must be a real skip, not a false pass |
| N1 | change requiring a CRA, **no** record | `[cra-record-absent]` |
| N2 | record present, malformed JSON | `[cra-record-malformed]` |
| N3 | record present, required field omitted / wrong enum | `[cra-field-invalid]` naming the field |
| N4 | `mechanism_references: ["registries.trust_levelz"]` | `[cra-mechanism-unresolved]` naming the reference |
| N5 | exemption granted by an unauthorized party | `[cra-exemption-unauthorized]` |
| **C0** | **null control** — unmutated fixture repository | PASS, and **no** `cra-*` diagnostic appears |

P2 deserves emphasis: #101's acceptance criteria say an unaffected change must "follow the approved skip
behavior **without reporting a false pass**". The skip and the pass must be distinguishable in output —
the same defect class as #191.

---

## Task 0: Gate

- [ ] 0.1 Confirm #99's schema is on `main` at a known version. If not, **stop and work #99.**
- [ ] 0.2 Confirm #98's design settled the trigger (F3) and the exemption authority.
- [ ] 0.3 Read `check-design-pattern-governance.mjs`'s diagnostic and bounding helpers; reuse rather than
      re-implement.

## Task 1: RED — prove all seven arms before the checker exists

- [ ] 1.1 Build the fixture repositories. Every one disposable; never write to the live tree.
- [ ] 1.2 Confirm N1–N5 currently **pass** (there is no checker), and record it. That is the "before".
- [ ] 1.3 Confirm C0 passes. **If C0 fails, the harness is broken — fix it before reading any other arm.**

## Task 2: GREEN — the checker

- [ ] 2.1 `openspec/scripts/check-contract-reuse.mjs` — pure resolution and validation, bounded diagnostics.
- [ ] 2.2 Wire it so the trigger is computed from the commit range, matching the perimeter's shape (F3).
- [ ] 2.3 Re-run all seven arms plus C0. P1, P2, C0 pass; N1–N5 fail with their own ids.
- [ ] 2.4 Document the local command in the change's docs. #100 requires the command be documented.

## Task 3: Prove the gate can fail *and* that a weakened candidate is caught

- [ ] 3.1 Deliberately weaken the checker to return success on N1; confirm the **trusted baseline** checker
      still rejects (R14 scenario 1 applied to this gate).
- [ ] 3.2 Record both verdicts distinctly via `run-governance-dual-check.mjs` (F6).

## Task 4: Verify, commit, PR

- [ ] 4.1 `node --test openspec/tests/design-pattern-governance/*.test.mjs`
- [ ] 4.2 `openspec validate --strict contract-reuse-assessment`
- [ ] 4.3 Both `validate` chains; index empty first.
- [ ] 4.4 Verify governance **after** the commit exists (#191).
- [ ] 4.5 Report readiness. **Do not merge.**

## Task 5: Close

- [ ] 5.1 Comment on #101; promote it.
- [ ] 5.2 Close #100 with the seven-arm table and the dual-check evidence.
- [ ] 5.3 Tick #100 in #132's Wave 3 checklist.

---

## Validation matrix

| Acceptance criterion (#100) | Arm |
| --- | --- |
| Valid required assessment → PASS | P1 |
| Required but absent → deterministic failure | N1 |
| `registries.trust_levelz` → deterministic failure | N4 |
| Malformed fields and unauthorized exemptions → stable diagnostics | N2, N3, N5 |
| Checker test suite passes and command documented | Task 2.4, Task 4.1 |

## Risks and open questions

- **A gate that never fires is worse than none.** If the trigger from #98 is drawn so narrowly that no
  real change matches it, this gate is decorative. Test the trigger against the *actual* path sets of
  #125 and #123 as designed, and record whether each would require a CRA.
- **Reference resolution couples the checker to the contract's internal shape.** If the contract source's
  structure ever changes, the resolver breaks. Bound the coupling: resolve only top-level registry and
  matrix paths, and fail closed on anything deeper.
- **Bounded diagnostics vs. useful diagnostics.** "Field invalid" with no field name is useless; the field
  *name* is safe, the field *value* may not be. Name the field, never echo the value.

## What this does not authorize

Adding the checker to CI (#101), reviewing any specific assessment's merits, or expanding the trigger
beyond #98's approved proposal.

## What this plan did not verify

The trigger's real-world hit rate, because the trigger does not exist yet.
