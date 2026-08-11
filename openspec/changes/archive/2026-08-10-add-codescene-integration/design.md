## Context

Bloodtrail is a multi-workspace TypeScript monorepo with three distinct code areas:

| Workspace | Path | Nature |
|---|---|---|
| SDK core | `packages/security-audit-sdk-core/` | Shipping code, contract-bound, strict validation gates |
| Contract | `contracts/security-audit/` | Canonical event contract + generators |
| Browser telemetry | `research/browser-telemetry/` | Investigation, not shipping code |

CI is a single `ci.yml` workflow with jobs for each workspace plus coverage (Codecov) and static analysis (SonarQube). All run on `pull_request` and `push: main`.

CodeScene is a SaaS platform (codescene.io) that analyzes Git history. It offers:
- **PR Integration**: webhook-driven automated code health reviews posted as GitHub Check Runs. Configured in the CodeScene UI; reads `.codescene/custom-quality-gates.json` from the repo for per-path quality profiles.
- **CLI (`cs`)**: a binary for local and CI use. `cs delta` compares two refs and reports only newly introduced code health issues — the right signal for a PR gate.
- **Status badges**: embeddable in README for public visibility.

The `CODESCENE_TOKEN` (a personal access token generated in the CodeScene UI) is already stored as a GitHub repository secret.

## Goals / Non-Goals

**Goals:**
- Gate every PR with behavioral code health analysis via `cs delta`, alongside existing Sonar and Codecov gates.
- Apply per-workspace quality profiles so the SDK is held to a stricter standard than research code.
- Surface CodeScene status in the README.

**Non-Goals:**
- The CodeScene SaaS project setup (creating the project, enabling PR integration in the UI) is out of scope — that's a one-time manual step in the CodeScene dashboard.
- The `cs` CLI is not installed locally as part of this change; only the CI runner installs it.
- Custom code health rule tuning (`.codescene/code-health-rules.json`) is deferred — start with the built-in profiles.

## Decisions

### Decision 1: `cs delta` in CI vs. webhook-only PR integration

**Choice**: Run both. The webhook PR integration provides rich Check Run annotations (line-level findings, explanations) and is the primary review aid. `cs delta` in CI provides a binary pass/fail gate the workflow controls directly — it fails the check when new issues appear, independent of the webhook's quality profile configuration.

**Alternatives considered**:
- Webhook only: loses the explicit CI gate; the PR integration's Check Run is informational unless configured as a required status check in GitHub branch protection, which requires GitHub App installation.
- CLI only: loses the rich PR annotations and the historical trend analysis CodeScene provides on its dashboard.

### Decision 2: Quality profile assignment per workspace

| Workspace | Profile | Rationale |
|---|---|---|
| `packages/security-audit-sdk-core/**` | `clean_code_collective` | Security-sensitive shipping code; advisory rules are appropriate |
| `contracts/security-audit/**` | `clean_code_collective` | Canonical contract; generated output must be traceable |
| `research/browser-telemetry/**` | `bare_minimum` | Investigation code; critical rules only |
| `*/**` (catch-all) | `bare_minimum` | Default for config files, scripts, docs |

**Alternative**: Uniform `bare_minimum` everywhere. Rejected — the SDK warrants stricter enforcement.

### Decision 3: CI job placement

Add a new `codescene-delta` job to the existing `ci.yml` rather than a separate workflow file. Rationale:
- The existing `ci.yml` already runs per-PR and gates on all jobs passing.
- A new workflow file would require separate branch protection configuration.
- The job is lightweight (install binary + run delta), not a full build.

### Decision 4: `cs delta` invocation

Use `cs delta "origin/${{ github.base_ref }}"` which compares the PR head against the merge target. The comparison ref is a positional argument (`cs delta [<options>] [<branch> [<branch>]]`), and `fetch-depth: 0` is what makes `origin/<base>` resolvable — checkout fetches `+refs/heads/*:refs/remotes/origin/*` only at full depth. The `--output-format json` flag gives machine-readable output.

The installer must be invoked as `sh -s -- -y`. Its default path prompts for confirmation via `read REPLY < /dev/tty` before editing `~/.bashrc`; a runner has no controlling terminal, so the read fails and the script's `set -e` aborts it *after* the binary is already in place. `-y` is its headless flag. The `~/.bashrc` edit is irrelevant in CI regardless — `$GITHUB_PATH` is what exposes `cs` to later steps.

### Decision 5: Split failure semantics

A CodeScene outage, an expired licence, or a failed install must not redden an unrelated PR; a genuine finding must. `continue-on-error` cannot express that distinction:

- At **job** level it still reports the job as `failure`, so the red check remains on the PR — it only stops the *workflow run* from going red. It also swallows real findings.
- At **step** level on the analysis step it would suppress findings too.

So `continue-on-error` is applied to the install step alone, and the analysis step chooses its own exit code.

**Correction (verified on PR #51).** This decision was originally written on the premise that `cs` "exits non-zero if any code issues are detected". That is the opposite of what the CLI does. `cs delta --help` documents:

> `--error-on-warnings` — Quit with non-zero exit code if there was any Code Health finding. (Note that the default behavior is exiting with code 0 unconditionally)

Without that flag the job was a **no-op gate** from the day it was added: it ran the analysis, received the findings, and reported every PR clean. The diagnostic run on PR #51 recorded `exit=0` alongside a complete findings JSON for two files and three rules. The invocation now passes `--error-on-warnings`.

The same diagnostic captured `cs delta --help` in full for 1.0.37, which is worth recording because it bounds what the invocation can express. The entire option set is `--staged`, `--interactive`, `-f/--file`, `--error-on-warnings`, `--git-hook`, `--output-format`, `--pretty` and `--verbose`. None of them widens or narrows which files the analysis considers, so the scope question raised in task 4.5 cannot be a matter of flags we failed to pass. One caveat in that help text is easy to misread as an answer and is not: specifying an output format "will report new issues only - i.e. no improvents [sic] or explanations" suppresses *improvements*, not modified files — an introduced finding stays an introduced finding whichever file it lands in.

The exit-code/JSON matrix below is correct *given the flag* — a non-zero exit still cannot by itself separate a finding from a broken token, and whether the run produced parseable JSON remains the second signal: a completed analysis always emits JSON on stdout, a failed one never does. This was confirmed rather than assumed: the findings JSON is still written to stdout when the flag makes the process exit non-zero.

| Exit code | Parseable JSON | Meaning | Job result |
|---|---|---|---|
| 0 | — | no new issues | green |
| non-zero | yes | findings | **red** |
| non-zero | no | tool, token, licence or network failure | green + `::warning::` |

The raw output is always written to `$GITHUB_STEP_SUMMARY`. CodeScene does not publish the delta JSON schema; the shape observed on PR #51 is a top-level array of files:

```json
[{ "name": "<path>", "old-score": null, "new-score": 8.72,
   "findings": [{ "category": "Complex Method", "change-type": "introduced",
                  "new-pp": 1.35, "threshold": 9,
                  "change-details": [{ "description": "...", "value": 15,
                                       "locations": [{ "start-line": 7, "end-line": 57,
                                                       "function": "scoreSample" }] }] }] }]
```

`jq -e .` accepts this, so the predicate holds. It could now be tightened to require a non-empty array of objects carrying `findings`, which would additionally reject a well-formed-but-empty response.

### Decision 6: README badges

Add CodeScene's project-level code health and knowledge distribution badges. These are static image URLs generated in the CodeScene UI after project creation.

### Decision 7: What the gate actually covers — a parser blind spot, not a scoping rule

PR #51 concluded that the gate had not reported a smell added to an *existing* file, and left the cause open. That framing was a confound. The canary on PR #140 established the real mechanism:

> **CodeScene CLI 1.0.37's TypeScript analyser silently skips any function whose parameter list uses the `readonly` type modifier.** The function is not scored, not counted toward the file's Code Health, and never reaches `cs delta`. If *every* function in a file is affected, the file has no score at all — `cs check` prints `Code health score: N/A`.

Seven synthetic variants, identical but for the signature, isolate it (run `31451854600`, job `93657664555`):

| Variant | Parameter list | Score | Smells reported |
|---|---|---|---|
| v1 | `tags: string[]` | 8.72 | all three |
| v2 | `tags: readonly string[]` | **N/A** | **none** |
| v3 | `tags: ReadonlyArray<string>` | 8.72 | all three |
| v4 | defaulted params (`boost = 0`, `tags: string[] = []`) | 8.72 | all three |
| v5 | `readonly` in an *interface*, plain params | 8.72 | all three |
| v6 | readonly function, then plain function | 8.72 | only the plain one |
| v7 | plain function, then readonly function | 8.72 | only the plain one |

v2 against v3 is the crux: `readonly string[]` and `ReadonlyArray<string>` are the same type to TypeScript, and only the first form breaks. So this is a gap in the analyser's grammar for the `readonly T[]` syntax in parameter position, not anything about immutability. v5 shows the modifier is harmless inside an interface declaration; v4 clears default values; v6 and v7 show the damage is confined to the offending function, in either order, rather than halting the parse.

This explains every earlier observation exactly, with no residue:

| File at head | Content | Score | Why |
|---|---|---|---|
| `probe-new.ts` (and PR #51's `canary.ts`) | one bad function, no `readonly` in params | 8.72 | analysed normally |
| `bounded-fifo.ts` | clean class + `scoreSample(… tags: readonly string[] …)` | 10.00 | the bad function is invisible |
| `testing.ts` | `createInMemoryAuditSink(options: { readonly capacity?: number } …)` degraded in place | 10.00 | as above |
| `internal.ts` | clean base + three bad functions with `readonly` params | 9.38 | reports only the two pre-existing smells |

PR #51's two `canary.ts` copies happened to take a named interface as their first parameter and carried no `readonly` in the parameter list; the `bounded-fifo.ts` copy took `tags: readonly string[]`. **The difference was the signature, not the file's newness** — which is why "coverage of existing files" looked like the variable. Rounds 1 and 2 also confirmed the result is keyed to content alone: the identical bytes copied to a path CodeScene had never seen scored identically, ruling out caching, path matching and git history.

**Exposure in this repository.** On `main`, of 215 functions in `packages/security-audit-sdk-core/src`, ten sit in the blind spot: six use the proven-invisible `readonly T[]` operator form (`config.ts:192`, `context.ts:400`, `context.ts:406`, `errors.ts:114`, `operations.ts:82`, `validation/prohibited.ts:64`) and four use the inline `{ readonly … }` literal form that `testing.ts` indicates is also affected (`context.ts:127`, `context.ts:156`, `errors.ts:40`, `testing.ts:36`). That is a bounded blind spot, not a wholesale failure — but it is silent, and it grows with any new code written in the SDK's prevailing `readonly` style.

**Consequence for the gate.** `codescene delta` remains a real gate: it fails on findings, as 4.4 proved. But it cannot be relied on as *exhaustive* for TypeScript. A function using `readonly` parameter types can carry any amount of complexity and the gate will stay green. SonarQube does flag such code (`typescript:S107`, `typescript:S3776` on the original `bounded-fifo.ts` canary), so the repository is not blind to it overall — the redundancy between the two analysers is what covers this, and that is now a load-bearing property rather than a nicety.

The strictly correct scope claim is therefore: **`cs delta` gates newly introduced code health issues in the functions its TypeScript analyser can parse.** Claims of the form "fails for any newly introduced issue" are not supported.

## Risks / Trade-offs

- **[Risk] The installer is interactive by default** → Mitigation: `sh -s -- -y`. `--output-format json` does *not* suppress the prompt — the prompt is in the install script, not the CLI, and assuming otherwise is what made the job fail on every run of PR #49.
- **[Risk] `cs delta` is a new binary dependency fetched at runtime** → Partial mitigation: the install script is served from CodeScene's official downloads domain over HTTPS. **Unresolved**: the script is unpinned and fetches version `latest`, so the tool can change under the repository without a commit, and although CodeScene ships `cs.sha256` and `cs.sha256.asc` inside the archive its own installer verifies neither. This sits awkwardly beside the repository's posture elsewhere (Sonar actions pinned by commit SHA; `packages/security-audit-sdk-core/DEPENDENCIES.md` requires exact pinning). Deferred to a follow-up change that pins `CS_VERSION` and verifies the checksum.
- **[Risk] Student account may have rate/analysis limits** → Mitigation: the `cs delta` CI job runs only on PRs, not every push; the SaaS project analysis runs on its own schedule.
- **[Trade-off] The PR integration webhook and `cs delta` CI job report overlapping information** → Acceptable: they serve different purposes (review aid vs. gate).
