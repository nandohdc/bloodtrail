## ADDED Requirements

### Requirement: Development instructions distinguish product loop from governance chains

The repository's development and contribution instructions SHALL distinguish the fast product test loop from full governance-gate chains, stating reproducible measured runtimes for each workspace and identifying that the dominant cost of the SDK `validate` chain is gate mutation testing (`test:verification`), not product verification. The fast product test loop (`test:matrix` in the SDK, `validate` in `contracts/security-audit`, and `lint` + `test` in `research/browser-telemetry`) SHALL be explicitly documented as the development verification loop, while preserving `test:matrix`'s documented matrix-safe purpose.

#### Scenario: Developer learns the product loop runtime
- **WHEN** a contributor or agent reads `CLAUDE.md` or `AGENTS.md`
- **THEN** the instructions state that the product test loop takes roughly 18 seconds across all three workspaces (~15s in the SDK via `test:matrix`, ~1.5s in contracts via `validate`, ~15s in research via `lint` + `test`)

#### Scenario: Dominant validate cost is attributed to gate mutation testing
- **WHEN** a contributor or agent inspects the documented gate chains
- **THEN** the instructions identify that the dominant runtime of SDK `validate` (~254 seconds out of ~291 seconds) is `test:verification` proving governance gates fail closed, rather than product test assertions

#### Scenario: test:matrix retains its matrix-safe purpose
- **WHEN** a developer inspects the instructions for cross-Node testing
- **THEN** `test:matrix` is documented as the matrix-safe subset of checks suitable for running across Node major versions while also serving as the fast local product loop
