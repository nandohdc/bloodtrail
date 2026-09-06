## Context

See `proposal.md` for motivation. The `coverage` job uploads three lcov reports to a run-scoped artifact via `actions/upload-artifact@v7`; the `sonar` job downloads that artifact via `actions/download-artifact@v8`. GitHub Actions has no step-level retry, so either action failing on transport (as opposed to content) reds its job with no recovery path. On PR #344, run 34007623580, `upload-artifact` failed with `Failed to CreateArtifact: Unable to make request: ECONNRESET` after every preceding step (all three `npm run test:coverage` legs and the lcov path rewrite) had succeeded; `sonar` was then never created because of `needs: [coverage]`. Eighteen minutes later, on the same run, `download-artifact` in the `sonar` job failed with `Failed to ListArtifacts: Unable to make request: ECONNRESET` (#345 comment). Both directions of the artifact hop need the same remedy.

## Goals / Non-Goals

**Goals:**

- Turn a transport-only failure of either artifact step into a slow green run instead of a red required context, via one bounded in-house retry per direction.
- Keep a genuine "no coverage produced" outcome failing closed: the retry wrapper must not swallow it.
- Add zero new dependencies, actions, or scripts — the repository has declined third-party retry actions on supply-chain grounds, and `.github/scripts/npm-audit-retry.mjs` exists precisely to keep transport retry in-house.

**Non-Goals:**

- Retrying any other CI step; the SonarQube scan already has its own in-repo retry precedent and is untouched.
- Restructuring the artifact hop itself (for example, having `sonar` generate its own coverage) — rejected below; it duplicates build+test cost and worsens the makespan measured in #306.
- Changing required-context names, branch-protection policy, or coverage thresholds.
- Altering `if-no-files-found` semantics on a successful path: it stays `error` on every attempt.

## Decisions

### 1. Step-level retry via `continue-on-error` plus an outcome-gated retry step

The upload step becomes two steps:

- Attempt 1: `actions/upload-artifact@v7` with `id: upload` and `continue-on-error: true`.
- Wait: a `sleep 10` step gated on `steps.upload.outcome == 'failure'` (a short bounded pause so a transient blip can clear without adding latency to the success path).
- Attempt 2: the same action, gated on `steps.upload.outcome == 'failure'`, without `continue-on-error`, so a second failure reds the job.

Both attempts keep `if-no-files-found: error` and `path:` listing exactly the three lcov reports, so a genuine absence fails attempt 1 and attempt 2 and the context stays red. Both attempts set `overwrite: true`: if attempt 1 failed after partially creating the run-scoped artifact container, attempt 2 must be able to replace it rather than dying on an "artifact already exists" conflict; the `coverage` artifact name has no other producer in the run, so `overwrite` weakens nothing.

The `sonar` job's `actions/download-artifact@v8` step gets the same shape (`id: download`, `continue-on-error: true`, `sleep 10`, retry gated on outcome). A failed download leaves no server-side state, so no overwrite concern exists on that side.

This is the pattern already used for the SonarQube scan steps in this workflow (one retry after a 30s wait), reduced to a 10s wait because the artifact fault is a connection reset, not a server-side plugin-download reset.

### 2. One retry, not more

Exactly one retry (two attempts) per direction. The repository's stated philosophy for the scan retry applies verbatim: one retry turns a server blip into a slow green run rather than a red required check, while a real failure still fails twice. A longer-lived fault — the observed one lasted roughly eighteen minutes — would defeat any bounded retry count, and unbounded retries convert a fast signal into a slow timeout.

### 3. Alternatives compared

- **Third-party retry action** (wrap upload/download in a marketplace retry step). Rejected: this repository has deliberately declined new third-party actions for transport resilience; `.github/scripts/npm-audit-retry.mjs` was written rather than adopting one (#345 documents this supply-chain stance). Adding one here would also retry at the wrong granularity — the wrapper cannot distinguish transport failure from `if-no-files-found` failure without reimplementing the action's error parsing.
- **In-house artifact upload reimplementation** (script the Actions REST artifact API with bounded retry). Rejected: reimplements chunked upload, GZIP, and container bookkeeping that `actions/upload-artifact` already owns; the maintenance surface and failure modes are larger than the defect being fixed, and a scripted reimplementation would itself need an if-no-files-found-equivalent assertion to stay fail-closed.
- **Decouple `sonar` from the artifact hop** (have `sonar` generate its own lcov). Rejected: duplicates the `coverage` job's three `npm ci` + `npm run test:coverage` legs inside the long-pole `sonar` job, worsening the makespan measured in #306, and creates two producers of coverage metrics that can silently diverge. It also leaves the `coverage` job's own upload unretried, so the required `coverage` context stays exposed to the exact defect in #345.

### 4. Verification without a step-level retry primitive

GitHub Actions has no native step retry, and this change deliberately adds no wrapper action, so the retry logic cannot be exercised end-to-end outside CI. Verification is therefore structural: the diff must show both directions carrying the `continue-on-error` + outcome-gated retry shape, `if-no-files-found: error` present on both upload attempts, `overwrite: true` on both upload attempts, and the retry step ungated by `continue-on-error`. Live transport-blip behavior is validated by the next real `ECONNRESET`, which the retry converts from a false red into a slow green run without touching the failure signal for genuine absences.
