# Design

## Context

See `proposal.md` for motivation and defect details.

The unit test suite `.github/scripts/clean-release-changelog.test.mjs` tests the release changelog cleaner and check mode. Most tests use isolated temporary directories via `mkdtempSync` in `node:fs` to test filesystem operations without touching the repository workspace.

The single exception was `checkReleaseRange skips check when base version equals current version`, which used `process.cwd()` as `rootDir` and mocked `execGit` with hardcoded `"0.20.0\n"`. When `version.txt` in the workspace is bumped during release PR creation, the test fails.

## Goals / Non-Goals

**Goals:**
- Provide hermetic filesystem isolation for `checkReleaseRange skips check when base version equals current version`.
- Ensure `.github/scripts/clean-release-changelog.test.mjs` passes deterministically under any repository version state.
- Remove redundant unasserted test execution.

**Non-Goals:**
- Modify `.github/scripts/clean-release-changelog.mjs` (the production implementation already correctly supports injected `rootDir` and `execGit`).
- Modify workflow files or CI topologies.
- Change normative capability specifications (`skip_specs: true`).

## Decisions

### Decision 1: Ephemeral directory fixture with `try ... finally`

- **Choice:** Create an ephemeral directory via `mkdtempSync(join(tmpdir(), "bloodtrail-release-skip-"))`, write a fixture `version.txt` containing `"0.20.0\n"`, pass `rootDir: tempDir` to `checkReleaseRange`, and clean up via `rmSync(tempDir, { recursive: true, force: true })` in a `finally` block.
- **Alternatives considered:**
  - *Read ambient `version.txt` dynamically and return it in `execGit`*: Rejected because it leaves test execution coupled to ambient repository workspace state and directory structure. A dedicated temporary directory ensures full hermetic isolation and reproducibility.

### Decision 2: Eliminate dead duplicate invocation

- **Choice:** Remove lines 538–544 which called `checkReleaseRange` and assigned `result` without performing any assertions. Retain a single, clean invocation asserting `{ skipped: true, version: "0.20.0" }`.
- **Alternatives considered:**
  - *Keep both calls*: Rejected because the first call was unasserted and was the direct cause of the unhandled git failure when `version.txt` was bumped.

## Risks / Trade-offs

- **[Risk]** Ephemeral directory left behind if process exits abruptly.
  → **Mitigation:** Use standard `try ... finally` with `rmSync(..., { recursive: true, force: true })` matching all other fixture tests in the same file.
