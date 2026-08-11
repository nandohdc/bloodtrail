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
  - Runs `cs delta "origin/${{ github.base_ref }}" --output-format json --error-on-warnings` with `CS_ACCESS_TOKEN` from the `CODESCENE_TOKEN` secret. `--error-on-warnings` is not optional: without it `cs delta` exits 0 whatever it finds, which is what made the job a no-op gate until 4.4 caught it.
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
- [ ] 4.5 **Establish the gate's coverage of changes to existing files.**

  **Done when** a canary has determined whether the CLI and the App report a deliberately degraded *pre-existing* file, and the result is written up either as (a) the proven coverage model, with the measured boundary, or (b) a reproducible vendor defect, with the repository's broader claims narrowed to match and a follow-up issue filed. Checking this task on an assumption — in particular on the untested assumption that existing files merely need to cross some undocumented threshold — does not satisfy it.

  **What PR #51 observed.** Commit `8ccf63e` appended a `scoreSample` function (8 arguments, cyclomatic complexity 15, 5 bumpy-road blocks) to `packages/security-audit-sdk-core/src/bounded-fifo.ts`. `git diff --name-only origin/main...HEAD` listed the file, yet the delta JSON omitted it and the App posted no annotation for it — while both flagged the identical shape in the two *new* files. SonarQube's analyser did flag it (`typescript:S107`, `typescript:S3776`), so the smell is real.

  **What has since been established** from the retained diagnostics log (run `31261140659`, job `93112035502`) and the Check Run on `c1d78d9`:
  - **The CLI saw the file and omitted it.** The same step that printed the file list printed, moments later, a two-element delta array containing only the two `canary.ts` paths — both carrying `"old-score": null`, the marker of a file with no prior state. `bounded-fifo.ts` has no entry at all, not even a zero-findings one.
  - **There is no scope flag we failed to pass.** The log captured `cs delta --help` in full for 1.0.37. The complete option set is `--staged`, `--interactive`, `-f/--file`, `--error-on-warnings`, `--git-hook`, `--output-format`, `--pretty`, `--verbose`. Nothing widens or narrows which files are considered, so this is not a misconfiguration on our side.
  - **The `--output-format` caveat does not explain it.** The help warns that specifying an output format "will report new issues only - i.e. no improvents [sic] or explanations". That suppresses *improvements*; an appended function is an introduced finding (`"change-type": "introduced"`), so it should have appeared regardless.
  - **Severity is not the discriminator.** CodeScene scored the `canary.ts` copies at "6 arguments, max arguments = 4"; the `bounded-fifo.ts` copy takes 8, with a byte-identical body. The existing-file case was the *worse* of the two.
  - **The App's silence has a separate candidate explanation.** The Check Run summary names three failed gates — "New code is healthy `(2 new files with code health below 10.00)`", "Enforce critical code health rules", "Enforce advisory code health rules" — and records "1 Quality Gates Passed". In CodeScene's published gate catalogue the only gate targeting decline in *existing* code is **Hotspot Decline**, which applies to hotspots alone; `bounded-fifo.ts` has exactly one commit in its whole history (`0df6668`) and so cannot be a hotspot. *Inference from the public catalogue — not yet checked against project 83349's own delta-analysis configuration.*
  - **Vendor documentation does not settle it, and points the other way.** The CLI command reference documents no file-selection semantics for `delta`, while the PR-integration guide states that reviews enforce quality on "new and existing code" and that `clean_code_collective` fails "for any file where the code health declines". Both are stronger than what was observed, so "expected behaviour" is not available as a conclusion without evidence.

  **What remains open.** PR #51 tested exactly one existing-file shape — *append a new function* — and never measured the file's Code Health score before and after. Three hypotheses are still indistinguishable:
  - **H1 — score band or threshold.** A file is reported only once its aggregate score crosses a boundary. `canary.ts` landed at 8.72 with that function in a 57-line file; diluted across 89-line `bounded-fifo.ts` the same function may have left the file inside the healthy band.
  - **H2 — modified files are out of `cs delta`'s scope**, contradicting the vendor's own PR-integration guide.
  - **H3 — parser skip** on that specific file.

  **Discriminating canary.** One throwaway PR carrying four cases, all under `packages/security-audit-sdk-core/**` so the `clean_code_collective` profile stays constant: a new bad file (positive control); the appended function (reproducing #51); an existing function rewritten in place from healthy to unhealthy; and an existing file degraded far enough to cross any plausible band. Per case it must capture `cs review` at base *and* head — the absolute file scores are the measurement #51 lacked, and the only thing that turns "not reported" into "not reported because the score went 10.0 → X" — plus `cs check` at head to rule out H3, the delta JSON with its exit code, `cs version`, and both SHAs; then the App's Check Run summary and annotations.

  Until this resolves, the gate's coverage of edits to existing files must not be assumed.
