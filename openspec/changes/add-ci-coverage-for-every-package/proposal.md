## Why

Now that the platform-neutral core extraction (#86) and provisional Node binding (#87) are completed, the repository contains four distinct approved packages: `contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, and `research/browser-telemetry`. However, CI currently exercises only three of them: `packages/security-audit-sdk-node` lacks CI coverage across its declared Node version matrix (`24.2.0` and `26.5.0`), package validation, and coverage aggregation. Furthermore, while ADR 0011 ratified an explicit declared package list with a mechanical both-directions completeness assertion, this assertion is not yet enforced in CI. Without this coverage and gate, newly added or modified packages can diverge or regress without triggering CI failures, and undeclared packages could silently exist unvalidated.

## What Changes

1. **Mechanical Package Discovery Completeness Assertion**:
   - Introduce `.github/scripts/check-package-discovery.mjs` and its automated test suite `.github/scripts/check-package-discovery.test.mjs`.
   - Enforce that git-enumerated packages (`git ls-files '*package.json' | grep -v node_modules`) match the declared package set (`contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `research/browser-telemetry`) byte-for-byte, failing closed if any on-disk package is missing or any listed package is absent.
   - Assert in job output that discovered package count is nonzero and exactly matches the expected package count (4).
   - Wire this check into CI under the `design-pattern-governance` job.
2. **Wire `packages/security-audit-sdk-node` into CI Workflows**:
   - In `.github/workflows/ci.yml`, wire `packages/security-audit-sdk-node` into the `sdk` job alongside `packages/security-audit-sdk-core`:
     - Primary leg (Node 26.5.0): run `npm ci`, `npm run validate` (enforcing typecheck, build, runtime tests, dependency check, and packed install verification), and audit retry.
     - Node 24 compatibility leg (Node 24.2.0): run `npm run test` under Node 24.2.0 matching its declared `compatibility.json` and `engines` range.
   - Wire `packages/security-audit-sdk-node` into the `coverage` job: add deterministic `test:coverage` script in `packages/security-audit-sdk-node/package.json` enforcing minimum line/branch thresholds, rewrite its lcov paths to repository-relative, include its artifacts in upload, and include in Codecov reports.
3. **Update Root Command Surface**:
   - Update root `Makefile` so the default product test loop (`make`, `make test`, `make runtime-gates`) and `make governance-gates` execute across all four packages.
   - Update `make sdk` to run the product loop across both SDK packages (`packages/security-audit-sdk-core` and `packages/security-audit-sdk-node`).

## Capabilities

- `ci-topology`: Update the declared package list requirement and assertion to reflect four approved packages (contracts/security-audit, packages/security-audit-sdk-core, packages/security-audit-sdk-node, and research/browser-telemetry), wire packages/security-audit-sdk-node into the stable sdk and coverage jobs, and update the root Makefile requirement to dispatch across all four packages.

## Impact
- Workflow configuration: `.github/workflows/ci.yml` wires `packages/security-audit-sdk-node` into `sdk` and `coverage` jobs and runs package discovery assertion.
- Automation scripts: adds `.github/scripts/check-package-discovery.mjs` and `.github/scripts/check-package-discovery.test.mjs`.
- Package configuration: `packages/security-audit-sdk-node/package.json` adds `test:coverage` script with deterministic thresholds.
- Root command surface: `Makefile` dispatches across all four workspaces.
- Governance: `openspec/specs/ci-topology/spec.md` updated to reflect the 4-package topology.
