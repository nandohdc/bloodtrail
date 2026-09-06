## MODIFIED Requirements

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

### Requirement: Root command surface dispatches product loop and governance gates

The repository SHALL provide a root `Makefile` as a non-npm command surface that dispatches to existing workspace scripts without redefining gates. Bare invocation (`make` or `make test`) SHALL execute the fast product test loop across all four workspaces (`packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `contracts/security-audit`, and `research/browser-telemetry`). Targets SHALL be named after the ratified gate split (`test` / `runtime-gates` for the fast product loop, and `governance-gates` for the full validation chain). The `governance-gates` target SHALL state its estimated runtime cost (~291s across workspaces) before executing. Any partial target run SHALL NOT report an unqualified pass and SHALL explicitly name the workspaces or checks that were not run. The root `Makefile` SHALL be classified as `governance_core` in design-pattern policy.

#### Scenario: Bare invocation executes the product test loop across all workspaces
- **WHEN** `make` or `make test` is executed from the repository root
- **THEN** it executes the product test loop across all four workspaces (`packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `contracts/security-audit`, and `research/browser-telemetry`) without requiring workspace `--prefix` arguments

#### Scenario: Governance chain states its cost before execution
- **WHEN** the governance chain target `make governance-gates` is invoked
- **THEN** it prints its estimated execution cost (~291s, dominated by SDK gate mutation testing) before running the gate chain

#### Scenario: Partial run does not report an unqualified pass
- **WHEN** a target executing a subset of workspaces or gates completes
- **THEN** it names what was executed and explicitly identifies the workspaces or gates that were not run

#### Scenario: Targets delegate to existing workspace scripts
- **WHEN** any target in the root command surface is evaluated
- **THEN** it delegates directly to existing npm scripts in the respective workspaces and redefines no gate logic

#### Scenario: Root command surface is classified as governance_core
- **WHEN** path classification is evaluated against the root `Makefile`
- **THEN** `classifyPath` returns `governance_core`
