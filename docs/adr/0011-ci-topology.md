# ADR 0011: Ratify the multi-package CI topology

- Status: Accepted
- Date: 2026-09-03
- Decision made by: Claude (automated agent), under explicit delegation from
  the project owner on 2026-09-03 ("I dont have time to make decisions, you
  must do for me")
- Decision owners: NOT a human owner decision. This ADR records a delegated
  technical decision. It is not an exact-commit owner authorization and does
  not satisfy any gate that requires one.

## Context

GitHub #82 requires exactly one recorded multi-package CI topology decision: choose job ownership, caching, Node matrix, discovery, statuses, and private-analysis behavior; preserve fork/Dependabot secret safety; define mandatory closure and mutation checks. The issue's source-plan traceability is PLAN-010 (explicit CI ownership for every future package) and PLAN-076 (decide package topology, release model, and CI model separately).

The 2026-09-02 decision brief (issue comment 5511424245, AI-triage) presented the decision axes with recommendations; the decision was recorded on 2026-09-03 in issue comment 5530083065. `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` — the decision is a delegated technical decision, not a human owner sign-off, and nothing downstream may cite it as the owner's exact-commit authorization for anything. It authorizes no production, publication, deployment, real-user, or delivery-infrastructure work.

### F1 — required-check acquisition is the load-bearing fact

Ten contexts are pinned in branch protection by hand (nine original contexts plus `coverage` added under #271): `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`, `coverage`. Adding a job to `ci.yml` does not make it required — a job becomes required only when repository settings change, and nothing in the repository enforces or reminds anyone to make that edit. A per-package job model therefore silently degrades every time a package is added: the job runs, it is not required, and a red one cannot block a merge.

Live proof that moving context names cannot be gates: the CodeScene App (slug `codescene-access`) reports its check run as `CodeScene Code Health Review (main)` — verified live at the head of PR #273 (2736ad9e, conclusion success), where the parenthetical is the base branch. A PR against any other base renames the context, which is exactly why the App check is absent from the required list while the stable workflow job `codescene delta` is present.

## Decision

The ratified topology, recorded verbatim in substance from issue comment 5530083065:

| Sub-decision | Decision |
| --- | --- |
| Job ownership | One job per concern, fanning out over the declared package list |
| Discovery | Explicit declared list, plus a both-directions completeness assertion |
| Node matrix | Per package |
| Gate split | Runtime gates per matrix leg; repository-level gates once |
| Status naming | Per concern, stable |

One stable required context per concern means branch protection never changes as packages are added, and a new package is covered the day it enters the list.

### Package discovery: explicit declared list, provably complete

Discovery is an explicit declared list, but not on the brief's original reasoning alone — that reasoning was incomplete, because an explicit list has its own silent-failure mode and it is the likelier one: someone adds a package, forgets to list it, the package is uncovered, and nothing fails. The decision is therefore the explicit list plus a mechanical assertion that the list is complete: a gate enumerates the packages actually present and fails closed in both directions — a package on disk absent from the list, and a listed package that no longer exists. Today the enumeration is exact and cheap:

```
git ls-files '*package.json' | grep -v node_modules
  contracts/security-audit/package.json
  packages/security-audit-sdk-core/package.json
  research/browser-telemetry/package.json
```

Three packages, three entries (verified live at materialization); the #87 Node binding becomes the fourth. This is the repository's existing idiom — `check-coherence.mjs` pins counts and fails on drift; `check-scope.mjs` classifies every path rather than sampling. A single glob could not discover these packages anyway: they sit under three different roots (`contracts/`, `packages/`, `research/`), which independently rules out pure filesystem discovery.

### Node matrix: per package, forced rather than chosen

The SDK runs `24.2.0` and `26.5.0` (`compatibility.json` `node.ciVersions`; engines `>=24 <25 || >=26 <27`), while the contract and research workspaces declare `>=26.5.0`. A repository-wide matrix must either run the contract outside its declared range or drop Node 24 from the SDK; there is no third option, so the matrix belongs to the package.

### Gate split: runtime per matrix leg, repository-level once

Runtime gates run on every matrix leg. Repository-level gates — the gates that assert facts about the repository rather than about a runtime — run once per change. The split follows the existing `test:matrix` script, which omits `test:git`, `test:package`, `test:coherence`, and six further repository-level gates (`test:contract-immutability`, `test:publication-path`, `test:changed-paths`, `test:governance-history`, `test:archive-attestations`, `test:verification`); running those once per matrix leg multiplies cost and proves nothing new.

### The three binding rules

1. **Production-only closure outside any workspace root.** The packed-install control (`check-package-contents.mjs` / `packed-completeness.mjs`) must keep performing a real production-only install of the packed tarball into a clean consumer directory outside any workspace root — offline, scripts disabled, entry points imported by package specifier. ADR 0003 requires the real install; ADR 0009 pins the outside-any-root rule. Under standalone topology there is no hoisting and therefore no workspace-root masking, but the rule stands as recorded because it is what makes the control meaningful if the topology is ever revisited. `check-scope.mjs` (reads source) and `check-dependencies.mjs` (reads shipped artifacts) are unaffected by hoisting and are not substitutes.
2. **Untrusted PRs: static and mutation checks, no restricted secrets, skips visibly distinct from passes.** Fork and Dependabot PRs must not receive restricted secrets, and they do receive the static and mutation checks. Token-gated analysis (`sonar`, CodeScene) may be skipped for them, but a skip must render as a skip and never as a pass-shaped green — the #191 defect class, and the single most dangerous failure mode in this list, because it produces a green board that has verified nothing. It compounds with a known tooling gap: `gh pr checks --required` lists only contexts that have reported, so a check that never started is invisible there. Any merge gate must therefore count against branch protection's declared context list, never against the reported set.
3. **One declared runner-label constant.** Runner labels are repository-scoped (`vars.RUNNER_LABEL` today). A wrong literal does not fail fast — it queues the job until it times out, which has previously cost hours. One declared constant, never per-job literals.

### Mandatory per-package check set and failure semantics

Each declared package carries the mandatory check set: build, typecheck, runtime tests, the production-only packed install, and at least one deterministic mutation control. Failure semantics fail closed: a missing required static validation is a failure, not a skip, and nothing may render that missing validation as a pass-shaped green.

### Status naming and required-context acquisition semantics

The ten pinned contexts are the stable set the model keeps. Every pinned name is per concern, not per package: `ci / lint`, `ci / test`, and `ci / audit` are concern names whose job fans out over packages (the job id stays `ci` while the package is a parameter), and `sdk`, `contract`, `coverage`, `sonar`, `conventional-commits`, `codescene delta`, and `design-pattern-governance` name concerns, not packages. Adding the #87 package therefore changes zero pinned context names and requires zero branch-protection edits; a new concern is the only thing that ever requires a settings edit, and nothing enforces that edit — which is precisely F1 and the reason one-job-per-concern is the ratified shape. Token-gated analysis may be skipped for untrusted PRs, but a skipped required context renders as a skip and merge gating counts the declared list, so a skip never reads as a pass.

## Read-only workflow-shape validation

The issue's verification section requires validating representative workflow shapes read-only. Performed at materialization time against `origin/main` `e35e3e9` (the ratify-ci-topology proposal merge), reading `.github/workflows/ci.yml` (414 lines), `conventional-commits.yml`, and `release-please.yml` without modification — `.github/workflows/` and `.github/scripts/` are governance-core paths and are out of scope for this decision.

Mapping of the ten required contexts to the model's stable aggregates and today's jobs:

| Required context (live, branch protection) | Today's source (at e35e3e9) | Model aggregate |
| --- | --- | --- |
| `ci / lint` | `ci` job — reusable `nandohdc/gh-pipelines` `ci-node.yml@v1`, `lint-script: lint`, package selected via `working-directory` | per-concern lint job fanning out over the declared list |
| `ci / test` | `ci` job — test step of the same reusable workflow | per-concern runtime-test job fanning out |
| `ci / audit` | `ci` job — audit step, `audit-level: high` | per-concern audit job fanning out |
| `sdk` | `sdk` job — SDK validate chain: build, typecheck, runtime, packed install (`test:package`), mutation (`test:verification`), plus `npm audit --audit-level=low` | the SDK package's mandatory check-set aggregate; stable name |
| `contract` | `contract` job — `validate-contract.mjs --all` plus contract tests, `npm audit --audit-level=high` | the contract package's check-set aggregate; stable name |
| `sonar` | `sonar` job — repository scan, `needs: [ci, sdk, contract, coverage]` | repository-level concern, once per change |
| `conventional-commits` | `conventional-commits.yml` (separate workflow file) | repository-level concern, once per change |
| `codescene delta` | `codescene-delta` job (`name: codescene delta`) | repository-level concern, once per change |
| `design-pattern-governance` | `design-pattern-governance` job — checker, dual check, CRA, governance tests | repository-level concern, once per change |
| `coverage` | `coverage` job — aggregate coverage collection and enforcement | repository-level concern, once per change |

Findings of the read-only validation:

- All ten pinned contexts are already per-concern names; none embeds a package identity that moves when a package is added. The ratified model expresses today's required-context set with zero context-name churn: branch protection as it stands is already the model's stable aggregate set.
- The fan-out shape is already proven in-repo: the `ci` job keeps its job id `ci` (so the `ci / lint|test|audit` contexts keep their names) while `working-directory: research/browser-telemetry` selects the package. The model generalizes exactly that shape over the declared list.
- The CodeScene App check run was verified live at the PR #273 head: `CodeScene Code Health Review (main)`, conclusion success, not among the pinned contexts — while the stable `codescene delta` workflow job is. This is the live proof that names that move cannot be gates.
- The per-package Node matrix expresses today's jobs without contradiction: ci.yml runs its Node-dependent jobs on 26 (`sonar` on 22 for scanner compatibility; `codescene-delta` sets up no Node), and the model's only addition is the SDK's declared Node 24.2.0 leg from `compatibility.json`, which today's single-version jobs simply do not exercise.
- The gate split matches the existing `test:matrix` precedent (verified above): nine repository-level gates are already excluded from the per-leg set.
- The three rules match today's shape: the SDK validate chain already performs the production-only packed install (rule 1); ci.yml exposes no restricted secret to fork/Dependabot paths and the `codescene-delta` job already renders install-failure skips as warnings with an advisory exit (rule 2, partially — the full skip-rendering semantics are #85's materialization); and every job already reads `vars.RUNNER_LABEL` with no per-job literals (rule 3).
- The completeness enumeration was re-run live at materialization and matches the declared three packages exactly, so the assertion's today-baseline is sound.

This validation proves the chosen model can express today's ten required contexts and today's `ci.yml` jobs without settings churn. It performs no workflow edit: nothing under `.github/` was modified, generated, or committed.

## Acceptance-criteria mapping (#82)

- Each planned package has required checks — D1 (one job per concern, stable contexts) plus the both-directions completeness assertion plus the mandatory check set: a new package is covered the day it enters the declared list with no settings edit, and a package left off the list fails the assertion.
- Node versions/lockfiles are explicit — the per-package Node matrix records each package's declared engine range; lockfiles stay per package under the standalone topology (ADR 0009).
- Secret work is gated without bypassing static checks — rule 2: untrusted PRs get static and mutation checks with no restricted secrets; token-gated analysis may skip but renders visibly as a skip, never a pass-shaped green.
- Status names/failure semantics are stable — D1 stable per-concern names plus fail-closed semantics: a missing required static validation is a failure, not a skip.
- Validate representative workflow shapes read-only — the validation section above.

The coverage question — whether `coverage` must become a required context, given that it passes today, is not required, and can silently collapse — was tracked separately as issue #271 and resolved by adding `coverage` as the tenth pinned context.

## Scope boundary

This ADR records a decision only. It authorizes no workflow edit, no branch-protection settings change, no runner, no secret, and no package implementation. Implementation belongs to the later governed change #85, which must pass review and every required gate on its own merits. Because the decision is delegated and not a human owner decision, any gate requiring genuine owner authorization still requires one; this ADR does not substitute.

## Revisit conditions

The decision is re-opened when any of the following becomes true:

- branch protection acquires a mechanism that makes required-context registration automatic (removing F1's force);
- a package legitimately needs a Node range incompatible with per-package matrices;
- the repository moves off standalone topology, which would reintroduce the workspace-root masking risk that rule 1 exists to bound.

## Consequences

- Branch protection's ten pinned contexts remain stable as packages are added; no settings churn per package.
- A package present on disk but missing from the declared list, or listed but absent, fails the completeness assertion closed — silent coverage loss is impossible.
- The SDK keeps its Node 24 matrix leg and the contract/research workspaces stay inside their declared `>=26.5.0` range.
- Merge gating counts branch protection's declared context list, never the reported set, so a check that never started cannot read as a pass.
- Runner labels have a single declared constant; a typo cannot scatter per-job literals that queue for hours.
- No repository change is performed by this decision; #85 owns the workflow materialization under its own governed change.

## Alternatives considered

- One job per package with per-package context names — rejected. F1: branch protection grows by hand for every package, and a red per-package job that is not required cannot block a merge; the model silently degrades on every package addition.
- Pure filesystem discovery by glob — rejected. No single glob reaches packages under three different roots; and discovery without the declared list cannot assert completeness.
- Explicit list without the completeness assertion — rejected. It relocates the silent-coverage failure instead of removing it: a package added and left off the list is uncovered and nothing fails.
- Repository-wide Node matrix — rejected. It must run the contract outside its declared `>=26.5.0` range or drop Node 24 from the SDK; there is no third option.
- Every gate on every matrix leg — rejected. Repository-level gates assert facts about the repository, not a runtime; per-leg repetition multiplies cost and proves nothing new.
- Relaxing the packed-install control to a dry-run, a source/shipped-artifact read, or a consumer inside a workspace root — rejected. That is the masking risk ADR 0009's measurement bounds; weakening the control would silently defeat the surviving gate.
- Rendering token-gated skips as pass-shaped greens, or counting merge readiness from the reported set only — rejected. That is the #191 defect class: a green board that has verified nothing, compounded by `gh pr checks --required` listing only contexts that have reported.
- Per-job runner-label literals — rejected. They decentralize the one value a typo in can cost hours of queue time.

## Traceability

- GitHub #82 — decision brief comment 5511424245 (2026-09-02); decision comment 5530083065 (2026-09-03).
- OpenSpec change `ratify-ci-topology` — proposal merged on 2026-09-03 as PR #273 (proposal head 2736ad9e, merge e35e3e93); the normative delta is `openspec/changes/ratify-ci-topology/specs/ci-topology/spec.md`.
- This ADR is the decision record materialized by Hermes task t_260abc14; #85 owns implementation.
