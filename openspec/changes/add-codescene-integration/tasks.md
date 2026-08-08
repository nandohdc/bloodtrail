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
  - Checks out with `fetch-depth: 0` — required both for delta history and for `origin/<base>` to resolve at all.
  - Installs the `cs` CLI via the official install script, passing the headless flag as `sh -s -- -y`. Without it the script blocks on `read REPLY < /dev/tty`, which has no terminal on a runner, and aborts after installing the binary.
  - Probes the install with `"$HOME/.local/bin/cs" version` by absolute path, since `$GITHUB_PATH` only takes effect in later steps.
  - Runs `cs delta "origin/${{ github.base_ref }}" --output-format json` with `CS_ACCESS_TOKEN` from the `CODESCENE_TOKEN` secret.
- [x] 2.2 Apply `continue-on-error: true` to the **install step only**, not the job. At job level it leaves the job's own conclusion as `failure` — the red check still appears on the PR, so it never delivered the advisory behaviour it was added for — and it additionally swallows genuine findings. See design.md Decision 5 for the exit-code/JSON matrix the analysis step uses instead.

## 3. Add README badges

- [x] 3.1 CodeScene badges were already present in README.md (project 83349).
- [x] 3.2 No changes needed — badges already cover code health, hotspot health, missed goals, and system mastery.
- [x] 3.3 Updated the CI section in README.md to list the `codescene delta` check.

## 4. Verification

- [ ] 4.1 Push this branch and open a PR to confirm `cs delta` reports results.
- [ ] 4.2 Confirm the PR integration Check Run appears on the PR (requires CodeScene SaaS project setup — project 83349 already exists).
- [ ] 4.3 Badges already render correctly in the README.
