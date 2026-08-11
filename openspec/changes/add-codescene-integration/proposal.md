## Why

Bloodtrail already gates PRs with static analysis (SonarQube) and coverage (Codecov), but neither captures the behavioral dimension of code quality — which files are hotspots of technical debt, whether changes introduce coupling risks, or if knowledge is concentrated in one author. CodeScene fills that gap by analyzing Git history as a behavioral log.

## What Changes

- Add `.codescene/custom-quality-gates.json` that applies per-workspace quality gates: stricter profiles for the SDK and contract, a minimum safety net for research.
- Add a `codescene-delta` CI job that runs `cs delta` on every PR, comparing the branch against the target to surface newly introduced code health issues. Coverage is **not exhaustive for TypeScript**: CLI 1.0.37 silently skips functions whose parameter list uses the `readonly` type modifier, so the gate is a real but partial net (tasks.md 4.5, design.md Decision 7).
- Add CodeScene status badges to the README for code health and knowledge distribution visibility.
- The PR integration (webhook-driven automated code review with Check Run annotations) is configured in the CodeScene SaaS UI, not in this repo — the `.codescene/` file is the repo-side contract the integration reads.

## Capabilities

### New Capabilities

None. This is repository tooling configuration and does not change product behavior; the change opts out of specification deltas.

### Modified Capabilities

None.

## Impact

- Adds `.codescene/custom-quality-gates.json` at the repository root.
- Adds a `codescene-delta` job to `.github/workflows/ci.yml`.
- Adds status badge markdown to `README.md`.
- Requires `CODESCENE_TOKEN` repository secret (already provisioned).
- Does not change coverage generation, CI upload inputs, product APIs, runtime behavior, dependencies, or the authorization boundary.
