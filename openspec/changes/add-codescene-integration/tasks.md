## 1. Create `.codescene/custom-quality-gates.json`

- [x] 1.1 Create `.codescene/` directory at repository root.
- [x] 1.2 Write `custom-quality-gates.json` with four rule sets:
  - `packages/security-audit-sdk-core/**` → `clean_code_collective`
  - `contracts/security-audit/**` → `clean_code_collective`
  - `research/browser-telemetry/**` → `bare_minimum`
  - `*/**` (catch-all) → `bare_minimum`

## 2. Add `codescene-delta` CI job

- [x] 2.1 Add a `codescene-delta` job to `.github/workflows/ci.yml` that:
  - Runs on `pull_request` events only.
  - Checks out with `fetch-depth: 0` (full history required for delta).
  - Installs the `cs` CLI via the official install script.
  - Runs `cs delta "origin/${{ github.base_ref }}" --output-format json` with `CS_ACCESS_TOKEN` from the `CODESCENE_TOKEN` secret.
  - Fails the check on new code health issues (CLI exits non-zero).
- [x] 2.2 Added `continue-on-error: true` to prevent flaky installs from blocking unrelated PRs while still surfacing the result.

## 3. Add README badges

- [x] 3.1 CodeScene badges were already present in README.md (project 83349).
- [x] 3.2 No changes needed — badges already cover code health, hotspot health, missed goals, and system mastery.
- [x] 3.3 Updated the CI section in README.md to list the `codescene delta` check.

## 4. Verification

- [ ] 4.1 Push this branch and open a PR to confirm `cs delta` reports results.
- [ ] 4.2 Confirm the PR integration Check Run appears on the PR (requires CodeScene SaaS project setup — project 83349 already exists).
- [ ] 4.3 Badges already render correctly in the README.
