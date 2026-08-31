## 1. Independent inventory registration

- [x] 1.1 Add `fix-generated-required-context-reason` to `EXPECTED_RECORD_IDS` in `packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs`; run `node --test tests/verification/governance-history-mutations.test.mjs` from the package root and verify G-00 fails at the inventory assertion naming that id, proving the inventory rejects a record the manifest does not yet hold.
- [x] 1.2 Add the `MINIMUM_REVIEWED_PATHS` entry naming `openspec/changes/fix-generated-required-context-reason`, `packages/security-audit-sdk-core/scripts`, `packages/security-audit-sdk-core/src/generated`, and `packages/security-audit-sdk-core/tests/types`; verify that set equals the changed-path set of `877d77f` by comparing it against `git show --stat --format= 877d77f`, and that no entry contains `packages/security-audit-sdk-core/verification-lifecycle.json`.

## 2. Signed governance record

- [x] 2.1 Resolve the binding inputs from history: `reviewedCommit`, the `candidateRoot` root tree, the four reviewed tree objects, `governedCommits` for the whole #217 lifecycle, `boundCommits`, and `mergeCommits`; verify every object resolves with `git cat-file -t`, every reviewed object equals `git rev-parse 877d77f:<path>`, and each declared merge's parent count matches `git rev-list --parents -n 1`.
- [x] 2.2 Add the record to `governanceRecords` in `packages/security-audit-sdk-core/verification-lifecycle.json` with `signed: true`, the reviewer block, the owner instruction quoted verbatim in `signatureDecision`, the six mandatory withheld authorizations, and assurance limitations covering the post-merge decision, the inapplicable R15 scan, the out-of-scope `64af271`, and the uncovered registration commit; verify `npm run test:governance-history --prefix packages/security-audit-sdk-core` passes and its output count rises by one record.
- [x] 2.3 Run `node --test tests/verification/governance-history-mutations.test.mjs` from the package root and verify the whole suite is green, including the G-01 and G-02 bypass controls that now cover the added record.

## 3. Verification

- [x] 3.1 Run `npm run check:generated --prefix packages/security-audit-sdk-core` before any generate step and verify no committed generated drift exists; then run `npm run validate --prefix packages/security-audit-sdk-core` and `npm run validate --prefix contracts/security-audit` and verify both chains pass on the final state.
- [x] 3.2 Run `openspec validate sign-fix-generated-required-context-reason --strict`, `openspec validate --all --strict`, and the design-pattern governance dual check; verify the assessment validates, the association covers `packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs`, and no path is reported unclassified.
- [x] 3.3 Verify the archived change is untouched: `git diff --stat main -- openspec/changes/archive/2026-08-30-fix-generated-required-context-reason` reports no change, and tasks 4.3 and 4.4 there remain unchecked with their original wording.

## 4. Delivery

- [x] 4.1 Commit the proposal artifacts, the inventory registration, and the signed record as three separate allowlisted commits in that order; verify each commit's staged path set matches its scope and that `npm run test:git --prefix packages/security-audit-sdk-core` reports an empty index afterwards.
- [x] 4.2 Open the pull request against `main`, verify its head is the record commit and its changed-path set is the three scopes above, and confirm every required check passes without treating CI, AI review, issue state, or pull-request state as approval.
- [x] 4.3 After an identity-preserving merge, confirm the record is reachable from `main` and close #217 citing the record commit; leave this task unchecked while the change is active.
