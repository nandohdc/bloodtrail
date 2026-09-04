## 1. Tooling Implementation

- [ ] 1.1 Create `openspec/scripts/generate-assessment.mjs` supporting `--scaffold`, assessment generation from `assessment.source.json`, and `--check` drift assertion; verify CLI argument parsing and error handling
- [ ] 1.2 Implement deterministic derivation of mechanical fields (`schema_version`, `change_id`, `applicability`, `ordering`, `verification_task_ids`, 15 dimension justifications for `security_sensitive: false`) and stable JSON emission; verify formatting matches repository standards

## 2. Test Coverage & Integration

- [ ] 2.1 Add comprehensive test suite in `openspec/tests/design-pattern-governance/assessment-generation.test.mjs` verifying scaffolding, generation, schema compliance under `assessment.schema.json`, and byte-for-byte drift detection
- [ ] 2.2 Exercise `generate-assessment.mjs` on `generate-assessment-scaffolding` using `assessment.source.json` to emit its own `assessment.json`; verify `generate-assessment.mjs --check` passes
- [ ] 2.3 Run full governance validation battery (`openspec validate`, `check-design-pattern-governance.mjs --phase final`, `run-governance-dual-check.mjs --base origin/main`, and `node --test openspec/tests/design-pattern-governance/*.test.mjs`)
