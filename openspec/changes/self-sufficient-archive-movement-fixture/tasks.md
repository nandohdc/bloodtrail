## 1. Proposal validation

- [x] 1.1 Record why the control cannot stay on a borrowed fixture and why it cannot grow `mutations.test.mjs` in place, and validate the change before the proposal commit — `proposal.md` records both causes (`e5b5814` is the previous repoint; the `codescene delta` file-level rules reject growth in place), and `check-design-pattern-governance.mjs --phase assessment --change self-sufficient-archive-movement-fixture`, `openspec validate self-sufficient-archive-movement-fixture --strict`, and `openspec validate --all --strict` pass.

## 2. Implementation

- [ ] 2.1 Move the control into `tests/verification/archive-movement-unrelated-change.test.mjs` with a self-seeding fixture committed inside the disposable clone, a tracked-at-HEAD seed guard, and a same-fixture null arm.
- [ ] 2.2 Remove the relocated control from `mutations.test.mjs` (nine lines and one test), leaving its neighbours on the exact-movement fixture untouched.
- [ ] 2.3 Confirm no edit to `scripts/check-changed-paths.mjs`, its classification rules, or any diagnostic id — the diff touches only the two test files and this change directory.

## 3. Verification

- [ ] 3.1 Run the two suites in isolation, the full SDK validation chain with an empty index, the contract chain, strict OpenSpec validation, and the design-pattern governance final phase and dual check; all green.

## 4. Review and merge (human-owned)

- [ ] 4.1 Independent technical review of the exact implementation commit. Test success is not review.
- [ ] 4.2 Owner explicit exact-commit decision recorded on the review.
- [ ] 4.3 Owner identity-preserving merge; required CI green.

## 5. Archive

- [ ] 5.1 Archive this change as a pure relocation with `archive-evidence.md`; no signed governance record, by design.
