# Issue #82 — Decide the Multi-Package CI Topology — Decision Packet

> **For Hermes:** Owner decision, gated on #80. **Do not edit `.github/workflows/`** — it is
> `governance_core`, so even a whitespace change carries full-assessment ceremony, and #82 is a decision
> issue with an explicit "no workflow edit" out-of-scope line. The decision that actually matters here is
> not caching or matrices: it is **how a new package acquires required checks**, because a job that is not
> in branch protection's required list blocks nothing, and today that list is nine hand-maintained
> context names.

**Goal:** One recorded CI model defining job ownership, discovery, Node matrix, status naming, failure
semantics, secret gating, and the mandatory closure and mutation checks every package must run.

**Status at this baseline:** BLOCKED ON #80 (owner), which is unanswered.

**Blast radius if unanswered:** #85 directly; #88 depends on #85.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #82, OPEN, labels `question` `verification` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependency | #80 — **open, unanswered** |
| Native GitHub blockers | `blocked_by` is `0` |
| Workflow | `.github/workflows/ci.yml` — pushes to `main` and every PR |
| Required contexts on `main` (9) | `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |
| Not required | `coverage`; the CodeScene App's own Check Run (**its context name varies by base branch**); `release-please` |
| Job shape today | hand-written per workspace: `ci / lint\|test\|audit` for research, `sdk`, `contract` |
| SDK Node matrix | `24.2.0`, `26.5.0` (`compatibility.json.node.ciVersions`) |
| Matrix-safe subset | `npm run test:matrix` — excludes git/package/coherence gates |
| Contract + research engines | `>=26.5.0` |
| Path class | `.github/workflows/` and `.github/scripts/` → both `governance_core` |
| Runners | repo-scoped ARC labels; a wrong `RUNNER_LABEL` queues a job for hours instead of failing |
| Sonar | self-hosted; a red `sonar` is more often the server; the job retries once after 30 s and prints failing conditions |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The real question is required-check acquisition, not job authorship

Nine contexts are pinned in branch protection by hand. Adding a job to `ci.yml` does **not** make it
required. So "each planned package has required checks" — #82's first acceptance criterion — is only half
a CI decision; the other half is a repository-settings action the owner must take, and there is no
mechanism that reminds anyone. **A CI topology that does not say how a new job becomes required has not
decided the thing that matters.**

Two shapes solve it:

| Shape | Mechanism | Consequence |
| --- | --- | --- |
| **Stable aggregate** | One required context per concern (`sdk`, `contract`, …) whose job internally fans out over packages | Branch protection never changes as packages are added; a new package is covered the day it appears |
| **Per-package context** | `sdk-core`, `sdk-node`, … each required | Precise failure attribution; every new package needs a settings edit that nothing enforces |

**Recommend the stable aggregate**, precisely because the CodeScene App's own Check Run already
demonstrates the failure mode: its context name varies by base branch, which is why it cannot be required
at all. Context names that move are context names that cannot be gates.

### F2 — Node matrices differ per workspace and cannot be unified

SDK runs `24.2.0` and `26.5.0`; contract and research declare `>=26.5.0`. A single repository-wide matrix
would either run the contract workspace on Node 24 (outside its declared range) or drop Node 24 from the
SDK (which `test:matrix` exists to exercise). **The matrix belongs to the package, not the workflow.**
Record that as a rule, not as a per-package accident.

### F3 — `test:matrix` already encodes which gates are matrix-safe, and that split must survive

`test:matrix` deliberately omits git, package, and coherence gates because they are repository-level, not
runtime-level, and running them twice proves nothing. Any per-package CI model must keep the distinction:
**runtime gates run per Node version; repository gates run once.** A model that runs `validate` on every
matrix leg is wrong and slow.

### F4 — Production-only closure tests must run outside any workspace root

#82's required work asks for "production-only closure tests" per package. #70's `check-package-contents.mjs`
performs a real packed install; if #80 selects a hoisting topology, that install must happen in a clean
directory **outside** the workspace root or hoisting satisfies undeclared imports and the gate passes a
broken tarball. This is the one place where #80's answer materially changes #82's.

### F5 — Secret gating is already correct and must not regress

Nothing in the current jobs gives fork or Dependabot PRs restricted secrets, and static checks run
regardless. `sonar` is the only job with a token-shaped dependency. The rule to record: **static and
mutation checks run on untrusted PRs; token-gated analysis may be skipped, and a skip must be visibly a
skip, not a pass.** That last clause is #191's defect class again, and it belongs in the decision.

### F6 — Runner labels are repo-scoped and a wrong one hangs rather than fails

A wrong `RUNNER_LABEL` queues a job for hours instead of failing fast. Any model that adds jobs must
declare where runner labels come from and how a wrong one is detected. Recommend: a single declared label
constant, not a per-job literal.

### F7 — This decision writes no YAML, and that constraint is worth restating

#82's out-of-scope line: no workflow edit, no settings change, no runner, no secret, no package
implementation. The deliverable is a record. #85 implements it.

---

## The decision, as the owner should see it

Five sub-decisions, each with a recommendation:

| Sub-decision | Options | Recommendation |
| --- | --- | --- |
| Job ownership | one job per package · one job per concern fanning out | **per concern (stable aggregate)** — F1 |
| Discovery | explicit list · filesystem discovery | **explicit list** — a package silently missing from CI is worse than a merge conflict |
| Node matrix | repository-wide · per package | **per package** — F2 |
| Gate split | everything per leg · runtime per leg, repository once | **runtime per leg, repository once** — F3 |
| Status naming | per package · per concern, stable | **per concern, stable** — F1 |

Plus three rules to record: production-only closure outside the workspace root (F4); untrusted PRs get
static + mutation checks and no restricted secrets, with skips visibly distinct from passes (F5); one
declared runner label (F6).

---

## Task 0: Gate and re-verify

- [ ] 0.1 **Confirm #80 is answered.** F4 depends on it.
- [ ] 0.2 Read `.github/workflows/ci.yml` end to end and record every job's runner, checkout depth,
      install strategy, and Node setup.
- [ ] 0.3 Re-read the nine required contexts from branch protection and confirm which jobs are **not**
      required.
- [ ] 0.4 Confirm `test:matrix`'s exclusions (F3) from `package.json`.

## Task 1: Post the decision brief

- [ ] 1.1 Lead with F1 — required-check acquisition is the decision, and the CodeScene App's varying
      context name is the proof.
- [ ] 1.2 Include the five sub-decisions with recommendations.
- [ ] 1.3 State the F4 dependency on #80's answer explicitly.
- [ ] 1.4 Carry the AI-triage disclaimer; `needs-triage` → `ready-for-human`.

## Task 2: When the owner answers

- [ ] 2.1 Root ADR recording all five sub-decisions and the three rules.
- [ ] 2.2 Record the mandatory per-package check set: build, typecheck, runtime tests, production-only
      packed install, and at least one deterministic mutation control (PLAN-074's shape).
- [ ] 2.3 Record the failure semantics: fail closed; a missing required static validation is a failure, not
      a skip.
- [ ] 2.4 Comment on #85 with the model.
- [ ] 2.5 **Validate representative workflow shapes read-only** — #82's own verification step. Do not
      commit YAML.

## Task 3: Close

- [ ] 3.1 Close #82 naming the model and the ADR.
- [ ] 3.2 Tick #82 in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#82) | Where satisfied |
| --- | --- |
| Each planned package has required checks | stable-aggregate decision (F1) |
| Node versions/lockfiles explicit | per-package matrix rule (F2) |
| Secret work gated without bypassing static checks | F5 rule |
| Status names and failure semantics stable | F1 + Task 2.3 |

## Risks and open questions

- **Deciding job shape without deciding required-check acquisition** produces a document that reads
  complete and changes nothing. F1 is the load-bearing part.
- **Per-package contexts feel more precise and are a trap** — every new package needs a settings edit that
  no gate enforces.
- **Open question for the owner:** should `coverage` become required? It currently passes and is not
  required, which means coverage can silently collapse. That is adjacent to #82 and worth deciding in the
  same sitting, but it is not in #82's scope — file it separately rather than folding it in.

## What this does not authorize

Editing any workflow, changing branch protection, deploying runners, creating secrets, or implementing any
package.

## What this plan did not verify

How the existing jobs install dependencies and whether they use full-depth checkouts (Task 0.2). Both
constrain the model and neither is recorded anywhere.
