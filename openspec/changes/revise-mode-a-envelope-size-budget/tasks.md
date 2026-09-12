## 1. Specification & Decision Record

- [x] 1.1 Document decision #498 revising the L1 serialized envelope size budget threshold from ≤ 256 B to ≤ 384 B in `decisions/498-revise-l1-size-budget.md` under delegated authority.
- [x] 1.2 Formulate delta specification in `specs/client-evidence/spec.md` updating requirement `A Mode A proof of concept decides whether the wave continues` and adding scenario `Mode A envelope meets the revised L1 size budget`.
- [x] 1.3 Update Mode A proof of concept harness `harness/mode-a-poc.mjs` and execute 1,112-interaction synthetic workload to generate `harness/mode-a-run-2.json` and `harness/mode-a-evidence.md` confirming recommendation `GO`.

## 2. Browser SDK Regression Coverage

- [x] 2.1 Add unit test in `packages/client-evidence-browser/tests/browser.test.ts` asserting that Mode A serialized envelopes across all 8 approved interaction kinds with 64-character hex nonces satisfy the L1 budget of ≤ 384 bytes.
- [x] 2.2 Verify that `npm test --prefix packages/client-evidence-browser` passes cleanly with the new L1 budget test.
- [x] 2.3 Verify repository runtime gates with `make runtime-gates`.

## 3. Specification Fold & Change Archive

- [ ] 3.1 Fold the revised requirement and scenario from `specs/client-evidence/spec.md` into canonical specification `openspec/specs/client-evidence/spec.md`.
- [ ] 3.2 Relocate active change `openspec/changes/revise-mode-a-envelope-size-budget/` to `openspec/changes/archive/2026-09-12-revise-mode-a-envelope-size-budget/`.
- [ ] 3.3 Verify full OpenSpec validation and governance checks pass (`npx --yes @fission-ai/openspec@latest validate --all --strict` and `node openspec/scripts/check-design-pattern-governance.mjs --phase final`).
