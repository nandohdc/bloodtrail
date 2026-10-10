# Tasks

## 1. Proposal and Governance Assessment

- [x] 1.1 Author the proposal, design, tasks and full non-sensitive assessment
  for `isolate-normative-precedence-fixtures-from-git-maintenance`, with
  `skip_specs: true` and no spec delta. Verify `openspec validate
  isolate-normative-precedence-fixtures-from-git-maintenance --strict`, `node
  openspec/scripts/generate-assessment.mjs --change
  isolate-normative-precedence-fixtures-from-git-maintenance --check`, and `node
  openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change
  isolate-normative-precedence-fixtures-from-git-maintenance` pass. Run both full
  suites and core typecheck before the proposal commit; retain measured base
  counts and strict-all baseline warnings externally.

## 2. Test Isolation Implementation

- [x] 2.1 Add the frozen `GIT_FIXTURE_CONFIG` with exactly
  `-c maintenance.auto=false -c gc.auto=0` and the one-sentence #780/#775/#772
  detached-repack warning in each of the three files. Prepend it in both
  normative-precedence-repository wrappers, in mutation-assurance's `run()` only
  for `args[0] === "git"`, and in the script's git-only `run()`; keep `command()`
  and all call sites unchanged. Verify the full three-file diff contains only
  those declarations/comments and four argument edits, and both full suites
  and core typecheck pass before the implementation commit.

## 3. Verification and Lifecycle Completion

- [x] 3.1 Run `node --test openspec/tests/contract-reuse/*.test.mjs` and
  `node --test openspec/tests/design-pattern-governance/*.test.mjs` separately
  as CI does on the final commit, without Git configuration environment
  overrides. Require each suite's `ℹ tests` and `ℹ pass` to equal its measured
  base counts, and `ℹ fail` to be zero; preserve the full commands and outputs.
- [x] 3.2 Run the complete final governance chain against
  `5368abed9a4a971ce049cb3f90df335c0caa0dc7`: change and all-change OpenSpec
  validation, strict-all validation with identical baseline warnings and no
  `[ERROR]`, generated assessment drift, final design-pattern governance,
  trusted/candidate dual check, contract reuse for every active change,
  merge-stage normative precedence, `make`, core typecheck, `git diff --check`
  and exact nine-path scope/LF checks. Record each command's own exit code and
  summary, and require a nonempty inspected range. Leave
  `cs delta --error-on-warnings` to the reviewer; do not run it here.
- [x] 3.3 Record the supplied external per-file Trace2 census and analysis
  verbatim on clean detached final and proposal-commit worktrees. Run all 19
  openspec test files plus the mutation script for fixed, reverted and fixed
  with inherited `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=maintenance.auto
  GIT_CONFIG_VALUE_0=true`. Require all 20 statuses zero, fixed/inherited starts
  zero in every entry, and reverted starts in exactly normative-precedence-
  repository, mutation-assurance and the script. Record every
  `maintenanceWithWork` value regardless of result; stop on any unexpected or
  missing source, without tuning the census. Record the fixed script's
  `ANCHOR_PREFLIGHT=PASS`, `EXPECTED_MUTANTS=33`, `APPLIED_MUTANTS=33`,
  `KILLED_MUTANTS=33`, `NOT_APPLIED=0`, `SURVIVED=0`, `NULL_CONTROLS=CLEAN` and
  `RESTORATION=BYTE_IDENTICAL`. Keep the external census directory for task 3.4.
- [x] 3.4 Record the supplied five-stage normative-precedence comparison
  between the final commit and an unsigned empty control on the exact base,
  only in external detached worktrees. Require identical sorted diagnostic and
  observation code/path lists and matching exit codes at candidate, merge,
  fold, activation and release; record every line and stop on any difference.
  Redirect JSON to files, not pipes. Preserve census/comparison evidence
  externally, then remove fixed, reverted and null worktrees and the temporary
  census directory. Amend verification ticks into the implementation commit,
  preserving its subject, and certify the amended final commit with the full
  validations, census and comparison.

## 4. Archive

- [ ] 4.1 After implementation merges, archive
  `isolate-normative-precedence-fixtures-from-git-maintenance` in a later,
  separate pull request and verify the archive result. It stays unchecked until
  then.
