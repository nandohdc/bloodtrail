## 1. Package Discovery Completeness Assertion

- [x] 1.1 Implement `.github/scripts/check-package-discovery.mjs` asserting that `git ls-files '*package.json'` matches the 4 declared packages and discovered count is nonzero, failing closed in both directions
- [x] 1.2 Implement `.github/scripts/check-package-discovery.test.mjs` covering positive matches, missing package failures, phantom package failures, and count assertions
- [x] 1.3 Wire `check-package-discovery.mjs` into `.github/workflows/ci.yml` under `design-pattern-governance` job

## 2. CI Coverage for security-audit-sdk-node

- [x] 2.1 Add `test:coverage` script to `packages/security-audit-sdk-node/package.json` with fail-closed thresholds (`--test-coverage-lines=80 --test-coverage-branches=25`) and output destinations for lcov and junit
- [x] 2.2 Wire `packages/security-audit-sdk-node` into the `sdk` job in `.github/workflows/ci.yml` across primary Node 26.5.0 leg (`npm ci`, `validate`, audit retry) and Node 24.2.0 compatibility leg (`test`)
- [x] 2.3 Wire `packages/security-audit-sdk-node` into the `coverage` job in `.github/workflows/ci.yml` (cache paths, `test:coverage`, path rewriting, and artifact upload)

## 3. Root Command Surface Integration

- [x] 3.1 Update root `Makefile` targets (`runtime-gates`, `governance-gates`, `sdk`) to include `packages/security-audit-sdk-node`
- [x] 3.2 Verify `make test` and `make sdk` execute successfully and display correct workspace counts

## 4. Verification and Governance

- [x] 4.1 Run unit tests for `.github/scripts/check-package-discovery.test.mjs` via `node --test .github/scripts/check-package-discovery.test.mjs`
- [x] 4.2 Run fast product test loop across all four workspaces via `make test`
- [x] 4.3 Verify governance checks via `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` and dual checker
