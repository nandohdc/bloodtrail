## 1. Plan and assess the change

- [ ] 1.1 Propose change `resilient-ci-critical-path` with design, tasks, and full design-pattern assessment.

## 2. Implement audit transport retry (TDD)

- [ ] 2.1 Write unit tests in `.github/scripts/npm-audit-retry.test.mjs` verifying transport classification, recovery retry, and the null control (immediate failure on advisories).
- [ ] 2.2 Implement `.github/scripts/npm-audit-retry.mjs` to satisfy the tests with bounded retries and fast timeouts.
- [ ] 2.3 Run test suite via `node --test .github/scripts/npm-audit-retry.test.mjs` and verify all cases pass.

## 3. Update CI workflow configuration

- [ ] 3.1 Update `.github/workflows/ci.yml` so that `sonar` depends strictly on `[coverage]`.
- [ ] 3.2 Update `sdk` and `contract` audit steps in `.github/workflows/ci.yml` to use `.github/scripts/npm-audit-retry.mjs`.

## 4. Governance and verification

- [ ] 4.1 Validate OpenSpec changes with `npx --yes @fission-ai/openspec@latest validate --all --strict`.
- [ ] 4.2 Run design-pattern governance checker and dual-check against baseline.
- [ ] 4.3 Run `git diff --check` and workspace validations.
