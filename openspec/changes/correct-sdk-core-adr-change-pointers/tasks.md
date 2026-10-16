## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and abbreviated assessment for `correct-sdk-core-adr-change-pointers`. Verify `openspec validate correct-sdk-core-adr-change-pointers --strict`, `node openspec/scripts/generate-assessment.mjs --change correct-sdk-core-adr-change-pointers --check` and `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change correct-sdk-core-adr-change-pointers` pass. Evidence: all three commands exited 0 before the proposal commit; strict validation reported the change valid with zero deltas accepted under `skip_specs`, assessment drift found no difference, and assessment-phase governance reported enforcement active.

## 2. Repoint the ADRs

- [ ] 2.1 Repoint line 6 of ADR-SDK-013 to 017 at their archived owning change directories, preserving the label and backticks.
- [ ] 2.2 Confirm each new pointer resolves to an existing archived change directory at the baseline and that no other ADR line or byte changed.

## 3. Verify

- [ ] 3.1 Run the complete TEST_CMD chain: SDK-core generated artifacts, matrix, coherence, changed paths, strict OpenSpec validation, assessment drift, assessment phase, pinned final phase, empty-index Git checks and `make test`.

## 4. Archive

- [ ] 4.1 After the implementation merges, archive `correct-sdk-core-adr-change-pointers` in a separate pull request.
