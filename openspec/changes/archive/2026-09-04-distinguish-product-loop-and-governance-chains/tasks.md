## 1. Documentation Updates: Fast Product Loop vs Governance Chains

- [x] 1.1 Update `CLAUDE.md` to introduce the fast product development loop (~18s total across workspaces: SDK `test:matrix` ~15s, contracts `validate` ~1.5s, research `lint` + `test` ~15s) vs the full governance-gate chain (~291s), documenting that `test:verification` mutation testing accounts for ~254s of `validate`; verify formatting and command accuracy.
- [x] 1.2 Update `AGENTS.md` Build, Test, and Development Commands to document the product development loop alongside `validate`, clarifying the purpose and measured runtimes; verify formatting.

## 2. ADR 0011 Reconciliation

- [x] 2.1 Update `docs/adr/0011-ci-topology.md` to reconcile all occurrences of the required-context count to ten throughout (lines 71, 77, 93, 101, 127); add the `coverage` row to the required-context mapping table; clarify the resolution of #271 in line 111.

## 3. Governance Assessment & Verification

- [x] 3.1 Generate and complete `assessment.json` using `openspec/scripts/generate-assessment.mjs` for `distinguish-product-loop-and-governance-chains`; verify full assessment governance checks pass (`node openspec/scripts/check-design-pattern-governance.mjs --phase final`).
- [x] 3.2 Run OpenSpec strict validation (`npx --yes @fission-ai/openspec@latest validate --all --strict`), verify git whitespace (`git diff --check`), and verify product loop test matrix passes (`npm run test:matrix --prefix packages/security-audit-sdk-core`).
