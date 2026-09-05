# Design: Execute Node 24 Matrix and Pin Node 26.5.0 in CI

## Context

`packages/security-audit-sdk-core/compatibility.json` and ADR 0011 specify that the SDK supports Node majors 24 and 26, specifically pinned in CI verification as `24.2.0` and `26.5.0`. The ratified `ci-topology` specification states:
"The Node version matrix SHALL be per package, not repository-wide. The SDK SHALL run its matrix on `24.2.0` and `26.5.0` (`compatibility.json` `node.ciVersions`), and the contract and research workspaces SHALL run on Node `>=26.5.0`, matching their declared `engines` ranges (`>=24 <25 || >=26 <27` for the SDK; `>=26.5.0` for contract and research)."

However, in `.github/workflows/ci.yml`:
1. The jobs currently set floating `node-version: "26"`.
2. The `sdk` job only executes on Node 26; Node 24 is never invoked in CI.

## Invariants and Constraints

1. **Stable Required Context Names**: Branch protection requires the exact status context name `sdk`. A GitHub Actions matrix generating `sdk (24.2.0)` and `sdk (26.5.0)` would break branch protection because the required check `sdk` would not report.
2. **Runtime per Leg, Repository Once**: The Node 24 leg must run the matrix-safe subset (`npm run test:matrix`), while Node 26.5.0 executes the complete SDK validation chain (`npm run validate`).
3. **Exact Pinned Versions**: CI workflow configurations must pin `26.5.0` and `24.2.0`, eliminating silent floating drift.
4. **Fail-Closed Failure Posture**: Any failure on Node 24.2.0 must immediately fail the `sdk` job and block merge.

## Technical Implementation

1. **Update `.github/workflows/ci.yml`**:
   - `ci` job: set `node-version: "26.5.0"`.
   - `sdk` job:
     - Set primary `actions/setup-node@v7` to `node-version: "26.5.0"`, run `npm ci`, `check:generated`, and `npm run validate`.
     - Run secondary `actions/setup-node@v7` with `node-version: "24.2.0"`, followed by `npm run test:matrix`.
     - Retain `npm-audit-retry.mjs --audit-level=low`.
   - `contract` job: set `node-version: "26.5.0"`.
   - `design-pattern-governance` job: set `node-version: "26.5.0"`.
   - `coverage` job: set `node-version: "26.5.0"`.
2. **Add Verification Mutation Tests**:
   - In `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs`, add mutation assertions verifying that dropping Node 24 from `compatibility.json` or `package.json` fails `scripts/check-coherence.mjs` and `scripts/check-compatibility.mjs`.
