# Tasks

Proposal and implementation are separate commits for #744 under #747. Only planning is complete in the proposal commit; perform the remaining groups in order during explicit apply.

## 1. Governed Proposal

- [x] 1.1 Author the seven-file `closes-no-issue` proposal, complete capability delta, design, tasks and full assessment; generate `assessment.json` with `node openspec/scripts/generate-assessment.mjs --change closes-no-issue`. Verify `openspec validate closes-no-issue --strict`, generated-assessment `--check`, and `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change closes-no-issue` pass before committing planning artifacts only.

## 2. Cleaner Implementation and Behavioral Proof

- [ ] 2.1 Implement `neutralizeClosingKeywords` through `cleanSection`, selected `cleanChangelog` sections and `cleanPullRequestBody`; preserve links and other suffix bytes and persist keyword-only content changes via CLI writes and verified REST PATCHes even with zero duplicates. Verify section/snippet/targeted/idempotency, CLI-write and mocked-description behavior in the existing test file.
- [ ] 2.2 Extend `ENTRY_REGEX` to accept `closes|refs` with existing multiple-reference grammar, excluding either suffix from subject grouping. Verify a refs entry de-duplicates against its merge twin while distinct non-merge identical subjects, intermediate commits and non-commit entries remain preserved.
- [ ] 2.3 Harden `checkChangelog`, ordinary `--check`, `verifyChangelogSectionClean` and `verifyEventDescriptionClean` / `checkReleaseRange` against closing keywords in original selected input; fail closed naming the entry or line, including description text outside commit bullets. Verify dirty section/description failure independently, refs success, unchanged-version skip and no check-mode writes or REST calls.
- [ ] 2.4 Add behavioral regression coverage through existing exports and actual check-mode subprocess commands in `.github/scripts/clean-release-changelog.test.mjs`. Add an external disposable identity-neutralizer control that demonstrably emits the un-neutralized directive and then fails its check command naming that entry; assert the mutation matches once. Verify all existing cleaner preservation, malformed-entry, unresolved-commit and REST error tests remain green with `node --test .github/scripts/clean-release-changelog.test.mjs`.

## 3. Integrated Validation

- [ ] 3.1 Verify the completed implementation with focused and all `.github/scripts/*.test.mjs` suites, SDK core build/typecheck and `node --check` for both ESM files, `openspec validate closes-no-issue --strict`, `openspec validate --all`, generated-assessment `--check`, final design-pattern governance and governance dual-check against baseline `af36bc0078170b29dfde385ac07a7a43095fb76b`, `make runtime-gates`, and range `git diff --check`. Confirm exactly the seven proposal files plus cleaner and tests changed; commit only cleaner, tests and ticked tasks as the second commit, and record final-HEAD exit codes, output, counts, diff and commit stats externally with a clean tree.

## Workflow follow-up

- Live regeneration and `closedByPullRequestsReferences` removal are owner/mainline integration observations, not exercised or claimed by the local no-push run.
- Fold #751 and archive #754 are later, separate tickets and PRs; do not edit canonical specs or archive this change here.
