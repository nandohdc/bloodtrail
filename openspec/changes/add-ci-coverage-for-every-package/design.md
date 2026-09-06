## Context

See `proposal.md` for motivation and `openspec/specs/ci-topology/spec.md` for normative capability requirements.
ADR 0011 ratified the multi-package CI topology based on five core principles:
1. One job per concern with stable context names, preventing branch-protection settings churn.
2. An explicit declared package list coupled with a mechanical completeness assertion failing closed in both directions.
3. Per-package Node matrices respecting individual `engines` declarations.
4. Gate split: runtime gates per matrix leg, repository-level gates once per change.
5. Production-only packed install closure performed in a clean directory outside any workspace root.

With Issue #86 (platform-neutral Core extraction) and Issue #87 (provisional Node binding) completed, four distinct packages exist in git:
- `contracts/security-audit`
- `packages/security-audit-sdk-core`
- `packages/security-audit-sdk-node`
- `research/browser-telemetry`

This design specifies how `packages/security-audit-sdk-node` is integrated into CI and how package discovery completeness is mechanically enforced.

## Goals / Non-Goals

**Goals:**
- Mechanically assert in CI that all packages discovered via `git ls-files` match the declared package list in both directions, and assert nonzero package count in job output.
- Wire `packages/security-audit-sdk-node` into the existing stable `sdk` CI job across both declared Node versions (`26.5.0` and `24.2.0`), executing typecheck, build, runtime tests, dependency policy, and packed install verification.
- Wire `packages/security-audit-sdk-node` into the `coverage` CI job with fail-closed line and branch coverage thresholds.
- Update the root `Makefile` so the default product test loop (`make test`) and governance chains (`make governance-gates`) dispatch across all four packages.

**Non-Goals:**
- No change to branch protection required status check names (stable contexts `sdk`, `coverage`, `design-pattern-governance` remain unchanged).
- No new third-party runtime dependencies.
- No modifications to package publication or production deployment permissions (all packages remain private and unpublished).

## Decisions

### D1 — Stable Concern Context Preservation (One Job per Concern)
Branch protection pins ten required contexts by hand (`ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance`, `coverage`). Creating a separate `sdk-node` top-level job would require manual repository settings edits and would leave the new package advisory until updated. Instead, `packages/security-audit-sdk-node` is validated within the existing `sdk` job (for compilation, testing, packaging, and audit) and `coverage` job (for coverage collection).

*Alternatives considered:*
- Adding a standalone `sdk-node` job: Rejected per ADR 0011 F1; would require manual branch protection modification and risk silent failure if unpinned.

### D2 — Mechanical Package Discovery Assertion
Implement `.github/scripts/check-package-discovery.mjs` and its test suite `.github/scripts/check-package-discovery.test.mjs`. The script:
1. Enumerates packages via `git ls-files '*package.json'` excluding `node_modules`.
2. Compares the enumerated list against the explicit declared list:
   - `contracts/security-audit/package.json`
   - `packages/security-audit-sdk-core/package.json`
   - `packages/security-audit-sdk-node/package.json`
   - `research/browser-telemetry/package.json`
3. Fails closed if any package on disk is missing from the declared list or if any declared package is missing from disk.
4. Asserts that the discovered package count is exactly 4 (nonzero).
5. Runs as an explicit step in the `design-pattern-governance` job.

*Alternatives considered:*
- Filesystem globbing: Rejected per ADR 0011; packages live across three separate roots (`contracts/`, `packages/`, `research/`) and globbing cannot detect forgotten packages.
- Unasserted declared list: Rejected; relocates silent omission risk.

### D3 — Per-Package Node Matrix for sdk-node
`packages/security-audit-sdk-node` declares `engines: ">=24 <25 || >=26 <27"` and `compatibility.json: node.ciVersions: ["24.2.0", "26.5.0"]`.
- On the primary Node 26.5.0 leg in `sdk`:
  - `npm ci`
  - `npm run validate` (which runs `typecheck`, `build`, `test:runtime`, `test:dependencies`, and `test:package`)
  - `node ../../.github/scripts/npm-audit-retry.mjs --audit-level=low`
- On the Node 24.2.0 leg in `sdk`:
  - `npm run test` (compiles and runs runtime tests on Node 24.2.0)

*Alternatives considered:*
- Repository-wide Node matrix: Rejected per ADR 0011 F3; contract and research packages require Node `>=26.5.0`.

### D4 — Deterministic Coverage Enforcement for sdk-node
Add `test:coverage` script to `packages/security-audit-sdk-node/package.json`:
- Sets fail-closed thresholds: `--test-coverage-lines=80 --test-coverage-branches=25`.
- Generates `coverage/lcov.info` and `coverage/junit.xml`.
In `coverage` CI job:
- Runs `npm ci` and `npm run test:coverage` for `packages/security-audit-sdk-node`.
- Rewrites lcov paths with prefix `packages/security-audit-sdk-node/`.
- Uploads coverage artifacts and test results to Codecov with flag `sdk-node`.

### D5 — Root Command Surface (`Makefile`) Update
Update `Makefile`:
- `runtime-gates`: adds `npm run validate --prefix packages/security-audit-sdk-node` to the product test loop.
- `governance-gates`: adds `npm run validate --prefix packages/security-audit-sdk-node` to the full validation chain.
- `sdk`: runs product loops for both `packages/security-audit-sdk-core` and `packages/security-audit-sdk-node`.

## Risks / Trade-offs

- [Risk: Discovered package count could be zero if git command fails] → Mitigation: The script checks `packages.length === 4` and fails closed if length is 0 or does not match expected count.
- [Risk: Adding packages to `sdk` increases job execution time] → Mitigation: `sdk-node` validate takes ~8s; total `sdk` runtime remains well within CI allowances.
- [Risk: Coverage report path collisions in Codecov] → Mitigation: Coverage paths are rewritten to repository-relative (`packages/security-audit-sdk-node/...`) and uploaded with dedicated `sdk-node` flag.

## Migration Plan

1. Propose change `add-ci-coverage-for-every-package` with full OpenSpec assessment and delta spec.
2. Implement `.github/scripts/check-package-discovery.mjs` and its unit tests.
3. Update `.github/workflows/ci.yml`, `packages/security-audit-sdk-node/package.json`, and `Makefile`.
4. Validate locally using `make test` and `node --test .github/scripts/check-package-discovery.test.mjs`.
5. Open PR, verify 100% green CI checks, merge via `--admin --merge`.
6. Fold spec delta and archive change.

## Open Questions

None. The topology and requirements are strictly bounded by ADR 0011 and `openspec/specs/ci-topology/spec.md`.
