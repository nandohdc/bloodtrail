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
- [x] 4.5 **Established the gate's real coverage — a parser blind spot, not a scoping rule.** Resolved on canary PR #140 (closed unmerged). The premise inherited from PR #51 was wrong: the variable was never new-versus-existing files.

  **Finding.** CodeScene CLI 1.0.37's TypeScript analyser **silently skips any function whose parameter list uses the `readonly` type modifier**. Such a function is not scored, contributes nothing to the file's Code Health, and never reaches `cs delta`. If every function in a file is affected, the file gets no score at all: `cs check` prints `Code health score: N/A`.

  **Proof** — seven synthetic variants differing only in the signature (run `31451854600`, job `93657664555`):

  | Variant | Parameter list | Score | Smells |
  |---|---|---|---|
  | v1 | `tags: string[]` | 8.72 | all three |
  | v2 | `tags: readonly string[]` | **N/A** | **none** |
  | v3 | `tags: ReadonlyArray<string>` | 8.72 | all three |
  | v4 | defaulted params | 8.72 | all three |
  | v5 | `readonly` in an interface, plain params | 8.72 | all three |
  | v6 | readonly fn, then plain fn | 8.72 | only the plain one |
  | v7 | plain fn, then readonly fn | 8.72 | only the plain one |

  v2 against v3 is decisive: `readonly string[]` and `ReadonlyArray<string>` denote the same type, and only the first form breaks. The gap is in the analyser's grammar for `readonly T[]` in parameter position, not in anything semantic. v4 clears default values, v5 clears `readonly` inside interfaces, and v6/v7 show the loss is confined to the offending function in either order rather than halting the parse.

  **It explains every prior observation.** At head: `probe-new.ts` (no `readonly` in params) 8.72 with all three smells; `bounded-fifo.ts` 10.00 because `scoreSample(… tags: readonly string[] …)` is invisible; `testing.ts` 10.00 with `createInMemoryAuditSink` degraded in place behind `{ readonly capacity?: number }`; `internal.ts` 9.38 reporting only its two pre-existing smells while three appended cc-15 functions vanish. PR #51's `canary.ts` copies carried no `readonly` in their parameter lists and the `bounded-fifo.ts` copy carried `tags: readonly string[]` — that, not file newness, was the difference.

  **Ruled out.** Rounds 1 and 2 (run `31450518012` job `93653764626`; run `31451301949` job `93656051402`) re-analysed the identical bytes at a path CodeScene had never seen and got identical results, eliminating caching, path matching and git history. Case C — three bad functions appended to a 73-line file — was also absent from the delta, which eliminates any score-band or threshold explanation (H1). H2 and H3 as originally framed are both wrong: modified files are in scope, and the parser does not skip whole files.

  **Exposure here.** On `main`, ten of 215 functions in `packages/security-audit-sdk-core/src` sit in the blind spot — six with the proven-invisible `readonly T[]` operator form (`config.ts:192`, `context.ts:400`, `context.ts:406`, `errors.ts:114`, `operations.ts:82`, `validation/prohibited.ts:64`) and four with the inline `{ readonly … }` literal form (`context.ts:127`, `context.ts:156`, `errors.ts:40`, `testing.ts:36`). Bounded, but silent, and it grows with new code in the SDK's prevailing style. SonarQube flags such code independently (`typescript:S107`, `typescript:S3776`), so the redundancy between the two analysers is now load-bearing rather than incidental.

  **Consequences carried out:** design.md Decision 7 records the mechanism and evidence; `README.md` and `proposal.md` no longer claim the job fails for *any* newly introduced issue; the vendor defect is filed as a follow-up issue with the reproduction.

  **Not resolved, and deliberately out of scope:** whether the SaaS App shares the same analyser. Its silence on `bounded-fifo.ts` is consistent with this defect, and the Hotspot-Decline reading recorded earlier is no longer needed to explain it, but the App was not tested against the v1/v2 pair. The follow-up issue carries that question.
