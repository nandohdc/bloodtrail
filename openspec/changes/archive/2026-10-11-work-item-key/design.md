# Design

## Context

See `proposal.md` for #743's motivation and #747's adopted release decisions. The existing script checks `SUBJECT` independently for `options.title` and fetched commit subjects; its conventional syntax already bounds allowed types, optional scope and breaking marker, nonempty descriptions, and trailing spaces. GitHub fetching and pagination are not part of the correction.

The script is governance-core, requiring a full `governance_core_path` assessment even though this is an abbreviated, specs-skipped tooling change. The associated capability is `software-design-pattern-governance`, with no material capability modification. Proposal validation is technical evidence, not owner approval or publication authorization.

## Goals / Non-Goals

**Goals:**

- Reject leading work-item labels identically for PR titles and every commit subject.
- Preserve conventional syntax and ordinary descriptions while giving an actionable explanation.
- Demonstrate CLI behavior and sensitivity to removing the new rejection.

**Non-Goals:**

- Adding hooks, dependencies, modules, network fixtures or a new CI job.
- Altering Release Please, existing tagged release notes, agent briefs, or canonical specs.
- Inferring human approval, introducing signed records or pins, or archiving in this PR.

## Decisions

### One shared subject check

After matching valid conventional syntax, extract the description and apply the anchored pattern `^[A-Z][A-Z0-9]*-\d+(?: - |:)`. A shared predicate/helper serves both PR-title and fetched-commit validation; the two call sites retain their own context, not separate rejection rules. Keep all existing format checks and GitHub behavior intact. The key requires an uppercase letter followed by uppercase letters or digits, a hyphen and digits, and then an exact spaced hyphen or colon.

Reject `feat: US-001 - x`, `feat(sdk-node): US-001 - x`, and `fix: ABC-12: x`. Accept `fix(sdk-node): x`, `feat: SHA-256 digests for x`, `fix: UTF-8 x`, and `chore: release v0.22.0`. A key appearing later in a description is not a leading label.

Keep existing invalid-format diagnostics. For the new rejection, report `PR title: ${options.title} (a work-item ID is not a change description)` or `commit ${sha}: ${subject} (a work-item ID is not a change description)`. Preserve failure exit 1 and success exit 0.

### CLI regression and planted-defect evidence

Use `node:test`, `node:assert/strict`, and `spawnSync(process.execPath, [scriptPath, "--title", subject], { encoding: "utf8" })` in the new `.github/scripts/check-conventional-commits.test.mjs`. Assert launch success, exact exit codes, and the full subject plus explanatory phrase in stderr for all three rejections. Assert all four valid cases pass, and cover existing syntax failures. The existing CI glob discovers the file without a workflow edit.

Read the production script and assert a unique mutation target exists. Disable only the work-item rejection, assert the bytes differ, and write the standalone mutant `.mjs` in an external directory from `mkdtempSync` under `tmpdir()`. All three work-item cases must pass under the mutant while production rejects them, proving the regression assertions distinguish the defect rather than a CLI crash. Remove the directory in `finally` with `rmSync`; never mutate the live script or commit control files.

### Alternatives rejected against the forces

- **Release Please plugin:** could filter changelog labels but would not reject their subjects at the contributor boundary; it changes an explicitly excluded release surface and loses subject-local diagnostics.
- **Commit-msg hook:** could reject local labels but is installation-dependent and does not establish the same rule for PR titles and API-fetched commits in CI.
- **Separate PR-only check:** could provide title diagnostics but lets run-local commit subjects reach Release Please and duplicates the acceptance rule across surfaces.

Direct implementation in the existing check meets the shared-rule, compatibility, diagnostic and bounded-release forces without a named pattern; `selected_pattern_ids` stays empty.

## Risks / Trade-offs

- **[Risk] Ordinary technical names resemble keys.** → Require the separator after the key and retain SHA-256/UTF-8 positive CLI cases; a literal leading key with a colon is intentionally a label under the adopted rule.
- **[Risk] Title and commit behavior diverge.** → Use one subject-validation helper at both call sites and inspect the restricted implementation diff.
- **[Risk] Tests fail for a crash rather than the predicate.** → Check child launch errors, exact exits and diagnostics, then prove the disabled-predicate mutant passes the same negative inputs.
- **[Risk] Governance-core code judges itself.** → Run trusted-baseline and candidate dual checks separately in final verification; technical passes do not imply owner approval.

## Migration Plan

Commit the six proposal artifacts first on baseline `f2827060538da5f05b18da7095086af9c98638e7`, completing only task 1.1. Keep that assessment unchanged when the implementation commit adds the script correction, tests and task ticks. Run strict change validation, assessment drift, final governance, dual checks, active contract-reuse checks, merge precedence, runtime gates and baseline whitespace checks; keep outputs externally. Contributors replace leading work-item labels with meaningful change descriptions. Reverting the implementation restores prior acceptance without changing release configuration. Archive only through the separate #752 PR after implementation lands.
