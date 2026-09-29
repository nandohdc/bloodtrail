# Tasks

## 1. Proposal and Governance Assessment

- [x] 1.1 Complete OpenSpec change packet (`proposal.md`, `design.md`, `tasks.md`) with `skip_specs: true`; verify `npx --yes @fission-ai/openspec@latest validate isolate-release-changelog-check-test --strict` passes.
- [x] 1.2 Formulate design-pattern governance assessment (`assessment.source.json` and `assessment.json`); verify `node openspec/scripts/generate-assessment.mjs --change isolate-release-changelog-check-test --check` and `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` succeed.

## 2. Test Isolation Implementation

- [ ] 2.1 Refactor `checkReleaseRange skips check when base version equals current version` in `.github/scripts/clean-release-changelog.test.mjs` to execute against a hermetic temporary directory created with `mkdtempSync` and cleaned up with `rmSync` in a `finally` block, removing redundant unasserted execution.
- [ ] 2.2 Verify `.github/scripts/clean-release-changelog.test.mjs` passes with both matching version and bumped version in the root workspace (`node --test .github/scripts/clean-release-changelog.test.mjs`).

## 3. Verification and Lifecycle Completion

- [ ] 3.1 Run repository script test suite (`node --test .github/scripts/*.test.mjs`) and product test loop (`make runtime-gates`); verify all tests pass.
- [ ] 3.2 Run governance checks (`node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`, `node openspec/scripts/run-governance-dual-check.mjs --base origin/main --phase final`, `node openspec/scripts/check-normative-precedence.mjs --stage candidate`, and `node openspec/scripts/check-normative-precedence.mjs --stage merge --base origin/main`); verify all pass.
- [ ] 3.3 Archive change `isolate-release-changelog-check-test` under `openspec/changes/archive/` and close issue #646.
