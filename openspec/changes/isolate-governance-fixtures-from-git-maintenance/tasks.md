# Tasks

## 1. Proposal and Governance Assessment

- [x] 1.1 Author the proposal, design, tasks and full non-sensitive assessment
  for `isolate-governance-fixtures-from-git-maintenance` with `skip_specs: true`.
  Verify `openspec validate isolate-governance-fixtures-from-git-maintenance
  --strict`, `node openspec/scripts/generate-assessment.mjs --change
  isolate-governance-fixtures-from-git-maintenance --check` and `node
  openspec/scripts/check-design-pattern-governance.mjs --phase assessment
  --change isolate-governance-fixtures-from-git-maintenance` pass. Run both
  existing suites before committing the proposal; preserve baseline counts.

## 2. Test Isolation Implementation

- [ ] 2.1 In both `DisposableRepository` helpers, rename `GIT_IDENTITY` to
  `GIT_FIXTURE_CONFIG` in its declaration and single use, append
  `-c maintenance.auto=false -c gc.auto=0` after existing entries, and add the
  one-sentence #775/#772 detached-repack comment. Verify the full helper diffs
  contain nothing else and both existing suites pass before committing; preserve
  methods, constructors, exports, environment handling and individual test files.

## 3. Verification and Lifecycle Completion

- [ ] 3.1 Run `node --test openspec/tests/contract-reuse/*.test.mjs` and
  `node --test openspec/tests/design-pattern-governance/*.test.mjs` per suite
  as CI runs them, without maintenance environment overrides. Require each
  suite's `# tests` and `# pass` equal to the base's (73 contract reuse and 370
  design-pattern governance), with `# fail` zero; preserve full outputs on
  the final implementation commit.
- [ ] 3.2 Run the governance chain on the final commit: change and all-change
  OpenSpec validation (including strict baseline-warning comparison), generated
  assessment drift, final design-pattern governance against `c145e4a`, trusted
  and candidate dual checks, contract reuse for every active change, normative
  precedence at merge stage, `make`, `cs delta --error-on-warnings`, and
  `git diff --check`. Record each exact command and exit code, verify the range
  is not an empty check, and confirm only the eight allowed paths changed and
  signed-change-bound files remain byte-identical.
- [ ] 3.3 Record the supplied per-file Trace2 census and analysis verbatim in
  external storage from clean detached fixed and proposal-commit reverted
  worktrees on the final implementation commit. Run fixed, reverted and fixed
  with inherited `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=maintenance.auto
  GIT_CONFIG_VALUE_0=true`. Require all 19 statuses zero; fixed and inherited
  runs start maintenance only in `mutation-assurance` and
  `normative-precedence-repository`, with no work; reverted also restores
  helper-file starts. Record every `maintenanceWithWork` value regardless of
  expectation, stop on an unexpected source or missing reverted helper starts,
  and remove the detached worktrees and temporary census directory afterwards.

## 4. Archive

- [ ] 4.1 After implementation merges, archive
  `isolate-governance-fixtures-from-git-maintenance` in a separate pull request
  and verify the archive result. Leave this task unchecked throughout this run.
