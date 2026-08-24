# Issue #191 — Governance Perimeter Silently Passes When Baseline Equals HEAD — Triage and Implementation Plan

> **For Hermes:** The defect is real and still present at `main@1948f9f` — `checkPerimeter` returns at
> line **327** (the issue quotes 322; the line moved, the code did not). This is a `governance_core`
> change, so it needs a full assessment, security-sensitive analysis, and **trusted-baseline validation
> alongside candidate validation — the candidate checker is never its own judge**. Two mechanisms are
> viable and they differ in blast radius; Task 1 forces that choice before any code. Do not "fix" this by
> making an empty range an error: the issue explicitly forbids that, and it would break every correct
> invocation on an unpushed branch. Execute with the `openspec-propose` / `openspec-apply-change` /
> `openspec-verify-change` / `openspec-sync-specs` / `openspec-archive-change` skills. Do NOT merge — the
> owner merges.

**Goal:** Make a `base === head` governance run distinguishable, in output or exit status, from a run that
actually inspected paths — without turning an empty range into a failure and without changing what the
perimeter checks when it does run.

**Status at this baseline:** **IMPLEMENTED, NOT YET ARCHIVED.** The fix merged in PR #209 and is on
`main@9085dde` (`bb68fdd` proposal, `e0cb2a2`, `c3377d4`, `f720e89`). The change
`openspec/changes/distinguish-empty-governance-range/` is still **active**, so #191 stays open until it is
archived and its delta folded into
`openspec/specs/software-design-pattern-governance/spec.md`. The remaining work is the archive cycle only.

*(Original status at the `1948f9f5` baseline, retained for the record: READY — no blocker, no owner
decision required beyond mechanism selection, which this plan resolves with a recommendation.)*

**Architecture:** One surgical edit inside
`openspec/scripts/check-design-pattern-governance.mjs`. The short-circuit at `:327` leaves
`context.rangePathCount` / `rangeCommitCount` unset, and `emit()` at `:518` suppresses the whole
`; inspected N commit(s) and M path(s) from <base>` suffix when `rangePaths === null`. That is the entire
mechanism of the false green: the pass line is *shorter*, and nobody reads a missing clause. The fix lives
in those two places and nowhere else.

**Tech Stack:** ESM `.mjs` under `openspec/scripts/`, `node --test` over
`openspec/tests/design-pattern-governance/*.test.mjs`, disposable-repository fixtures, openspec CLI 1.10.0,
Node pinned `>=24 <25 || >=26 <27`.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #191, OPEN, labels `bug` `severity:medium` `verification` `openspec-change-needed` `area:core` `needs-triage` |
| Native GitHub blockers | `blocked_by` is `0`; the body declares no dependency |
| Defect site | `openspec/scripts/check-design-pattern-governance.mjs:327` — `if (base === head) return;` |
| Suffix suppression | same file `:518-520` — `result.rangePaths === null ? "" : "; inspected …"` |
| Summary fields | `:493-497` — `rangeBase`, `rangeCommits`, `rangePaths`, `classifiedPaths`, all `?? null` |
| Perimeter phases | `:183-185` — `implementation` and `final` only; `bootstrap`/`activation` return earlier by design |
| Fold that never runs | `collectRangePaths(base, head, cwd, diagnostics)` at `:329`, one line after the return |
| Path class of the fix | `openspec/scripts/` → `governance_core` |
| Existing perimeter control | `openspec/tests/design-pattern-governance/perimeter.test.mjs` |
| Sibling controls | `association`, `ancestry`, `archive-completeness`, `classification-completeness`, `self-governance`, `policy`, `provenance`, `review-freshness`, `activation`, `assessment`, `hermes-integration` |
| Active OpenSpec changes | none |
| Lifecycle mode | `archived` |
| Required PR checks | `ci / lint`, `ci / test`, `ci / audit`, `sdk`, `contract`, `sonar`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |

---

## Proven findings

### F1 — The premise holds, and one detail in the issue has drifted

`grep -n 'base === head'` returns exactly one hit: line **327**, not 322. Everything else in the issue's
Scope table is accurate at this baseline. Open the change by correcting the line number in the proposal;
do not treat the drift as a reason to re-verify the whole issue.

### F2 — The false green is a *missing clause*, not a wrong clause

`emit()` builds the pass line as `passed in <phase> phase: <activation><scope>`, where `<scope>` is the
empty string whenever `rangePaths` is `null`. A real run prints:

```
design-pattern governance passed in final phase: enforcement active; inspected 1 commit(s) and 3 path(s) from b8a54e8fe8db
```

and the vacuous run prints:

```
design-pattern governance passed in final phase: enforcement active
```

Two strings that differ by a suffix nobody has been trained to look for. **This is why the defect
survived** — and it is also why the cheapest correct fix is to make the suffix unconditional.

### F3 — `--json` already exposes the difference, and nothing consumes it

`summarise()` emits `rangeCommits` and `rangePaths` as `null` on the vacuous path. Any consumer checking
`rangePaths !== null` would already catch this. Nothing in the repository does. Recording that in the
change is worth more than it costs: it tells the next reader the data was there and unused.

### F4 — The working-tree fold is the reason the bug bites in normal use

`collectRangePaths` folds uncommitted and untracked paths into the range, but it is invoked on the line
*after* the return. So the exact workflow CONTRIBUTING.md encourages — branch from `main`, edit, verify
before staging — produces `base === head` and skips everything. The issue's own reproduction is the proof:
the same tree, the same phase, one untracked unclassified probe, and only `--base` differs.

### F5 — Two mechanisms are viable, and they are not equivalent

| Option | Change | Behaviour on the issue's reproduction | Blast radius |
| --- | --- | --- | --- |
| **A — Report the empty range** | Set `rangeBase/rangeHead/rangePathCount = 0/rangeCommitCount = 0` before the return | Still exits `0`, but prints `inspected 0 commit(s) and 0 path(s)` | Minimal. No check changes. Every existing invocation keeps its result. |
| **B — Drop the short-circuit** | Delete `:327`, let `collectRangePaths` run with `base === head` | **Exits 1** on the probe — the unclassified path is caught | Larger. Every pre-commit run now inspects the working tree; some currently-passing local runs start failing, correctly. |

Option B is what the reporter actually wanted — the plan that produced the false green *believed* it was
inspecting two governed paths. But B changes what the perimeter rejects, and #191's out-of-scope line says
"Any change to what the perimeter checks when it does run" is not in scope, while the working-tree fold is
recorded as a known residual elsewhere.

### F6 — The third acceptance criterion is the expensive one

"Existing correct invocations across all five phases keep their current results" is a five-phase
regression matrix, not a sentence. `bootstrap` and `activation` return before the perimeter; `assessment`
does not include it; `implementation` and `final` do. The matrix is small, but it must be *run*, and Option
B cannot satisfy it without an explicit carve-out for the working-tree fold.

### F7 — This is `governance_core`, with the full ceremony that implies

`openspec/scripts/` is `governance_core`, which forces every `full_assessment_trigger` conversation and
requires the trusted baseline checker to validate the candidate. `run-governance-dual-check.mjs` is the
instrument. **Note from prior sessions: that file contains literal NUL bytes, so `grep` reports it as
binary and returns silence rather than "no match".** Read it with `cat`/`sed`, never conclude from a grep.

### F8 — The control needs a home, and `perimeter.test.mjs` is it

Unlike the SDK's `mutations.test.mjs`, `perimeter.test.mjs` is not a CodeScene hotspot at this baseline —
verify that with `cs delta` before committing, but expect to be able to add arms in place rather than
creating a new file.

---

## Decisions taken (settle these; do not re-litigate during execution)

1. **Take Option A.** It satisfies every acceptance criterion, keeps the out-of-scope line intact, and
   cannot regress a correct invocation. Record Option B in the design as the considered-and-deferred
   alternative, bound to the existing working-tree-fold residual.
2. **Zero is not null.** The fix is to populate the counters with `0`, not to add a new diagnostic. A
   diagnostic implies a failure; an empty range is not a failure.
3. **`rangeBase` is populated too**, so the pass line names the baseline it did not traverse. Without it
   the line reads `inspected 0 commit(s) and 0 path(s) from ` with a dangling preposition.
4. **No new npm script.** Adding one touches `governance_core` package metadata for no gain.
5. **Assert on the diagnostic and the pass-line text, never on exit status alone.** Both arms of this
   differential exit `0` under Option A; exit status cannot tell them apart, which is the whole point.

---

## Files to change

| Path | Class | Change |
| --- | --- | --- |
| `openspec/scripts/check-design-pattern-governance.mjs` | `governance_core` | populate range fields before the `base === head` return |
| `openspec/tests/design-pattern-governance/perimeter.test.mjs` | `governance_core` | two arms: vacuous range reports zero; non-empty range unchanged |
| `openspec/changes/distinguish-empty-governance-range/` | `governed_implementation` | proposal, design, assessment, tasks, spec delta |
| `openspec/specs/software-design-pattern-governance/spec.md` | `governed_implementation` | one ADDED requirement, folded in PR 2 |
| `docs/adr/0006-report-the-inspected-range-on-every-pass.md` | `documentation_only` | root ADR — free, and the reasoning deserves a home |

**Do not touch** `packages/`, `contracts/`, `verification-lifecycle.json`, or any `compatibility.json`
pin. This change moves nothing that `test:coherence` pins.

---

## Task 0: Preflight and re-verify the defect

- [ ] 0.1 `git fetch origin && git switch --no-track -c fix/distinguish-empty-governance-range origin/main`
- [ ] 0.2 Reproduce both arms in a **disposable clone**, not the live tree:
      ```bash
      printf 'probe\n' > zz-unclassified-probe.txt
      node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main; echo "A=$?"
      node openspec/scripts/check-design-pattern-governance.mjs --phase final --base "$(git rev-parse HEAD)"; echo "B=$?"
      ```
      Expect A=1 with `[path-unclassified]`, B=0 with the short pass line. **A is the null control** — it
      proves the checker detects the probe, so B's pass is the short-circuit and not a coverage gap.
- [ ] 0.3 Capture both `--json` outputs. Confirm `rangePaths: null` on arm B (F3).
- [ ] 0.4 Record the current line number of the short-circuit; put it in the proposal.

## Task 1: Confirm the mechanism with the owner

- [ ] 1.1 Post a brief on #191 stating: the defect is confirmed at `:327`; Option A is proposed; Option B
      is deferred and bound to the working-tree-fold residual already recorded in
      `openspec/changes/archive/2026-08-20-enforce-archive-relocation-completeness/archive-evidence.md`.
- [ ] 1.2 Promote `needs-triage` → `ready-for-agent` once the mechanism is acknowledged.
- [ ] 1.3 The brief must carry `> *This was generated by AI during triage.*`.

## Task 2: Propose the change (commit P)

- [ ] 2.1 `openspec-propose` with change id `distinguish-empty-governance-range`.
- [ ] 2.2 Proposal states the defect, the reproduction, both options, and why A.
- [ ] 2.3 **Full assessment** — `governance_core_path` fires, so all fifteen dimension justifications are
      required and `security_sensitive` cannot be waived by assertion.
- [ ] 2.4 Spec delta: one ADDED requirement (below). One scenario per acceptance criterion.
- [ ] 2.5 `openspec validate --strict distinguish-empty-governance-range`.

### ADDED Requirement

```markdown
### Requirement: Baseline verification reports the range it inspected on every passing run

The design-pattern governance checker SHALL report the inspected commit count, path count, and baseline
on every passing run of a perimeter-bearing phase, including runs whose commit range is empty.

#### Scenario: Empty commit range reports zero rather than omitting the range
- **WHEN** the resolved baseline equals HEAD in the implementation or final phase
- **THEN** the checker SHALL pass and SHALL report zero inspected commits and zero inspected paths
  against the named baseline

#### Scenario: Non-empty range is unaffected
- **WHEN** the resolved baseline differs from HEAD
- **THEN** the checker SHALL report the same counts and diagnostics it reported before this requirement

#### Scenario: An empty range is not itself a failure
- **WHEN** the resolved baseline equals HEAD and no other diagnostic fires
- **THEN** the checker SHALL exit zero
```

## Task 3: RED — prove the arms fail before the fix exists

- [ ] 3.1 Add to `perimeter.test.mjs`: a `base === head` invocation asserting the pass line **contains**
      `inspected 0 commit(s) and 0 path(s) from`. Confirm it FAILS on the unmodified checker.
- [ ] 3.2 Add the null-control arm: a non-empty range still reports its real counts. Confirm it PASSES
      already (it must — this is the regression guard, not a new behaviour).
- [ ] 3.3 Add a `--json` arm asserting `rangePaths === 0` and `rangeBase !== null` on the vacuous run.
      Confirm it FAILS (`rangePaths` is `null` today).
- [ ] 3.4 Record all three RED results verbatim in the change's evidence file.

## Task 4: GREEN — the four-line fix

- [ ] 4.1 Replace the bare return with a populated one:
      ```js
      if (base === head) {
        context.rangeBase = base;
        context.rangeHead = head;
        context.rangeCommitCount = 0;
        context.rangePathCount = 0;
        return;
      }
      ```
- [ ] 4.2 Re-run Task 3's arms. All three GREEN.
- [ ] 4.3 Re-run the whole suite: `node --test openspec/tests/design-pattern-governance/*.test.mjs`.
- [ ] 4.4 Re-run the issue's two-arm reproduction. Arm A still exits 1; arm B now exits 0 **with the
      zero-count suffix**.

## Task 5: The five-phase regression matrix

Run each phase on a non-empty range and on an empty one; record exit and pass line for all ten cells.

| Phase | Perimeter? | Empty range expected | Non-empty expected |
| --- | --- | --- | --- |
| `bootstrap` | no | unchanged | unchanged |
| `activation` | no | unchanged | unchanged |
| `assessment` | no | unchanged | unchanged |
| `implementation` | yes | pass + zero counts | unchanged |
| `final` | yes | pass + zero counts | unchanged |

- [ ] 5.1 All ten cells recorded, with the exact stdout.
- [ ] 5.2 Any cell that changed other than the two "zero counts" cells is a defect in the fix — stop.

## Task 6: Dual check — the candidate is not its own judge

- [ ] 6.1 Run `node openspec/scripts/run-governance-dual-check.mjs` from the merge-base. Read it with
      `sed`, not `grep` (F7).
- [ ] 6.2 Record the **trusted-baseline** checker's verdict on the candidate commit separately from the
      candidate checker's verdict on itself. Both must be recorded; a single verdict is not evidence.
- [ ] 6.3 A disagreement goes in `baseline-disagreement.schema.json` shape, not in prose.

## Task 7: Full read-only verification (empty index, BEFORE staging)

- [ ] 7.1 `npm run check:generated --prefix packages/security-audit-sdk-core` (before `validate`, as CI does).
- [ ] 7.2 `npm run validate --prefix packages/security-audit-sdk-core`
- [ ] 7.3 `npm run validate --prefix contracts/security-audit`
- [ ] 7.4 `node --test openspec/tests/design-pattern-governance/*.test.mjs`
- [ ] 7.5 `openspec validate --strict distinguish-empty-governance-range`
- [ ] 7.6 `git diff --check` clean; `git diff --cached --quiet` (index empty) — `test:git` requires this.

## Task 8: Commit, push, PR 1

- [ ] 8.1 Separate commits: proposal (`docs(openspec):`), implementation (`fix(governance):`), never mixed.
- [ ] 8.2 Stage an **explicit allowlist**. Leave unrelated untracked files alone.
- [ ] 8.3 **Governance runs post-commit.** `base == head` short-circuits the perimeter, so a pre-commit
      governance run on a branch created at `origin/main` is a green that checked nothing — *this issue's
      own defect*. Verify after the commit exists, with `--base origin/main`.
- [ ] 8.4 Push, open PR 1, wait for all nine required checks.
- [ ] 8.5 Report readiness. **Do not merge.**

## Task 9: PR 2 (spec fold), then PR 3 (archive)

- [ ] 9.1 PR 2: `openspec-sync-specs` folds the ADDED requirement into
      `openspec/specs/software-design-pattern-governance/spec.md`. `openspec/specs/security-audit-sdk-core/`
      is untouched — that one may change only in `archived` mode.
- [ ] 9.2 PR 3: `openspec-archive-change`. **Stage both the source and destination paths** — `git add
      <destination>` alone commits additions only, and the checker reads the working tree, so a half-done
      move passes locally *and* in CI.
- [ ] 9.3 Retarget each stacked PR onto `main` **before** the one below it merges.

## Task 10: Close #191

- [ ] 10.1 Closing comment: the defect, the fix, the two-arm reproduction after the fix, the five-phase
      matrix, and the explicit statement that the working-tree fold remains a residual.
- [ ] 10.2 `gh issue close 191 --reason completed`.
- [ ] 10.3 #191 is not a wave item on #132; do not edit a wave checklist. Post a traceability note only.

---

## Validation matrix

| Acceptance criterion | Arm | Assertion |
| --- | --- | --- |
| `base === head` distinguishable | vacuous run | pass line contains `inspected 0 commit(s) and 0 path(s) from <base>` |
| Deterministic failing fixture reproduces the false green | RED arm in `perimeter.test.mjs` | fails on pre-change checker, passes on candidate |
| Existing invocations keep results | five-phase matrix (Task 5) | ten cells, only two changed |
| Not its own judge | dual check (Task 6) | trusted-baseline verdict recorded separately |

## Risks, tradeoffs, and open questions

- **Option A does not make the reporter's original run correct.** A contributor verifying pre-commit on a
  fresh branch still inspects nothing — they now just *see* that they inspected nothing. That is the
  scope #191 asks for, and it is worth saying plainly in the closing comment so nobody reads this as the
  working-tree fold being fixed.
- **`inspected 0 commit(s) and 0 path(s)` could be mistaken for a healthy result.** Consider whether the
  design should also emit a `warning`-class diagnostic. Warnings do not fail, so this stays inside scope —
  but it doubles the change's surface. Recommendation: no warning in this change; note it as a follow-up.
- **`governance_core` ceremony may exceed the fix.** Four lines of code, fifteen assessment dimensions.
  That asymmetry is the policy working as designed; do not shortcut it by relabelling the path.

## What this does not authorize

Any change to what the perimeter inspects, to the working-tree fold, to path classification, or to the
authorization boundary. No SDK or contract file moves.

## What this plan did not verify

Whether Option B would pass the five-phase matrix. That measurement is deliberately deferred with the
option, and if the owner picks B it must be run before any code is written.
