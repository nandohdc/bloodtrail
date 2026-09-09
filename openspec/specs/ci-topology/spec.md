# ci-topology Specification

## Purpose

Records the ratified Bloodtrail multi-package CI topology: one job per concern with stable per-concern status naming, an explicit declared package list with a mechanical completeness assertion failing closed in both directions, the per-package Node matrix, the runtime-per-leg/repository-once gate split, the three binding rules, the mandatory per-package check set with fail-closed failure semantics, the decision provenance and scope boundary, and the revisit conditions.

The decision source is recorded verbatim wherever this capability refers to it: `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"`. It is a delegated technical decision, not a human owner sign-off.

## Requirements

### Requirement: Job ownership is one job per concern with stable context names

CI SHALL model each concern as one job fanning out over the declared package list, with one stable required context per concern. A job's context name SHALL NOT change when a package is added to the declared list: branch protection pins ten required contexts by hand, adding a job does not make it required, and only a repository-settings edit does. One stable context per concern means branch protection never changes as packages are added and a new package is covered the day it enters the list. A context name that moves with a trigger SHALL NOT be a gate, because the CodeScene App reports its check run as `CodeScene Code Health Review (main)` — the parenthetical is the base branch — so a PR against any other base renames the context and it silently stops being the thing that was pinned.

#### Scenario: Adding a package does not change any required context name
- **WHEN** a new package is added to the declared package list
- **THEN** every required context name stays byte-identical and no branch-protection edit is needed

#### Scenario: A new package is covered the day it enters the list
- **WHEN** a package appears in the declared list while its per-concern jobs run
- **THEN** that package is exercised by every per-concern job without any repository-settings change

#### Scenario: A moving context name is not a gate
- **WHEN** a check run renames its context per base branch, as the CodeScene App does
- **THEN** that check run is not eligible as a pinned required context, because the pinned name would silently stop matching

#### Scenario: Required contexts include coverage
- **WHEN** branch protection required status checks are evaluated
- **THEN** the required set contains exactly ten pinned contexts: `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`, and `coverage`

### Requirement: Package discovery is an explicit declared list with a completeness assertion

The CI package set SHALL be an explicit declared list, not filesystem discovery. A mechanical completeness assertion SHALL enumerate the packages actually present in the repository and SHALL fail closed in both directions: a package on disk absent from the declared list is a failure, and a listed package that no longer exists is a failure. The enumeration is exact and cheap: `git ls-files '*package.json' | grep -v node_modules` yields exactly `contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, and `research/browser-telemetry`. The assertion SHALL verify in CI that the discovered package count is nonzero and matches the declared count. A single filesystem glob SHALL NOT be the discovery mechanism, because the packages sit under three different roots (`contracts/`, `packages/`, `research/`) and no single glob can discover them.

#### Scenario: Declared list matches the on-disk packages
- **WHEN** the completeness assertion enumerates packages via `git ls-files '*package.json' | grep -v node_modules` and compares them against the declared list
- **THEN** the enumerated set equals the declared set exactly across all four packages and the assertion passes

#### Scenario: A package on disk missing from the list fails
- **WHEN** a package exists on disk with its own `package.json` but is absent from the declared list
- **THEN** the completeness assertion fails, naming the uncovered package

#### Scenario: A listed package that no longer exists fails
- **WHEN** the declared list names a package whose `package.json` no longer exists on disk
- **THEN** the completeness assertion fails, naming the phantom entry

#### Scenario: Discovered count is asserted in CI
- **WHEN** package discovery runs during CI execution
- **THEN** it asserts that the discovered package count is nonzero and exactly matches the 4 declared packages

#### Scenario: A single glob cannot discover the packages
- **WHEN** discovery is attempted with one filesystem glob
- **THEN** no single glob reaches all three package roots, so glob discovery is not the ratified discovery mechanism

### Requirement: The Node matrix belongs to the package

The Node version matrix SHALL be per package, not repository-wide. The SDK SHALL run its matrix on `24.2.0` and `26.5.0` (`compatibility.json` `node.ciVersions`), and the contract and research workspaces SHALL run on Node `>=26.5.0`, matching their declared `engines` ranges (`>=24 <25 || >=26 <27` for the SDK; `>=26.5.0` for contract and research). CI workflows SHALL pin exact declared Node versions rather than floating major tags, preventing unverified upstream runtime drift. A repository-wide matrix SHALL NOT be the ratified shape: it would either run the contract outside its declared `>=26.5.0` range or drop Node 24 from the SDK.

#### Scenario: SDK legs run both declared Node versions
- **WHEN** the SDK matrix legs execute
- **THEN** they run on exactly `24.2.0` and `26.5.0`, both inside the declared `>=24 <25 || >=26 <27` range

#### Scenario: Contract and research legs run inside their declared range
- **WHEN** the contract and research matrix legs execute
- **THEN** each runs on a Node version satisfying `>=26.5.0`

#### Scenario: A repository-wide matrix is rejected
- **WHEN** a candidate topology proposes one Node matrix for the whole repository
- **THEN** that candidate is not the ratified topology, because it must run the contract below `>=26.5.0` or drop the SDK's Node 24 matrix

#### Scenario: CI workflow pins exact declared Node versions
- **WHEN** CI workflow jobs execute for Node-dependent packages
- **THEN** they request exact pinned versions (`26.5.0` and `24.2.0`) matching `compatibility.json` rather than floating major tags

### Requirement: Gate split is runtime per matrix leg and repository-level once

Runtime gates SHALL run on every matrix leg. Repository-level gates — the gates that assert facts about the repository rather than about a runtime — SHALL run once per change, never once per matrix leg. The split follows the existing `test:matrix` precedent, which omits `test:git`, `test:package`, `test:coherence`, and six further repository-level gates; running those once per matrix leg multiplies cost and proves nothing new.

#### Scenario: Runtime gates run on every leg
- **WHEN** a matrix leg executes
- **THEN** the runtime gates for that package run on that leg

#### Scenario: Repository-level gates run once per change
- **WHEN** a change runs through CI
- **THEN** the repository-level gates omitted from `test:matrix` (`test:git`, `test:package`, `test:coherence`, and the remaining six) execute once, not once per matrix leg

#### Scenario: A leg does not multiply repository-level gates
- **WHEN** the matrix expands to more legs
- **THEN** the number of repository-level gate executions stays one per change

### Requirement: Packed-install closure stays production-only and outside any workspace root

The packed-install control SHALL keep performing a real production-only install of the packed tarball into a clean consumer directory outside any workspace root — offline, scripts disabled, entry points imported by package specifier. ADR 0003 requires the real install; ADR 0009 pins the outside-any-root rule. Under standalone topology there is no hoisting and therefore no workspace-root masking, but the rule stands as recorded because it is what makes the control meaningful if the topology is ever revisited. `check-scope.mjs` (reads source) and `check-dependencies.mjs` (reads shipped artifacts) are unaffected by hoisting and SHALL NOT be treated as substitutes for the packed-install control.

#### Scenario: The control installs outside any workspace root
- **WHEN** the packed-install control executes
- **THEN** the packed tarball install happens in a clean consumer directory outside any workspace root, offline, with scripts disabled, and every declared entry point is imported by package specifier

#### Scenario: Source and shipped-artifact checks are not substitutes
- **WHEN** only `check-scope.mjs` or `check-dependencies.mjs` runs
- **THEN** the production-only packed-install closure is still required, because those checks do not prove the packed artifact's runtime closure

### Requirement: Untrusted PRs get static and mutation checks, no restricted secrets, and visible skips

Fork and Dependabot PRs SHALL NOT receive restricted secrets. They SHALL receive the static and mutation checks. Token-gated analysis (`sonar`, CodeScene) MAY be skipped for untrusted PRs, but a skip SHALL render as a skip and never as a pass-shaped green — a green board that has verified nothing is the #191 defect class. Any merge gate SHALL count against branch protection's declared context list, never against the reported set: `gh pr checks --required` lists only contexts that have reported, so a check that never started is invisible there.

#### Scenario: Fork and Dependabot PRs receive no restricted secrets
- **WHEN** a fork or Dependabot PR runs CI
- **THEN** no restricted secret is available to the jobs, and the static and mutation checks still run

#### Scenario: A skip renders as a skip, never a pass-shaped green
- **WHEN** token-gated analysis is skipped for an untrusted PR
- **THEN** the check renders visibly as a skip, distinct from a pass, and never contributes a green to the board

#### Scenario: A check that never started cannot gate as green
- **WHEN** a declared required context has not reported
- **THEN** merge gating treats it as unsatisfied and never counts it as a pass

#### Scenario: Merge gates count declared contexts
- **WHEN** merge readiness is evaluated
- **THEN** it counts against branch protection's declared context list, not against the set `gh pr checks --required` reports

### Requirement: Runner labels come from one declared constant

Runner labels SHALL be declared in exactly one constant, never as per-job literals. Runner labels are repository-scoped (`vars.RUNNER_LABEL` today), and a wrong literal does not fail fast — it queues the job until it times out, which has previously cost hours.

#### Scenario: One declared constant is the single source
- **WHEN** any job needs a runner label
- **THEN** it reads the one declared label constant

#### Scenario: A per-job literal is not the ratified shape
- **WHEN** a job declares its own runner-label literal
- **THEN** that job is out of conformance, because a wrong literal queues the job until timeout instead of failing fast

### Requirement: Every package carries the mandatory check set and CI fails closed

Each declared package SHALL carry the mandatory check set: build, typecheck, runtime tests, the production-only packed install, and at least one deterministic mutation control. Failure semantics SHALL fail closed: a missing required static validation is a failure, not a skip, and nothing MAY render that missing validation as a pass-shaped green. A test coverage execution SHALL enforce declared minimum line and branch coverage thresholds and SHALL fail closed when measured coverage falls below either threshold.

#### Scenario: The mandatory check set is present per package
- **WHEN** a declared package's check set is inspected
- **THEN** build, typecheck, runtime tests, the production-only packed install, and at least one deterministic mutation control are all present

#### Scenario: A package missing a mandatory member fails
- **WHEN** a declared package lacks any member of the mandatory check set
- **THEN** CI fails closed, naming the missing validation

#### Scenario: A missing required static validation is not a skip
- **WHEN** a required static validation does not run
- **THEN** the result is a failure, never a skip, and never a pass-shaped green

#### Scenario: Coverage threshold enforcement fails closed
- **WHEN** a package test coverage run drops below its declared minimum line or branch threshold
- **THEN** the coverage script exits with a non-zero failure status and fails the CI coverage job

### Requirement: The decision is recorded with its provenance and scope boundary

The decision source SHALL be recorded as `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` wherever the capability refers to it. The decision SHALL NOT be cited as an exact-commit owner authorization, and it SHALL NOT satisfy any gate that specifically requires a human owner decision. It authorizes no workflow edit, no branch-protection settings change, no runner, no secret, and no package implementation: implementation belongs to the later governed change #85, which must pass review and every required gate on its own merits. The question whether `coverage` must become a required context is deliberately not decided here; it is filed as its own issue.

#### Scenario: Provenance is recorded verbatim
- **WHEN** the capability names the decision's source
- **THEN** it records `decision_source = "delegated to Claude by the owner, 2026-09-03; not a human owner decision"` and does not represent it as an owner decision

#### Scenario: The decision authorizes no implementation surface
- **WHEN** the change range is inspected
- **THEN** no workflow file, branch-protection setting, runner, or secret is changed by the ratification

#### Scenario: Implementation remains a governed change
- **WHEN** the workflow topology is implemented
- **THEN** it happens under #85 with its own review and required gates, never as part of this ratification

#### Scenario: The coverage question is out of scope
- **WHEN** the capability records the decision
- **THEN** whether `coverage` must become required is left undecided here and is tracked in its own issue

### Requirement: Revisit conditions re-open the decision

The decision SHALL be re-opened when any of the following becomes true: branch protection acquires a mechanism that makes required-context registration automatic, which would remove the force behind one-job-per-concern; a package legitimately needs a Node range incompatible with per-package matrices; or the repository moves off standalone topology, which would reintroduce the workspace-root masking risk that the outside-any-root rule exists to bound.

#### Scenario: Automatic required-context registration re-opens the decision
- **WHEN** branch protection acquires a mechanism that registers required contexts automatically
- **THEN** the decision is re-opened, because the F1 force no longer applies

#### Scenario: An incompatible Node range re-opens the decision
- **WHEN** a package legitimately needs a Node range incompatible with per-package matrices
- **THEN** the decision is re-opened

#### Scenario: A move off standalone topology re-opens the decision
- **WHEN** the repository moves off the standalone package topology
- **THEN** the decision is re-opened, because the workspace-root masking risk the outside-any-root rule bounds could return

#### Scenario: No revisit condition holds
- **WHEN** none of the revisit conditions holds
- **THEN** the recorded decision remains the ratified CI topology

### Requirement: Development instructions distinguish product loop from governance chains

The repository's development and contribution instructions SHALL distinguish the fast product test loop from full governance-gate chains, stating reproducible measured runtimes for each workspace and identifying that the dominant cost of the SDK `validate` chain is gate mutation testing (`test:verification`), not product verification. The fast product test loop (`test:matrix` in `packages/security-audit-sdk-core`, `validate` in `packages/security-audit-sdk-node`, `validate` in `packages/security-audit-collector`, `validate` in `contracts/security-audit`, and `lint` + `test` in `research/browser-telemetry`) SHALL be explicitly documented as the development verification loop, while preserving `test:matrix`'s documented matrix-safe purpose.

The instructions SHALL state a workspace count that matches the set of declared packages, and SHALL NOT state a count that disagrees with the root command surface.

#### Scenario: Developer learns the product loop runtime
- **WHEN** a contributor or agent reads `CLAUDE.md` or `AGENTS.md`
- **THEN** the instructions state that the product test loop takes roughly 34 seconds across all five declared workspaces

#### Scenario: Dominant validate cost is attributed to gate mutation testing
- **WHEN** a contributor or agent inspects the documented gate chains
- **THEN** the instructions identify that the dominant runtime of SDK `validate` (~254 seconds out of ~291 seconds) is `test:verification` proving governance gates fail closed, rather than product test assertions

#### Scenario: test:matrix retains its matrix-safe purpose
- **WHEN** a developer inspects the instructions for cross-Node testing
- **THEN** `test:matrix` is documented as the matrix-safe subset of checks suitable for running across Node major versions while also serving as the fast local product loop

#### Scenario: Documented workspace count agrees with the command surface
- **WHEN** the workspace count stated in the instructions is compared with the set the root command surface runs
- **THEN** they name the same workspaces

### Requirement: Root command surface dispatches product loop and governance gates

The repository SHALL provide a root `Makefile` as a non-npm command surface that dispatches to existing workspace scripts without redefining gates. Bare invocation (`make` or `make test`) SHALL execute the fast product test loop across **every declared package** — the set asserted by `.github/scripts/check-package-discovery.mjs`, currently `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, `contracts/security-audit`, and `research/browser-telemetry`. Targets SHALL be named after the ratified gate split (`test` / `runtime-gates` for the fast product loop, and `governance-gates` for the full validation chain). The `governance-gates` target SHALL state its estimated runtime cost (~307s across workspaces) before executing. Any partial target run SHALL NOT report an unqualified pass and SHALL explicitly name the workspaces or checks that were not run. The root `Makefile` SHALL be classified as `governance_core` in design-pattern policy.

Workspace coverage SHALL be asserted by an executable gate rather than by a target's own success message, and a target's success message SHALL NOT state a workspace count that can disagree with the set it runs. Adding a declared package without adding it to a covering target SHALL fail that gate.

#### Scenario: Bare invocation executes the product test loop across all workspaces
- **WHEN** `make` or `make test` is executed from the repository root
- **THEN** it executes the product test loop across every declared package without requiring workspace `--prefix` arguments

#### Scenario: Governance chain states its cost before execution
- **WHEN** the governance chain target `make governance-gates` is invoked
- **THEN** it prints its estimated execution cost (~307s, dominated by SDK gate mutation testing) before running the gate chain

#### Scenario: Partial run does not report an unqualified pass
- **WHEN** a target executing a subset of workspaces or gates completes
- **THEN** it names what was executed and explicitly identifies the workspaces or gates that were not run

#### Scenario: A covering target that skips a declared package fails the gate
- **WHEN** a target claiming repository-wide coverage does not invoke a declared package
- **THEN** the package-discovery gate fails and names the target and the uncovered package, rather than the target reporting an unqualified pass

#### Scenario: Targets delegate to existing workspace scripts
- **WHEN** any target in the root command surface is evaluated
- **THEN** it delegates directly to existing npm scripts in the respective workspaces and redefines no gate logic

#### Scenario: Root command surface is classified as governance_core
- **WHEN** path classification is evaluated against the root `Makefile`
- **THEN** `classifyPath` returns `governance_core`
