## 1. Implement shared helper module

- [x] 1.1 Create `packages/security-audit-sdk-core/tests/verification/mutation-build.mjs` exporting `MUTATION_TIMEOUT_MS`, `assertSubprocessSuccess`, `runMutationStep`, and `buildAndCompileMutation`. — Created and verified.
- [x] 1.2 Implement explicit timeout diagnostic formatting in `assertSubprocessSuccess` when `result.error?.code === "ETIMEDOUT"` or `result.status === null && result.signal`. — Implemented with signal, elapsed duration, timeout limit, and #306 cgroup context.
- [x] 1.3 Record the derivation of `MUTATION_TIMEOUT_MS` (~4.8s baseline * ~35x margin = 180,000ms) and the NO RETRY policy decision in the module header. — Documented and recorded in header.

## 2. Implement mechanical controls

- [x] 2.1 Create `packages/security-audit-sdk-core/tests/verification/mutation-build-diagnostics.test.mjs`. — Created with 7 controls.
- [x] 2.2 Add control test asserting that simulated and real timeouts fail with signal, duration, and cgroup note, without "did not build" or "failed with exit code". — Tested and passing.
- [x] 2.3 Add control test asserting that non-zero exit codes fail with status code and compiler output without timeout diagnostic. — Tested and passing.
- [x] 2.4 Add control test asserting that status 0 passes cleanly. — Tested and passing.

## 3. Refactor mutation test suites

- [x] 3.1 Refactor `packages/security-audit-sdk-core/tests/verification/f07-mutations.test.mjs` to use `buildAndCompileMutation`. — Refactored, all 4 mutations pass.
- [x] 3.2 Refactor `packages/security-audit-sdk-core/tests/verification/f08-mutations.test.mjs` to use `buildAndCompileMutation`. — Refactored.
- [x] 3.3 Refactor `packages/security-audit-sdk-core/tests/verification/f10-mutations.test.mjs` to use `buildAndCompileMutation`. — Refactored.
- [x] 3.4 Refactor `packages/security-audit-sdk-core/tests/verification/f11-mutations.test.mjs` to use `buildAndCompileMutation`. — Refactored.

## 4. Verification and governance gates

- [x] 4.1 Run unit and verification controls: `node --test tests/verification/mutation-build-diagnostics.test.mjs`. — All 7 tests passing.
- [x] 4.2 Verify OpenSpec change conformance: `npx --yes @fission-ai/openspec@latest validate --all --strict`. — 15 passed, 0 failed.
- [x] 4.3 Verify design pattern governance: `node openspec/scripts/check-design-pattern-governance.mjs --phase final`. — Passed in final phase, 1 commit inspected.
- [x] 4.4 Run full product test loop across workspaces (`make runtime-gates`). — All 5 workspaces passed cleanly.

## 5. Delivery and lifecycle completion

- [x] 5.1 Push proposal and deliver Proposal PR for #464. — Landed in PR #505 (merge commit 8c26aee076307ea222befc9a0f8b2fac25d50ef5).
- [x] 5.2 Implement, verify, and deliver Implementation PR for #464. — Landed in PR #506 (merge commit 8e48ab18bb080a1c9a66b02dd4dc382aceff1777).
- [x] 5.3 Archive change in dedicated Archive PR and close #464 with completion evidence. — Archived to 2026-09-12-distinguish-mutation-build-timeouts.
