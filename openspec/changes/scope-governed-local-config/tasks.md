## 1. Planning and Governance Assessment

- [x] 1.1 Create OpenSpec change `scope-governed-local-config` with proposal, design, and tasks.
- [ ] 1.2 Formulate design-pattern governance assessment for `scope-governed-local-config`.

## 2. Implementation and Documentation Updates

- [ ] 2.1 Update `governedLocalConfig()` in `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` to filter `branch.*` entries and sort deterministically.
- [ ] 2.2 Add unit test in `mutations.test.mjs` verifying that `governedLocalConfig()` ignores concurrent branch configuration keys.
- [ ] 2.3 Update `CLAUDE.md` with guidelines on pushing branches without `-u` from the primary checkout.

## 3. Verification and Governance Checks

- [ ] 3.1 Validate OpenSpec changes with `npx --yes @fission-ai/openspec@latest validate --all --strict`.
- [ ] 3.2 Run SDK verification tests and full validation via `npm run validate --prefix packages/security-audit-sdk-core`.
- [ ] 3.3 Run design-pattern governance checker and verify zero policy violations.
