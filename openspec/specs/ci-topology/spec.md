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

The CI package set SHALL be an explicit declared list, not filesystem discovery. A mechanical completeness assertion SHALL enumerate the packages actually present in the repository and SHALL fail closed in both directions: a package on disk absent from the declared list is a failure, and a listed package that no longer exists is a failure. The enumeration is exact and cheap: `git ls-files '*package.json' | grep -v node_modules` yields exactly the packages named in `DECLARED_PACKAGES` in `.github/scripts/check-package-discovery.mjs` — currently `contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, and `research/browser-telemetry`. This requirement SHALL identify the declared list as the authority for that set and SHALL NOT restate its size as a literal, because a size restated here goes stale the moment a workspace is added — which is exactly how this requirement came to describe four packages after `packages/security-audit-collector` became the fifth. The assertion SHALL verify in CI that the discovered package count is nonzero and matches the declared count. A single filesystem glob SHALL NOT be the discovery mechanism, because the packages sit under three different roots (`contracts/`, `packages/`, `research/`) and no single glob can discover them.

#### Scenario: Declared list matches the on-disk packages
- **WHEN** the completeness assertion enumerates packages via `git ls-files '*package.json' | grep -v node_modules` and compares them against the declared list
- **THEN** the enumerated set equals the declared set exactly across every declared package and the assertion passes

#### Scenario: A package on disk missing from the list fails
- **WHEN** a package exists on disk with its own `package.json` but is absent from the declared list
- **THEN** the completeness assertion fails, naming the uncovered package

#### Scenario: A listed package that no longer exists fails
- **WHEN** the declared list names a package whose `package.json` no longer exists on disk
- **THEN** the completeness assertion fails, naming the phantom entry

#### Scenario: Discovered count is asserted in CI
- **WHEN** package discovery runs during CI execution
- **THEN** it asserts that the discovered package count is nonzero and exactly matches the number of entries in the declared list

#### Scenario: A single glob cannot discover the packages
- **WHEN** discovery is attempted with one filesystem glob
- **THEN** no single glob reaches all three package roots, so glob discovery is not the ratified discovery mechanism

#### Scenario: This requirement names no package count of its own
- **WHEN** the requirement text and its scenarios are read for a package count
- **THEN** they defer to `DECLARED_PACKAGES` rather than stating a number that a later workspace addition could contradict

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

The repository's development and contribution instructions SHALL distinguish the fast product test loop from full governance-gate chains, stating measured runtimes for each workspace and identifying that the dominant cost of the SDK `validate` chain is gate mutation testing (`test:verification`), not product verification. The fast product test loop (`test:matrix` in `packages/security-audit-sdk-core`, `validate` in `packages/security-audit-sdk-node`, `validate` in `packages/security-audit-collector`, `validate` in `contracts/security-audit`, and `lint` + `test` in `research/browser-telemetry`) SHALL be explicitly documented as the development verification loop, while preserving `test:matrix`'s documented matrix-safe purpose.

Every stated runtime SHALL carry the measurement it came from — a named CI run, or a named host and date for a local measurement — and the instructions SHALL record once the method by which such a figure is derived, so a later reader can re-derive it rather than re-litigate it. A ratified requirement SHALL NOT pin an absolute gate runtime as a literal: the same unchanged `test:verification` step measured 258s and 1234s on two green `main` runs, so any single literal makes conformant runs read as non-conformant. What is normative is that a figure is present, attributed, and re-derivable, and that the attribution of dominant cost is correct.

The instructions SHALL state a workspace count that matches the set of declared packages, and SHALL NOT state a count that disagrees with the root command surface.

#### Scenario: Developer learns the product loop runtime
- **WHEN** a contributor or agent reads `CLAUDE.md` or `AGENTS.md`
- **THEN** the instructions state a measured runtime for the product test loop across every declared workspace

#### Scenario: Dominant validate cost is attributed to gate mutation testing
- **WHEN** a contributor or agent inspects the documented gate chains
- **THEN** the instructions identify `test:verification` — governance-gate mutation testing proving gates fail closed, rather than product test assertions — as the dominant runtime of SDK `validate`, and state its share of that chain

#### Scenario: A stated runtime carries its measurement
- **WHEN** any runtime figure in `CLAUDE.md`, `AGENTS.md`, or the root `Makefile` is read
- **THEN** it names the CI run, or the host and date, it was measured on, and the documented method is sufficient to re-derive it

#### Scenario: A runtime figure is not treated as a service level
- **WHEN** the documented runtimes are compared against an observed run
- **THEN** the instructions record that these figures vary with host load and CI runner contention and are guidance for deciding whether to run a chain, not a threshold any run must meet

#### Scenario: test:matrix retains its matrix-safe purpose
- **WHEN** a developer inspects the instructions for cross-Node testing
- **THEN** `test:matrix` is documented as the matrix-safe subset of checks suitable for running across Node major versions while also serving as the fast local product loop

#### Scenario: Documented workspace count agrees with the command surface
- **WHEN** the workspace count stated in the instructions is compared with the set the root command surface runs
- **THEN** they name the same workspaces

### Requirement: Root command surface dispatches product loop and governance gates

The repository SHALL provide a root `Makefile` as a non-npm command surface that dispatches to existing workspace scripts without redefining gates. Bare invocation (`make` or `make test`) SHALL execute the fast product test loop across **every declared package** — the set asserted by `.github/scripts/check-package-discovery.mjs`, currently `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, `contracts/security-audit`, and `research/browser-telemetry`. Targets SHALL be named after the ratified gate split (`test` / `runtime-gates` for the fast product loop, and `governance-gates` for the full validation chain). The `governance-gates` target SHALL state its estimated runtime cost before executing, together with the measurement that figure came from. Any partial target run SHALL NOT report an unqualified pass and SHALL explicitly name the workspaces or checks that were not run. Where the same target's cost appears in more than one place in the command surface, those statements SHALL agree. The root `Makefile` SHALL be classified as `governance_core` in design-pattern policy.

Workspace coverage SHALL be asserted by an executable gate rather than by a target's own success message, and a target's success message SHALL NOT state a workspace count that can disagree with the set it runs. Adding a declared package without adding it to a covering target SHALL fail that gate. A partial target's statement of what it did not run SHALL likewise be asserted by that gate rather than maintained by hand, failing closed in both directions: a declared workspace the target does not invoke and does not name is a failure, and a workspace the target names as skipped while actually invoking it is a failure. Coverage SHALL be judged by what a recipe invokes, not by what its messages mention, so naming a workspace in a message cannot stand in for running it.

#### Scenario: Bare invocation executes the product test loop across all workspaces
- **WHEN** `make` or `make test` is executed from the repository root
- **THEN** it executes the product test loop across every declared package without requiring workspace `--prefix` arguments

#### Scenario: Governance chain states its cost before execution
- **WHEN** the governance chain target `make governance-gates` is invoked
- **THEN** it prints its estimated execution cost, dominated by SDK gate mutation testing, together with where that figure was measured, before running the gate chain

#### Scenario: Partial run does not report an unqualified pass
- **WHEN** a target executing a subset of workspaces or gates completes
- **THEN** it names what was executed and explicitly identifies the workspaces or gates that were not run

#### Scenario: A partial target that omits a skipped workspace fails the gate
- **WHEN** a target that does not invoke a declared workspace also does not name that workspace among the ones it did not run
- **THEN** the package-discovery gate fails and names the target and the undisclosed workspace

#### Scenario: A message mention does not count as coverage
- **WHEN** a target names a declared workspace only in a message and never invokes it
- **THEN** the package-discovery gate treats that workspace as uncovered rather than as run

#### Scenario: A covering target that skips a declared package fails the gate
- **WHEN** a target claiming repository-wide coverage does not invoke a declared package
- **THEN** the package-discovery gate fails and names the target and the uncovered package, rather than the target reporting an unqualified pass

#### Scenario: One target has one documented cost
- **WHEN** a target's cost is stated in more than one place in the root command surface
- **THEN** those statements agree with each other

#### Scenario: Targets delegate to existing workspace scripts
- **WHEN** any target in the root command surface is evaluated
- **THEN** it delegates directly to existing npm scripts in the respective workspaces and redefines no gate logic

#### Scenario: Root command surface is classified as governance_core
- **WHEN** path classification is evaluated against the root `Makefile`
- **THEN** `classifyPath` returns `governance_core`

### Requirement: The required quality gate analyses every declared package

The analysis scope of the required static-analysis gate SHALL cover every declared package — the set held by `DECLARED_PACKAGES` in `.github/scripts/check-package-discovery.mjs`. A declared package absent from that scope SHALL be a failure, and a scope entry that lies under no declared package and is not an explicitly recorded exception SHALL also be a failure, so the assertion fails closed in both directions. The scope SHALL NOT be a hand-maintained list whose completeness rests on a comment: `sonar-project.properties` asserted that it "scans every workspace" while omitting two of the five, and no gate could see the difference.

Generated output SHALL be excluded from the analysis scope, because it is regenerated from the canonical contract and never hand-edited, so a finding in it is not actionable — the fix belongs in the generator, which is itself analysed. Coverage reports SHALL be supplied for every analysed package that produces one, so a package is not analysed for issues while its measured coverage is discarded.

Repository tooling that is not a declared package MAY be outside the scope, but its exclusion SHALL be recorded with the reason rather than left as an omission.

Every declared package's release-gate scripts SHALL remain in the analysis scope for findings. When
those independently owned package scripts intentionally repeat the same gate policy, only
`packages/*/scripts/**` MAY be excluded from copy-paste detection; that property SHALL be asserted
mechanically and no broader source-tree exclusion is permitted.

#### Scenario: Every declared package is in the analysis scope
- **WHEN** the analysis scope is compared against `DECLARED_PACKAGES`
- **THEN** each declared package is present, and the assertion passes

#### Scenario: A declared package missing from the scope fails
- **WHEN** a declared package does not appear in the analysis scope
- **THEN** the assertion fails, naming the uncovered package

#### Scenario: A scope entry under no declared package fails
- **WHEN** the analysis scope names a path that lies under no declared package and is not a recorded exception
- **THEN** the assertion fails, naming the stray entry

#### Scenario: Adding a package without adding it to the scope fails
- **WHEN** a package is added to `DECLARED_PACKAGES` and not to the analysis scope
- **THEN** the assertion fails, the same way a covering `make` target that skips it fails

#### Scenario: Generated output is excluded and the generator is not
- **WHEN** the analysis scope is inspected for generated directories
- **THEN** generated output is excluded and the generator that produces it remains analysed

#### Scenario: An analysed package's coverage report is supplied
- **WHEN** a declared package in the analysis scope produces a coverage report
- **THEN** that report is among the ones the gate reads, rather than produced and discarded

#### Scenario: Tooling outside the scope is recorded, not merely absent
- **WHEN** repository tooling that is not a declared package sits outside the analysis scope
- **THEN** the reason for its exclusion is recorded rather than left implicit

#### Scenario: Intentional package-script duplication remains finding-visible
- **WHEN** the CPD exclusion is inspected
- **THEN** it is exactly `packages/*/scripts/**`, and those scripts remain in the analysis scope for findings

### Requirement: A superseded canonical contract version may not appear in a current-tense assertion

A statement that describes present behaviour SHALL name the current canonical contract version. The
current version SHALL be read from the canonical contract source, and the set of superseded versions
SHALL be derived from the repository's existing record of every contract version that has existed;
neither SHALL be restated by the gate that checks them. A current version absent from that record
SHALL be a failure, because a version move that updates the contract and not the record leaves the
superseded set wrong.

The checked set SHALL cover every declared package — its documents, its architecture decision records
and its sources — derived from the declared-package set rather than enumerated, so a newly declared
package is covered without being taught. Repository documents that are not part of a package SHALL be
named explicitly and asserted to exist, so the list fails rather than silently shrinking.

An occurrence of a superseded version SHALL fail unless it is a recorded exception carrying its
reason, and a recorded exception that matches no occurrence SHALL also fail, so the exception set
cannot outlive the text it excuses.

Trees excluded from the checked set SHALL be recorded with their reason rather than left absent. In
particular, ratified specification text SHALL NOT be checked: it states what was decided, correcting
it is a governed specification change, and a gate demanding that correction would require the change
it forbids.

#### Scenario: A superseded version in a current-tense statement fails
- **WHEN** a checked file asserts present behaviour using a superseded canonical contract version
- **THEN** the check fails, naming the file and the line

#### Scenario: A recorded historical reference passes
- **WHEN** an occurrence of a superseded version is a recorded exception carrying its reason
- **THEN** the check passes and the reference is left unchanged

#### Scenario: A recorded exception that matches nothing fails
- **WHEN** a recorded exception no longer matches any occurrence
- **THEN** the check fails, so the exception set cannot outlive the text it excuses

#### Scenario: The current version is read from the canonical source
- **WHEN** the canonical contract version changes at its source
- **THEN** the check follows it with no second copy to update

#### Scenario: A current version missing from the version record fails
- **WHEN** the current canonical version is absent from the repository's record of contract versions
- **THEN** the check fails rather than validating against an incomplete superseded set

#### Scenario: Every declared package is covered without being taught
- **WHEN** a package is added to the declared-package set
- **THEN** its documents, decision records and sources are checked with no further edit

#### Scenario: A named repository document that no longer exists fails
- **WHEN** a named non-package document is renamed or removed
- **THEN** the check fails rather than silently checking one document fewer

#### Scenario: Ratified specification text is excluded, and the exclusion is recorded
- **WHEN** the excluded trees are inspected
- **THEN** ratified specification text is among them and its reason is recorded rather than implicit

### Requirement: Coverage reports handed to the required quality gate describe only analysed components

Every record in a coverage report supplied to the required quality gate SHALL name a file that the
gate analyses. A record naming a path outside the declared analysis scope, or matched by a declared
exclusion, SHALL be removed from the report before the report is handed over, so the analyser is
never given coverage for a component it was told not to index.

Record paths SHALL be normalised to repository-relative paths, with any parent-directory segments
resolved, before they are classified. The scope used for that classification SHALL be read from the
same declaration the gate itself reads, rather than restated: a second copy of the source roots, the
test roots, the exclusion globs, or the report list is the stale-list defect this repository has
already recorded four times.

A record whose normalised path does not exist SHALL fail the job that produces the report, naming the
path. A missing declared report, and a report left with no records after filtering, SHALL also fail.
An unresolvable coverage record SHALL NOT be reported only as a warning in the job that consumes the
report, because a warning that is always present cannot distinguish a new defect from the standing
one.

Removing a record SHALL NOT change the coverage figure of any analysed component: only records that
name no indexed component are removed, and a record that resolves to an analysed component is
retained even when the report that carries it belongs to a different package.

The reason reports legitimately carry such records SHALL be recorded beside the report declaration
rather than left to be rediscovered from an analyser log.

#### Scenario: A record for an excluded path is removed before the gate reads it
- **WHEN** a coverage report carries a record whose normalised path is matched by a declared exclusion
- **THEN** that record is removed from the report, and the removal is reported with its reason

#### Scenario: A record outside every source and test root is removed
- **WHEN** a coverage report carries a record whose normalised path lies under no declared source or test root
- **THEN** that record is removed from the report, and the removal is reported with its reason

#### Scenario: A record for an analysed component is retained
- **WHEN** a coverage report carries a record whose normalised path is an analysed component
- **THEN** that record is retained, including when the report belongs to a different package

#### Scenario: Parent-directory segments are resolved before classification
- **WHEN** a record's path reaches another package through parent-directory segments
- **THEN** it is classified by its normalised repository-relative path, not by the unresolved one

#### Scenario: A record naming a path that does not exist fails the producing job
- **WHEN** a record's normalised path does not exist on disk
- **THEN** the job that produces the report fails, naming the path, rather than filtering it away

#### Scenario: A missing declared report fails
- **WHEN** a report named in the gate's report declaration is absent
- **THEN** the job fails, naming the report

#### Scenario: A report emptied by filtering fails
- **WHEN** filtering would leave a report with no records at all
- **THEN** the job fails, because a report that describes nothing is indistinguishable from one that was never produced

#### Scenario: The analysis scope is read, not restated
- **WHEN** the source roots, test roots, exclusion globs, or report list change in the gate's own declaration
- **THEN** the filtering follows them with no second copy to update
