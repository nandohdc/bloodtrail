## MODIFIED Requirements

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
