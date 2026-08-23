# Issue #85 — Add CI Coverage for Every Approved Package — Plan

> **For Hermes:** Blocked on #82 (CI topology, itself blocked on #80) and #83 (materialization). One
> correction to make on the issue before anything else: **#101 declares #85 as a dependency and does not
> need it** — #101 adds a step to the existing workflow, while #85 adds jobs for packages that do not yet
> exist. Post that correction so a governance gate is not delayed by an architecture decision. The
> constraint to hold: adding a job does **not** make it a required check, and an unrequired job that fails
> blocks nothing.

**Goal:** Every package present in the repository has a CI job running its exact Node versions, its
production-only closure test, and at least one deterministic mutation control — with untrusted PRs
receiving no restricted secrets.

**Status at this baseline:** BLOCKED ON #82 → #80, and on #83.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #85, OPEN, labels `enhancement` `verification` `area:core` `needs-triage` |
| Declared dependencies | #82, #83 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Workflow | `.github/workflows/ci.yml` — **`governance_core`** |
| Required contexts (9) | `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |
| Not required | `coverage`; CodeScene App's own Check Run (context name varies by base branch); `release-please` |
| SDK CI Node versions | `24.2.0`, `26.5.0` (`compatibility.json.node.ciVersions`) |
| Contract / research engines | `>=26.5.0` |
| Matrix-safe subset | `npm run test:matrix` — excludes git, package and coherence gates |
| Production-only closure gate | `check-package-contents.mjs` (#70) — real packed install |
| Mutation controls | `tests/verification/*.test.mjs`, run by `test:verification` |
| Runner labels | repo-scoped ARC; a wrong `RUNNER_LABEL` queues for hours instead of failing |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — #101's dependency on #85 is nominal and should be dropped

#101 adds a Contract Reuse Assessment step to the existing `design-pattern-governance` job. It needs no
new package and no new topology. Leaving the dependency in place blocks a governance gate behind the whole
Wave 2 chain. **Post the correction on both issues.** This is the one action available today.

### F2 — "Nonzero build/test discovery" is the criterion that catches the real failure

#85's first criterion is that every present package has **nonzero** build/test discovery. That is aimed at
the classic monorepo failure: a job that globs for packages, finds none, and exits 0. A green job that
tested nothing is this repository's recurring defect class — `cs delta` exiting 0 for its entire life,
and `base === head` skipping the whole governance perimeter. **Assert the discovered package count, not
the exit code.**

### F3 — Node matrices are per package and cannot be unified

SDK runs 24 and 26; contract and research declare `>=26.5.0`. A repository-wide matrix either runs the
contract workspace outside its declared range or drops Node 24 from the SDK. #82 should record this as a
rule; #85 implements it.

### F4 — Repository gates must not run per matrix leg

`test:matrix` deliberately omits git, package and coherence gates. They are repository-level and running
them per leg proves nothing and doubles cost. Keep the split.

### F5 — The production-only closure test must run outside any workspace root

If #80 selected a hoisting topology, `check-package-contents.mjs`'s packed install must happen in a clean
directory outside the root, or hoisting satisfies undeclared imports and a broken tarball passes. This is
the single place where #80's answer changes #85's implementation.

### F6 — Untrusted PRs already receive no restricted secrets, and the rule is to keep it that way

Static and mutation checks run on every PR. `sonar` is the only token-shaped job. The rule: token-gated
analysis may be skipped on untrusted PRs, and **a skip must be visibly a skip, not a pass** — otherwise a
fork PR looks fully validated when one gate did not run.

### F7 — Adding a job does not make it required

Nine contexts are hand-pinned in branch protection. Whatever #85 adds, the owner must add its context to
that list, or the job is advisory. The closing comment must say which state the new jobs are in. If #82
selected the stable-aggregate shape, this problem disappears — new packages are covered by an existing
required context.

### F8 — Editing the workflow is a `governance_core` change

Full assessment, security-sensitive analysis, explicit reviewer acknowledgement, and dual-checker
validation, for a YAML edit. Budget for it.

---

## Task 0: The correction that is available today

- [ ] 0.1 Post on #101: #85 is not a substantive blocker; #101 adds a step to an existing job. Carry the
      AI-triage disclaimer.
- [ ] 0.2 Post the mirror note on #85 so the graph stays consistent.

## Task 1: The gate

- [ ] 1.1 **Confirm #82 is answered and #83 is complete.** If either is open, stop.
- [ ] 1.2 If #80 ratified standalone and #83 closed as already-satisfied, #85 reduces to: confirm the
      three existing workspaces each have a job, and add the missing mutation-control assertion. **Check
      that first** — it is the likely outcome.

## Task 2: Propose

- [ ] 2.1 OpenSpec change `add-ci-coverage-for-every-package`.
- [ ] 2.2 **Full assessment** — `.github/workflows/` is `governance_core` (F8).
- [ ] 2.3 The design records: discovery mechanism, the per-package matrix rule (F3), the gate split (F4),
      the closure-test location rule (F5), the secret rule (F6), and the required-check state (F7).

## Task 3: Implement

- [ ] 3.1 Add or extend jobs per #82's selected shape.
- [ ] 3.2 Assert discovered package count in the job output (F2).
- [ ] 3.3 Wire each package's exact Node versions from its own manifest, not from a shared literal (F3).
- [ ] 3.4 Run the production-only closure test outside any workspace root (F5).
- [ ] 3.5 Ensure a skipped token-gated job prints a distinguishable skip line (F6).
- [ ] 3.6 Use one declared runner-label constant, not per-job literals.

## Task 4: Prove it, both directions

- [ ] 4.1 A PR where every package builds — jobs pass, and the log shows the **count** of discovered
      packages (F2).
- [ ] 4.2 A PR with a deliberate mutation in each package — the corresponding job **fails**, with the
      mutation control's diagnostic.
- [ ] 4.3 A fork-shaped PR — static and mutation checks run; token-gated analysis skips visibly.
- [ ] 4.4 Capture all run URLs. **A green job is not evidence it ran** — read the logs.

## Task 5: Verify, commit, PR, close

- [ ] 5.1 Both `validate` chains; index empty; governance verified after the commit (#191).
- [ ] 5.2 Dual check from the merge-base (F8).
- [ ] 5.3 Closing comment: run URLs, discovered counts, and an explicit statement of which new contexts
      are required and which are advisory (F7).
- [ ] 5.4 Comment on #88 and #101 that their dependency is resolved.
- [ ] 5.5 Tick #85 in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#85) | Arm |
| --- | --- |
| Every present package has nonzero build/test discovery | Task 4.1, asserting the count |
| Production-only smoke tests run | Task 3.4 + 4.1 log |
| Mutation controls fail deterministically | Task 4.2 |
| Untrusted PRs receive no restricted secrets | Task 4.3 |

## Risks and open questions

- **A discovery glob that finds nothing and exits 0** is the failure this issue exists to prevent (F2).
- **The required-check gap (F7)** silently leaves the new coverage advisory.
- **A wrong runner label hangs for hours** rather than failing — a slow, expensive way to learn.
- **Open question for the owner:** should `coverage` become required? It is green and unrequired today,
  so coverage can collapse without a signal. Adjacent to #85; file separately rather than folding in.

## What this does not authorize

Changing branch protection, creating secrets, deploying runners, implementing any package, or using any
production service.

## What this plan did not verify

The existing jobs' install strategy and checkout depth, which constrain how new jobs are shaped.
