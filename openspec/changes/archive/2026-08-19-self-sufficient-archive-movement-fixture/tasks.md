## 1. Proposal validation

- [x] 1.1 Record why the control cannot stay on a borrowed fixture and why it cannot grow `mutations.test.mjs` in place, and validate the change before the proposal commit — `proposal.md` records both causes (`e5b5814` is the previous repoint; the `codescene delta` file-level rules reject growth in place), and `check-design-pattern-governance.mjs --phase assessment --change self-sufficient-archive-movement-fixture`, `openspec validate self-sufficient-archive-movement-fixture --strict`, and `openspec validate --all --strict` passed before proposal commit P = `5a84789f63c0a45626001960df3264ff6ac47d52`

## 2. Implementation

- [x] 2.1 Move the control into `tests/verification/archive-movement-unrelated-change.test.mjs` with a self-seeding fixture committed inside the disposable clone, a tracked-at-HEAD seed guard, and a same-fixture null arm — technical commit T = `c944fed04d7373a2b7545f4f404cffe57dbd5fad` adds the suite (111 lines); its two arms pass: the deletion arm reports `archive-movement-unrelated-change-deletion` and the same-fixture null arm reports its absence

- [x] 2.2 Remove the relocated control from `mutations.test.mjs` (nine lines and one test), leaving its neighbours on the exact-movement fixture untouched — T deletes ten lines (the nine-line control plus its separator blank); `mutations.test.mjs` passes 74/74

- [x] 2.3 Confirm no edit to `scripts/check-changed-paths.mjs`, its classification rules, or any diagnostic id — the diff of T touches only the two test files; `grep -rn correct-local-instruction-verification-premise packages/security-audit-sdk-core openspec/tests` returns no matches at T

## 3. Verification

- [x] 3.1 Run the two suites in isolation, the full SDK validation chain with an empty index, the contract chain, strict OpenSpec validation, and the design-pattern governance final phase and dual check; all green — SDK `validate` 20/20 gates (verification 203/203), contract `validate` 14/14, `openspec validate --all --strict` 7/7, governance final phase green and dual check agreeing at checker blob `13cd54e26afa`, governance suite 196/196; required CI on PR #179 all green including `codescene delta`

## 4. Review and merge (human-owned)

- [x] 4.1 Independent technical review of the exact implementation commit — the owner reviewed and manually merged PR #179 at T; GitHub records no separate review object, consistent with PRs #176 and #178 in this repository

- [x] 4.2 Owner explicit exact-commit decision recorded on the review — the owner's merge of PR #179 is the recorded decision on exact commit T

- [x] 4.3 Owner identity-preserving merge; required CI green — merge M = `0aee52270089b8e5c803ffebfb8f238a62e79abc` (parents: prior mainline `2b9b2297e3665b6f513eb9f85b522f556e61f24b` + branch tip T), merged by `nandohdc` with all required checks green

## 5. Archive

- [x] 5.1 Archive this change as a pure relocation with `archive-evidence.md`; no signed governance record, by design — this commit moves the change byte-for-byte into the dated archive; `assessment.json`, `proposal.md`, and `.openspec.yaml` keep their active-path blobs, no `openspec/specs/` path is touched, and the archive commit hash is reported after storage, not self-bound
