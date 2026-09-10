## MODIFIED Requirements

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
