# Proposal — rescope-portability-and-production-scope-gates

Apply platform neutrality to Core and approved Node coupling to sdk-node.

## Why

Following the extraction of platform-neutral Core (#86) and provisional Node binding (#87), the existing single-package scope gate would miss moved files or reject legitimate binding code.

Specifically:
- Core must enforce complete platform neutrality with zero host globals and zero host built-ins or platform specifiers in authored code and shipped runtime artifacts.
- `packages/security-audit-sdk-node` currently lacks an AST-based scope gate, platform coupling policy, and scope test target, leaving it unverified against undeclared host globals, unapproved Node built-ins, or forbidden production integrations.
- Cross-package placement mutations are required to prove that moving Node-coupled code into Core fails closed, and moving transport, browser, or collector code into either SDK package fails closed.

Traceability: PLAN-015, PLAN-048.

## What Changes

- **Define AST-based scope gate for `security-audit-sdk-node`**:
  - Implement `scripts/platform-coupling-policy.mjs` declaring approved built-ins (`node:async_hooks`, `node:buffer`, `node:crypto`, `node:timers`) and Core dependency (`@bloodtrail/security-audit-sdk-core`).
  - Implement `scripts/check-scope.mjs` verifying authored sources against language globals, approved specifiers, and forbidden production integration names/exports.
  - Wire `test:scope` into `package.json` scripts and `validate` chain.
- **Harden Core platform neutrality**:
  - Tighten `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs` runtime built-ins from `["node:async_hooks", "node:crypto"]` to `[]`.
  - Update `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs` to assert zero runtime built-ins in shipped artifacts.
- **Add cross-package placement mutations**:
  - Implement `packages/security-audit-sdk-node/tests/scope-mutations.test.ts` covering positive controls, unapproved built-ins, undeclared globals, dynamic evasion, forbidden filenames, and transport/browser placement.
  - Add cross-package placement mutations in `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs` proving moving Node binding code into Core fails closed.

## Capabilities

- `security-audit-sdk-node`: Add AST-based scope verification restricting platform coupling to approved Node capabilities (`node:async_hooks`, `node:buffer`, `node:crypto`, `node:timers`) and `@bloodtrail/security-audit-sdk-core`, rejecting unapproved built-ins, host globals, and production integrations.
- `security-audit-sdk-core`: Re-scope Core platform neutrality to reject all Node binding code and assert zero host built-ins in shipped runtime artifacts.

## Impact

- Affected code:
  - `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs`
  - `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs`
  - `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs`
  - `packages/security-audit-sdk-node/package.json`
  - `packages/security-audit-sdk-node/scripts/check-scope.mjs`
  - `packages/security-audit-sdk-node/scripts/platform-coupling-policy.mjs`
  - `packages/security-audit-sdk-node/tests/scope-mutations.test.ts`
- Zero third-party runtime dependencies introduced.
- Standalone multi-package repository topology preserved.
- Out of scope: No new runtime capabilities, browser runtime package, transport implementation, or production instrumentation.
