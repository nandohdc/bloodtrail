# Spec Delta

## MODIFIED Requirements

### Requirement: Package discovery is an explicit declared list with a completeness assertion

The CI package set SHALL be an explicit declared list, not filesystem discovery. A mechanical completeness assertion SHALL enumerate the packages actually present in the repository and SHALL fail closed in both directions: a package on disk absent from the declared list is a failure, and a listed package that no longer exists is a failure. The enumeration is exact and cheap: `git ls-files '*package.json' | grep -v node_modules` yields exactly the packages named in `DECLARED_PACKAGES` in `.github/scripts/check-package-discovery.mjs` — currently `contracts/security-audit`, `packages/client-evidence-browser`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `packages/security-audit-collector`, `packages/security-audit-collector-server`, and `research/browser-telemetry`. This requirement SHALL identify the declared list as the authority for that set and SHALL NOT restate its size as a literal, because a size restated here goes stale the moment a workspace is added — which is exactly how this requirement came to describe four packages after `packages/security-audit-collector` became the fifth. The assertion SHALL verify in CI that the discovered package count is nonzero and matches the declared count. A single filesystem glob SHALL NOT be the discovery mechanism, because the packages sit under three different roots (`contracts/`, `packages/`, `research/`) and no single glob can discover them.

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

## ADDED Requirements

### Requirement: The LocalStack job is secret-gated and never required

CI SHALL run a `localstack` job that deploys the collector server to LocalStack-emulated EKS and RDS with synthetic events, using the `LOCALSTACK_AUTH_TOKEN` CI Auth Token secret. It SHALL run on pushes to `main`, on manual dispatch, and on same-repository PRs that touch the server workspace. It SHALL NOT be a required context and SHALL render as a skip when the secret is unavailable.

#### Scenario: Untrusted PRs skip visibly
- **WHEN** a fork or Dependabot PR triggers CI
- **THEN** the `localstack` job receives no secret and renders as a skip, never as a pass

#### Scenario: The job is not required
- **WHEN** branch protection's required contexts are read
- **THEN** `localstack` is not among them, and the server's required coverage comes from the per-concern jobs against a plain PostgreSQL container
