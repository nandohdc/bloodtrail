# Tasks: Skip unowned CRA triggers for active changes

## 1. Core Implementation

- [ ] 1.1 Update `openspec/scripts/contract-reuse/check.mjs` to partition trigger paths into selected, foreign, and unattributable sets, reporting an approved skip when the selected change owns none and all triggers are uniquely owned by other changes.
- [ ] 1.2 Verify `check.mjs` syntax and basic invocation.

## 2. Test Suite & Verification

- [ ] 2.1 Update `openspec/tests/contract-reuse/checker.test.mjs` to assert that an active change owning none of the range's trigger paths produces an approved skip when another active change uniquely owns the trigger.
- [ ] 2.2 Add tests in `openspec/tests/contract-reuse/checker.test.mjs` verifying that unowned and ambiguous trigger paths continue to fail closed with `cra-trigger-unattributable`.
- [ ] 2.3 Run `node --test openspec/tests/contract-reuse/*.test.mjs` and verify all tests pass.
- [ ] 2.4 Run `node openspec/scripts/check-design-pattern-governance.mjs --phase final` and verify clean governance validation.
