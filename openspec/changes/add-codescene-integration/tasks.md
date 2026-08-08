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
  - **Superseded in part by 4.4.** The install and invocation findings above hold. The "exits 0 with no new code health issues" conclusion does not: at that time `cs delta` exited 0 whatever it found, so that green proved only that the CLI ran, not that the tree was clean.
- [x] 4.2 Satisfied on PR #51 (canary, closed unmerged). The dashboard PR integration is live and posts a Check Run:
  - Name `CodeScene Code Health Review (main)` — the target branch is part of the context name, so it differs per base branch.
  - App `codescene-access`, app_id `3755875`. Distinct from the `codescene delta` Actions job (app_id `15368`); the two coexist.
  - `details_url` resolves to `https://codescene.io/projects/83349/delta/results/...`, confirming project 83349.
  - **`.codescene/custom-quality-gates.json` is read and matched by path.** Proven by a differential: a byte-identical `canary.ts` (same SHA-256) committed to `packages/security-audit-sdk-core/src/` and `research/browser-telemetry/`. The "Enforce critical code health rules" gate failed **both** copies (`Bumpy Road Ahead`); the "Enforce advisory code health rules" gate failed **only** the `clean_code_collective` copy (`Complex Method`, `Excess Number of Function Arguments`). Identical code, different verdict, purely by path.
  - Nuance worth knowing: **annotations ignore the profile, gates honour it.** All six annotations were posted (three per file, both paths). Only the gate outcome differentiates, so a `bare_minimum` path still receives advisory inline comments that do not block.
- [x] 4.3 Badges render correctly in the README (`README.md:21-25`, project 83349).
- [x] 4.4 Satisfied on PR #51 — **but the gate was broken as shipped and had to be fixed first.**
  - **Root cause.** `cs delta` exits 0 unconditionally unless `--error-on-warnings` is passed; `cs delta --help` says so explicitly. The job therefore reported every PR clean regardless of findings — a no-op gate from the day it was added, including the green run 4.1 cites. Diagnostics (run `31261140659`) recorded `exit=0` with a complete findings JSON on stdout for 2 files × 3 rules, immediately before the step printed "No new code health issues."
  - **Fix.** Added `--error-on-warnings` to the invocation.
  - **Red path verified.** Run `31261278754`, job `93112360182`: install succeeded, "Report unavailable CLI" skipped, "Delta analysis" failed with exit 1, and the sole annotation is that failure — no `::warning::cs delta did not complete`, so the findings branch ran rather than the advisory fallback.
  - **JSON predicate confirmed.** The findings JSON is still emitted on stdout when the flag forces a non-zero exit, so `jq -e .` distinguishes findings from tool failure as designed. Observed shape recorded in design.md Decision 5.
- [ ] 4.5 **Open observation, cause unknown.** Neither the CLI nor the SaaS check reported an equivalent smell added to an *existing* file. Commit `8ccf63e` appended a `scoreSample` function (8 arguments, cyclomatic complexity ~15, same bumpy-road shape) to `packages/security-audit-sdk-core/src/bounded-fifo.ts`. `git diff --name-only origin/main...HEAD` listed the file, yet the delta JSON omitted it and the App posted no annotation for it — while both flagged the identical shape in the two *new* files. SonarQube's analyser did flag it (`typescript:S107`, `typescript:S3776`), so the smell is real. Whether CodeScene's delta only reports findings once a modified file's code health crosses a threshold, or something else is at play, is unresolved. Until it is, the gate's coverage of edits to existing files should not be assumed.
