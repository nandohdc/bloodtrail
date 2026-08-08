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

- [x] 4.1 Confirmed on PR #49, run `31258105943`: the installer completes without prompting, `cs version 1.0.37` resolves, and `cs delta` exits 0 with "No new code health issues." No `::warning::` annotation was emitted, which is what distinguishes a real clean analysis from the advisory fallback path.
  - `cs version` needs no `CS_ACCESS_TOKEN`, so the install probe is a valid liveness check on a step that has no secret.
- [ ] 4.2 **Not satisfied.** No CodeScene Check Run appears on PR #49 — only the `codescene delta` CI job. The PR integration webhook still needs enabling in the CodeScene dashboard for project 83349; per design.md this is a manual, out-of-scope step. The CI gate does not depend on it.
- [ ] 4.3 Badges already render correctly in the README.
- [ ] 4.4 The gate's red path is still unexercised — no run has produced a finding, so the "non-zero exit + parseable JSON ⇒ fail" branch and the JSON summary block are unproven. CodeScene does not publish the delta JSON schema; the first real finding is what will confirm the predicate.
