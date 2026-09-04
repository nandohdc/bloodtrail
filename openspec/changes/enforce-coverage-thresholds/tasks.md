## 1. Local Coverage Thresholds & Controls

- [ ] 1.1 Update `packages/security-audit-sdk-core/package.json` `test:coverage` script to include `--test-coverage-lines=95 --test-coverage-branches=65` and verify script passes.
- [ ] 1.2 Update `research/browser-telemetry/package.json` `test:coverage` script to include `--test-coverage-lines=90 --test-coverage-branches=65` and verify script passes.
- [ ] 1.3 Demonstrate null control: verify that setting a deliberate failing threshold causes the coverage script to exit with a non-zero code.

## 2. Configuration & Documentation Synchronization

- [ ] 2.1 Update `codecov.yml` header commentary to document intentional informational PR reporting alongside deterministic local/CI threshold enforcement.
- [ ] 2.2 Update `CLAUDE.md` and `docs/adr/0011-ci-topology.md` to document ten required branch protection contexts, explicitly adding `coverage`.
- [ ] 2.3 Update GitHub branch protection on `main` to require `coverage`.

## 3. Verification

- [ ] 3.1 Run full workspace validation across `packages/security-audit-sdk-core` and `research/browser-telemetry`.
- [ ] 3.2 Validate OpenSpec change with `npx --yes @fission-ai/openspec@latest validate --all --strict`.
- [ ] 3.3 Validate governance with `node openspec/scripts/check-design-pattern-governance.mjs --phase final`.
