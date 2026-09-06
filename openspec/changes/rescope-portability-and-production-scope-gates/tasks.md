## 1. Scope Gate for security-audit-sdk-node

- [ ] 1.1 Implement `packages/security-audit-sdk-node/scripts/platform-coupling-policy.mjs` defining approved builtins (`node:async_hooks`, `node:buffer`, `node:crypto`, `node:timers`) and Core dependency
- [ ] 1.2 Implement `packages/security-audit-sdk-node/scripts/check-scope.mjs` enforcing AST platform coupling and forbidden production integration surfaces
- [ ] 1.3 Add `test:scope` script to `packages/security-audit-sdk-node/package.json` and include in `validate` chain

## 2. Core Platform Neutrality Hardening

- [ ] 2.1 Tighten `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs` runtime builtins from `["node:async_hooks", "node:crypto"]` to `[]`
- [ ] 2.2 Update `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs` to reflect zero runtime builtins in Core shipped artifacts

## 3. Cross-Package Placement Mutations & Verification Controls

- [ ] 3.1 Implement `packages/security-audit-sdk-node/tests/scope-mutations.test.ts` testing approved capabilities, unapproved builtins, host globals, evasion, forbidden filenames, and transport/browser placement
- [ ] 3.2 Add cross-package placement mutations in `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs` proving moving Node binding code and transport/collector code to Core fails closed

## 4. Verification and Governance

- [ ] 4.1 Run `npm run validate --prefix packages/security-audit-sdk-node` including `test:scope` and `scope-mutations.test.ts`
- [ ] 4.2 Run `npm run test:matrix --prefix packages/security-audit-sdk-core` and verification mutation tests
- [ ] 4.3 Run fast product loop `make test` across all four workspaces
- [ ] 4.4 Verify governance checks with `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` and dual checker
