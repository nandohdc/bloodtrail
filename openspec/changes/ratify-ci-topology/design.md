## Context

See `proposal.md` for motivation and the delta specification for the normative behavior. The decision this change ratifies was recorded on GitHub #82 (issue comment 5530083065, 2026-09-03) in answer to the 2026-09-02 decision brief (issue comment 5511424245). Repository evidence, verified read-only on 2026-09-03 against `origin/main` `29ab7e7f0f75da8cf945055069092dcc58065e4b`:

- Branch protection pins nine contexts by hand: `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`.
- `git ls-files '*package.json' | grep -v node_modules` yields exactly `contracts/security-audit/package.json`, `packages/security-audit-sdk-core/package.json`, `research/browser-telemetry/package.json` — three packages under three different roots.
- Engine ranges: SDK `>=24 <25 || >=26 <27` with `compatibility.json` `node.ciVersions: ["24.2.0", "26.5.0"]`; contract and research `>=26.5.0`.
- `test:matrix` omits `test:git`, `test:package`, `test:coherence`, and six further repository-level gates from the per-leg set.
- `.github/workflows/ci.yml` uses `${{ vars.RUNNER_LABEL || 'ubuntu-latest' }}` per job today; the CodeScene App check run is reported as `CodeScene Code Health Review (main)` — the base branch is part of the context name.
- ADR 0003 requires the package gate's real production-only install (offline, scripts disabled, entry points imported by package specifier); ADR 0009 pins the packed-install control outside any workspace root.

The decision is a delegated technical decision: `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"`. It is not a human owner sign-off, is not an exact-commit owner authorization for anything, and does not satisfy gates that specifically require a human owner decision.

This change is records only. It touches nothing outside `openspec/changes/ratify-ci-topology/`. A second OpenSpec change (`implement-duplicate-core-diagnostic`, #79) is active at proposal time; this change touches no `contracts/` path, so the two changes do not collide, and if `design-pattern-governance` reports a CRA diagnostic naming the other active change, that is the known cross-change artifact (bloodtrail #260), not a defect of this change.

## Goals / Non-Goals

**Goals:**

- Ratify the recorded #82 decision as the `ci-topology` capability with deterministic, testable requirements.
- Encode one job per concern with stable per-concern context names, so branch protection never changes as packages are added.
- Encode the explicit declared package list together with the amendment: a mechanical completeness assertion failing closed in both directions.
- Encode the per-package Node matrix, the runtime-per-leg/repository-once gate split, and the three binding rules.
- Encode the mandatory per-package check set (build, typecheck, runtime tests, production-only packed install, at least one deterministic mutation control) and fail-closed failure semantics (a missing required static validation is a failure, not a skip).
- Record the decision's provenance verbatim and its scope boundary: no workflow edit, no branch-protection change, no runner, no secret, no package implementation.

**Non-Goals:**

- No workflow edit: `.github/workflows/` and `.github/scripts/` are governance-core paths and are untouched.
- No branch-protection settings change, no runner provisioning, no secret provisioning.
- No package implementation and no `contracts/` change.
- No decision on whether `coverage` becomes a required context — that is deliberately out of scope and filed as its own issue.
- No re-authoring of the decision: the proposal encodes the recorded decision; it does not re-litigate the brief's recommendations.

## Decisions

### D1 — One job per concern with stable per-concern context names

The ratified job ownership is one job per concern fanning out over the declared package list, with one stable required context per concern. Branch protection pins nine contexts by hand, adding a job does not make it required, and only a repository-settings edit does; a per-package job model silently degrades every time a package is added. The CodeScene App's check run proves that names that move cannot be gates: `CodeScene Code Health Review (main)` embeds the base branch, so any other base renames the context and it silently stops blocking.

The rejected alternative is one job per package with per-package context names. It makes branch protection grow by hand for every package and produces exactly the silent degradation F1 identifies: the job runs, it is not required, and a red one cannot block a merge.

### D2 — Explicit declared list, plus a both-directions completeness assertion

Discovery is an explicit declared list, amended over the brief's reasoning. The brief argued an explicit list is safer because a missing package yields a merge conflict rather than silence; that reasoning is incomplete, because an explicit list has its own silent-failure mode and it is the likelier one — someone adds a package, forgets to list it, the package is uncovered, and nothing fails. The decision is therefore the explicit list **plus** a mechanical assertion that the list is complete: a gate enumerates the packages actually present (`git ls-files '*package.json' | grep -v node_modules`) and fails closed in both directions — a package on disk absent from the list, and a listed package that no longer exists. This matches the repository's existing idiom (`check-coherence.mjs` pins counts and fails on drift; `check-scope.mjs` classifies every path rather than sampling).

The rejected alternatives are filesystem discovery by glob and the explicit list without the assertion. A single glob cannot discover packages under three different roots (`contracts/`, `packages/`, `research/`), which independently rules out pure filesystem discovery; and the unasserted list relocates the silent-coverage failure instead of removing it.

### D3 — Per-package Node matrix

The Node matrix belongs to the package. The SDK runs `24.2.0` and `26.5.0` (`compatibility.json` `node.ciVersions`), while the contract and research workspaces declare `>=26.5.0`. A repository-wide matrix must either run the contract outside its declared range or drop Node 24 from the SDK; there is no third option.

The rejected alternative is a repository-wide Node matrix, for exactly that forced choice.

### D4 — Runtime gates per matrix leg, repository-level gates once

Runtime gates run on every matrix leg; repository-level gates run once per change. The split follows the existing `test:matrix` script, which already omits `test:git`, `test:package`, `test:coherence`, and six other repository-level gates: those assert facts about the repository, not about a runtime, and running them once per leg multiplies cost and proves nothing new.

The rejected alternative is running every gate on every matrix leg, which repeats repository-level assertions per leg with no new evidence.

### D5 — Packed-install closure stays production-only and outside any workspace root

The packed-install control (`check-package-contents.mjs` / `packed-completeness.mjs`) keeps performing a real production-only install of the packed tarball into a clean consumer directory outside any workspace root — offline, scripts disabled, entry points imported by package specifier. ADR 0003 requires the real install; ADR 0009 pins the outside-any-root rule. Under standalone topology there is no hoisting and therefore no workspace-root masking, but the rule stands as recorded because it is what makes the control meaningful if the topology is ever revisited. `check-scope.mjs` (reads source) and `check-dependencies.mjs` (reads shipped artifacts) are unaffected by hoisting and are not substitutes.

The rejected alternative is relaxing the control to a dry-run or to a source/shipped-artifact read, or relocating the consumer inside a workspace root: that is the masking risk ADR 0009's measurement bounds, and weakening the control would silently defeat the surviving gate.

### D6 — Untrusted PRs: static and mutation checks, no restricted secrets, visible skips

Fork and Dependabot PRs receive no restricted secrets and do receive the static and mutation checks. Token-gated analysis (`sonar`, CodeScene) may be skipped for them, but a skip renders as a skip and never as a pass-shaped green — the #191 defect class is the single most dangerous failure mode in this list because it produces a green board that has verified nothing. Merge gates count against branch protection's declared context list, never against the reported set: `gh pr checks --required` lists only contexts that have reported, so a check that never started is invisible there.

The rejected alternative is rendering token-gated skips as pass-shaped greens and counting merge readiness from the reported set only. That is exactly the defect class that produces a green board with nothing verified behind it.

### D7 — One declared runner-label constant

Runner labels are repository-scoped (`vars.RUNNER_LABEL` today). A wrong literal does not fail fast — it queues the job until it times out, which has previously cost hours. The ratified shape is one declared constant, never per-job literals.

The rejected alternative is per-job label literals, which decentralize the one value a typo in can cost hours of queue time.

### D8 — Mandatory per-package check set with fail-closed semantics

Each declared package carries the mandatory check set: build, typecheck, runtime tests, the production-only packed install, and at least one deterministic mutation control. Failure semantics fail closed: a missing required static validation is a failure, not a skip, and nothing may render it as a pass-shaped green.

The rejected alternative is a permissive posture in which a missing validation degrades to a skip or a green. That posture is indistinguishable from the coverage collapse the brief already identifies for unrequired checks.

### D9 — The ratification is records only, with provenance recorded verbatim

The change adds planning artifacts only, strictly inside `openspec/changes/ratify-ci-topology/`. It records `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` wherever the decision's source is named, does not cite the decision as an owner's exact-commit authorization, and does not let it satisfy gates requiring a human owner decision. Implementation belongs to the later governed change #85.

The rejected alternative is treating the delegated decision as an owner sign-off. That would misattribute authority the owner did not exercise, and it would let a technical decision substitute for a gate that specifically requires the owner.

### D10 — Revisit conditions are recorded, not speculated on

The decision re-opens when branch protection acquires automatic required-context registration (removing the force behind one-job-per-concern), when a package legitimately needs a Node range incompatible with per-package matrices, or when the repository moves off standalone topology. The conditions are recorded as gates; no prediction is made about whether any will occur.

## Migration Plan

1. Land the proposal packet (`proposal.md`, `assessment.json`, `design.md`, the `ci-topology` delta spec, `tasks.md`) as a proposal-only commit and PR against `origin/main`; every task stays unchecked. Do not merge.
2. #85, the later governed change, materializes the ratified topology in the workflows; it must pass review and every required gate on its own merits, and any gate requiring genuine owner authorization still requires the owner.
3. After implementation and merge under #85, fold the `ci-topology` delta into `openspec/specs/ci-topology/spec.md` in a separate active-change canonical-fold commit, proving a second semantic application is a no-op.
4. Archive this change after merge in a separate byte-preserving relocation commit.

Rollback before merge is removal of the unmerged proposal. After the delta is folded, changing the ratified topology requires a new governed change rather than an edit to this record.

## Risks / Trade-offs

- [A package is added and left off the list] → Covered by the both-directions completeness assertion (D2): the enumeration gate fails closed and names the uncovered package.
- [A context name silently stops matching branch protection] → Covered by D1: only stable per-concern names are gates; the CodeScene App evidence is recorded as the reason moving names cannot gate.
- [A skipped token-gated analysis looks green] → Covered by D6: skips render visibly as skips and merge gates count declared contexts, not reported ones.
- [A wrong runner label queues a job for hours] → Covered by D7: one declared constant, never per-job literals.
- [The delegated decision is misread as owner approval] → The provenance string is recorded verbatim in the proposal, design, and delta; the assessment's forces name it; downstream gates requiring the owner still require the owner.
- [The active #79 change collides with this one] → This change touches nothing under `contracts/` and stays strictly inside its own change directory; a CRA diagnostic naming the other change is the known cross-change artifact (bloodtrail #260) and is reported, not "fixed" by widening scope.
- [Prose is mistaken for implementation authorization] → Every task stays unchecked; implementation, review, merge, and archive tasks remain pending until their exact-commit gates fire.

## Open Questions

None that block the proposal. The five sub-decisions, the amendment, the three rules, the mandatory check set, and the failure semantics are all settled by the recorded decision. The `coverage`-required question is deliberately out of scope and is tracked as its own issue. Implementation details left to #85 include the exact workflow file organization, the mechanics of the completeness-assertion gate, and the placement of the runner-label constant, all bounded by the requirements above.
