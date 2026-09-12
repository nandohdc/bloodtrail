## 1. Implement shared helper module

- [ ] 1.1 Create `packages/security-audit-sdk-core/tests/verification/mutation-build.mjs` exporting `MUTATION_TIMEOUT_MS`, `assertSubprocessSuccess`, `runMutationStep`, and `buildAndCompileMutation`.
- [ ] 1.2 Implement explicit timeout diagnostic formatting in `assertSubprocessSuccess` when `result.error?.code === "ETIMEDOUT"` or `result.status === null && result.signal`.
- [ ] 1.3 Record the derivation of `MUTATION_TIMEOUT_MS` (~4.8s baseline * ~35x margin = 180,000ms) and the NO RETRY policy decision in the module header.

## 2. Implement mechanical controls

- [ ] 2.1 Create `packages/security-audit-sdk-core/tests/verification/mutation-build-diagnostics.test.mjs`.
- [ ] 2.2 Add control test asserting that simulated and real timeouts fail with signal, duration, and cgroup note, without "did not build" or "failed with exit code".
- [ ] 2.3 Add control test asserting that non-zero exit codes fail with status code and compiler output without timeout diagnostic.
- [ ] 2.4 Add control test asserting that status 0 passes cleanly.

## 3. Refactor mutation test suites

- [ ] 3.1 Refactor `packages/security-audit-sdk-core/tests/verification/f07-mutations.test.mjs` to use `buildAndCompileMutation`.
- [ ] 3.2 Refactor `packages/security-audit-sdk-core/tests/verification/f08-mutations.test.mjs` to use `buildAndCompileMutation`.
- [ ] 3.3 Refactor `packages/security-audit-sdk-core/tests/verification/f10-mutations.test.mjs` to use `buildAndCompileMutation`.
- [ ] 3.4 Refactor `packages/security-audit-sdk-core/tests/verification/f11-mutations.test.mjs` to use `buildAndCompileMutation`.

## 4. Verification and governance gates

- [ ] 4.1 Run unit and verification controls: `node --test tests/verification/mutation-build-diagnostics.test.mjs`.
- [ ] 4.2 Verify OpenSpec change conformance: `npx --yes @fission-ai/openspec@latest validate --all --strict`.
- [ ] 4.3 Verify design pattern governance: `node openspec/scripts/check-design-pattern-governance.mjs --phase final`.
- [ ] 4.4 Run full product test loop across workspaces (`make runtime-gates`).

## 5. Delivery and lifecycle completion

- [ ] 5.1 Push proposal and deliver Proposal PR for #464.
- [ ] 5.2 Implement, verify, and deliver Implementation PR for #464.
- [ ] 5.3 Archive change in dedicated Archive PR and close #464 with completion evidence.
