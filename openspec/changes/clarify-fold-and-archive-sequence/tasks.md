## 1. Planning and Governance Assessment

- [x] 1.1 Create OpenSpec change `clarify-fold-and-archive-sequence` with proposal, design, and tasks.
- [x] 1.2 Formulate design-pattern governance assessment for `clarify-fold-and-archive-sequence`.

## 2. Documentation Updates

- [ ] 2.1 Update line 26 of `CONTRIBUTING.md` to split folding deltas and archiving into two separate steps.
- [ ] 2.2 Add detailed explanation of the two-PR sequence, `owned_paths` rule, and idempotence check in `CONTRIBUTING.md`.

## 3. Verification and Governance Checks

- [ ] 3.1 Validate OpenSpec changes with `npx --yes @fission-ai/openspec@latest validate --all --strict`.
- [ ] 3.2 Run design-pattern governance checker and verify zero policy violations.
- [ ] 3.3 Verify git cleanliness and formatting via `git diff --check`.
