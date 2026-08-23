# Issue #101 — Run Contract Reuse Assessment Enforcement in CI — Plan

> **For Hermes:** Blocked on #100 (checker) and, on paper, on #85 (CI coverage for every approved package)
> — but #85 is itself blocked behind the entire Wave 2 topology decision chain, and **this issue does not
> actually need it**. #101 adds one step to an existing workflow; #85 adds jobs for packages that do not
> exist yet. Say that in the triage brief and treat #100 as the only real blocker. Two repository-specific
> traps: `.github/workflows/` **and** `.github/scripts/` are both `governance_core` (the latter since
> #202), so a workflow edit carries full-assessment ceremony; and a new required check must be *added to
> branch protection by the owner* — adding a job does not make it required, and an unrequired job that
> fails blocks nothing.

**Goal:** The Contract Reuse Assessment checker runs on every pull request that could require one, fails
the job closed on a checker failure, and is visible as a stable status name.

**Status at this baseline:** BLOCKED ON #100 → #99 → #98. Not blocked on #85 in substance.

**Architecture:** One step (or one job) in `.github/workflows/ci.yml` invoking the documented checker
command from #100. No secrets. No untrusted-code execution beyond what the workflow already does.

**Tech Stack:** GitHub Actions YAML, `gh`, the checker from #100.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #101, OPEN, labels `enhancement` `verification` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependencies | #100 (real), #85 (not substantively required — see F1) |
| Native GitHub blockers | `blocked_by` is `0` |
| Workflow | `.github/workflows/ci.yml`, runs on pushes to `main` and every PR |
| Required checks on `main` today | `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |
| Not required | `coverage`, the CodeScene App's own Check Run (its context name varies by base branch), `release-please` |
| Path class | `.github/workflows/` → `governance_core`; `.github/scripts/` → `governance_core` (added by #202) |
| Existing governance job precedent | `design-pattern-governance` — the closest analogue for shape, naming, and failure semantics |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The #85 dependency is nominal and should be dropped from the critical path

#85 adds CI jobs "for every approved package" and depends on #82 (CI topology decision) and #83
(materialization), which depend on #80 (topology decision), which is `ready-for-human` and unanswered.
#101 needs none of that: it adds a step to the existing single-repo workflow. Blocking #101 behind the
whole Wave 2 chain would delay a governance gate by an unrelated architecture decision. **Record this
correction on the issue** — it is the single most valuable thing this plan contributes.

### F2 — A new job is not a required check

Branch protection lists nine contexts. Adding a tenth job does not add it to that list; that is an owner
action via repository settings. Until it is added, the job can fail while the PR remains mergeable.
`#101`'s own assurance limitation admits this ("repository-required-status policy is outside this issue"),
but the *practical* consequence must be stated in the closing comment or the gate is believed to be live
when it is not — the same class of error as `cs delta` exiting 0 for its whole life.

### F3 — `design-pattern-governance` is the model to copy

It is already a required check, already fails closed, already runs on every PR, and already has a stable
status name. Copy its shape: same runner, same checkout depth (**full history — the checker needs a
merge-base**), same failure semantics. Do not invent a new pattern.

### F4 — Shallow checkout is the classic failure here

Any range-based checker needs `fetch-depth: 0`. The existing governance job already sets whatever it needs;
read it rather than guessing, and if the CRA checker runs in the same job it inherits the checkout for
free. **Prefer a step inside the existing `design-pattern-governance` job over a new job**, unless the
owner wants a separate status name. That halves the surface and inherits the required-check status.

### F5 — The skip must not read as a pass

#101's second acceptance criterion: an unaffected change "follows the approved skip behavior without
reporting a false pass". This is #191's defect class in CI clothing. Whatever #100's checker prints on a
skip, the workflow must surface it — a silent success on a change that required nothing looks identical to
a silent success on a change that required something and was not checked.

### F6 — Path triggers are a trap, not a feature

#101's required work mentions "explicit path triggers". A `paths:` filter on the workflow makes the check
**not run** on unaffected PRs — and a required check that does not run leaves the PR pending forever, or
worse, is auto-skipped as successful depending on configuration. **Recommendation: no `paths:` filter.**
Run always; let the checker decide it has nothing to do and say so (F5).

### F7 — Fork and Dependabot PRs must not gain secrets

The workflow already runs on every PR. The CRA checker needs no secrets — it reads the repository. Keep it
in the no-secret path and state that explicitly, so a later change cannot quietly add a token to it.

---

## Decisions taken

1. **Add a step to the existing `design-pattern-governance` job** rather than a new job (F4), unless the
   owner explicitly wants a separate status name.
2. **No `paths:` filter** (F6).
3. **No secrets** (F7).
4. **Drop #85 from the blocking set** and record why (F1).
5. **The closing comment states plainly whether the check is required**, and asks the owner to add it if a
   new status name was created (F2).

---

## Task 0: Gate and correction

- [ ] 0.1 Confirm #100's checker is on `main` with a documented command. If not, **stop and work #100.**
- [ ] 0.2 Post a triage brief on #101 recording F1 — that #85 is not a substantive blocker — and F2, F6.
      Carry `> *This was generated by AI during triage.*`.
- [ ] 0.3 Read `.github/workflows/ci.yml`'s `design-pattern-governance` job end to end: runner, checkout
      depth, Node setup, install strategy, failure semantics.

## Task 1: Propose (inside #98's change, CI task group)

- [ ] 1.1 This is a task group inside the `contract-reuse-assessment` change, not a new change.
- [ ] 1.2 **Full assessment applies** — `.github/workflows/` is `governance_core`.
- [ ] 1.3 The design records: step vs job, no `paths:` filter, no secrets, and the required-check gap.

## Task 2: Implement

- [ ] 2.1 Add the checker invocation to the `design-pattern-governance` job.
- [ ] 2.2 Ensure the job's checkout gives the checker a resolvable merge-base (F4).
- [ ] 2.3 Ensure a skip prints a distinguishable line (F5).

## Task 3: Prove it in CI, both directions

- [ ] 3.1 Push a PR carrying a valid CRA fixture — the job passes and the log shows the checker ran.
- [ ] 3.2 Push a PR carrying a **missing** CRA — the job **fails** with `[cra-record-absent]`.
- [ ] 3.3 Push a PR touching nothing that requires a CRA — the job passes and the log shows the **skip**,
      distinguishable from 3.1's pass.
- [ ] 3.4 Capture all three run URLs. **A green job is not evidence the check ran** — read the log.

## Task 4: Verify, commit, PR

- [ ] 4.1 Both `validate` chains; index empty first; governance verified **after** the commit (#191).
- [ ] 4.2 Dual check from the merge-base — `governance_core`.
- [ ] 4.3 Report readiness. **Do not merge.**

## Task 5: Close, and hand the required-check decision to the owner

- [ ] 5.1 Closing comment: the three CI runs with URLs, and an explicit statement of whether the check is
      in branch protection's required list.
- [ ] 5.2 If a new status name was created, ask the owner to add it to the required contexts — and say
      that until they do, the gate blocks nothing (F2).
- [ ] 5.3 Close #101. Tick it in #132's Wave 3 checklist.

---

## Validation matrix

| Acceptance criterion (#101) | Arm |
| --- | --- |
| Relevant PRs invoke the checker | Task 3.1 log |
| Unaffected change skips without a false pass | Task 3.3 log line |
| Valid fixture → passing job | Task 3.1 |
| Missing/malformed → failing job with the checker diagnostic | Task 3.2 |
| Workflow validation and repository CI tests pass | Task 4.1 |

## Risks and open questions

- **The required-check gap (F2) is where this issue silently fails.** Land the job, then chase the setting.
- **Adding a step to an existing job hides it.** If `design-pattern-governance` fails, the PR author will
  not know which of two checkers failed unless the diagnostics are distinct. #100's `cra-*` ids solve this
  — verify they survive into the job log.
- **Open question for the owner:** separate status name (`contract-reuse`) or folded into
  `design-pattern-governance`? Separate is clearer to a reader and costs one branch-protection edit.
  Folded is instantly required and costs nothing. Recommend folded; let the owner overrule.

## What this does not authorize

Creating or changing repository rulesets, changing assessment semantics, or adding unrelated tests to the
same job.

## What this plan did not verify

The existing job's checkout depth and install strategy (Task 0.3), which decide whether a step or a job is
correct.
