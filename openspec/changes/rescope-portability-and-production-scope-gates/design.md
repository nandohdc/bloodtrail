## Context

See `proposal.md` for motivation and the delta specs under `specs/` for normative capability requirements.

In Issue #86 (`extract-platform-neutral-core`) and Issue #87 (`add-provisional-node-binding`), the monolithic SDK was split into a platform-neutral Core (`@bloodtrail/security-audit-sdk-core`) and a provisional Node binding (`@bloodtrail/security-audit-sdk-node`).

Prior to the split, `packages/security-audit-sdk-core` implemented an AST-based scope gate (`scripts/check-scope.mjs` and `scripts/platform-coupling-policy.mjs`) guarding against undeclared host globals, unapproved specifiers, and forbidden production integration filenames per ADR 0004 and PLAN-015. However, two gaps emerged after the split:
1. Core's shipped import policy (`scripts/shipped-import-policy.mjs`) retained legacy allowances for `["node:async_hooks", "node:crypto"]` in `dist/`, even though Core's source code now contains zero Node imports.
2. `packages/security-audit-sdk-node` was created without an AST-based scope gate or platform coupling policy, relying solely on basic regexes in `scripts/check-dependencies.mjs`. It lacked negative mutation coverage and fail-closed checks against undeclared host globals or unapproved built-ins.
3. Neither package verified cross-package placement: proving that placing Node binding code into Core fails closed, and placing transport, browser, or collector code into either SDK package fails closed (PLAN-048).

## Goals / Non-Goals

**Goals:**
- Provide `packages/security-audit-sdk-node` with an AST-based scope gate (`scripts/check-scope.mjs` and `scripts/platform-coupling-policy.mjs`) enforcing that only approved Node capabilities (`node:async_hooks`, `node:buffer`, `node:crypto`, `node:timers`) and first-party SDK Core are imported, with zero undeclared host globals.
- Harden `@bloodtrail/security-audit-sdk-core` to reject all Node built-ins in shipped runtime artifacts and reject any Node binding code placed in Core source.
- Add negative placement mutations in both packages proving fail-closed rejection when Node binding code is moved into Core, or transport/browser/collector code is moved into either package.
- Wire `test:scope` into `packages/security-audit-sdk-node/package.json` and its `validate` script.

**Non-Goals:**
- No new runtime capabilities or API changes.
- No third-party runtime dependencies.
- No browser evidence SDK implementation (deferred to #124).
- No production transport, exporter, or collector implementations.

## Decisions

### D1 — Dedicated AST-Based Scope Gate for sdk-node
Implement `packages/security-audit-sdk-node/scripts/platform-coupling-policy.mjs` and `packages/security-audit-sdk-node/scripts/check-scope.mjs`. Following the proven pattern in Core (ADR 0004), the gate:
1. Scans every source file under `src/` using `ts.createSourceFile` to extract all free value identifiers and module specifiers.
2. Verifies that all free identifiers are members of standard `LANGUAGE_GLOBALS` (with `globalThis`, `eval`, and `Function` strictly banned).
3. Verifies that all module specifiers are relative imports, approved Node built-ins, or `@bloodtrail/security-audit-sdk-core`.
4. Enforces forbidden production integration filename regex (rejecting `transport`, `collector`, `browser`, `adapter`, `telemetry`, etc.).
5. Verifies `package.json` dependency constraints (no third-party runtime dependencies; `optionalDependencies` and `peerDependencies` empty; no forbidden exports).
6. Fails closed with bounded diagnostics and reports inventory on success.

*Alternatives considered:*
- Regex-only scanning: Rejected per PLAN-015; easily evaded by string concatenation and generates false positives from comments.
- Shared single script across packages: Rejected; packages maintain standalone independence per ADR 0009 and have diametrically opposed platform coupling rules (Core forbids all Node built-ins; sdk-node permits approved ones).

### D2 — Explicit Approved Node Capability Set
`packages/security-audit-sdk-node` declares an explicit set of approved Node built-in modules:
- `node:async_hooks` (for `AsyncLocalStorage` ambient context)
- `node:buffer` (for UTF-8 `Buffer.byteLength`)
- `node:crypto` (for `randomUUID` identifier generation)
- `node:timers` (for `setTimeout` and `clearTimeout` with `unref()`)

Any other Node built-in (such as `node:fs`, `node:http`, `node:net`, `node:child_process`, `node:worker_threads`) is classified as `undeclared-specifier` and fails closed. Host globals like bare `process`, `window`, or `document` are classified as `undeclared-global` and fail closed.

### D3 — Core Platform Neutrality Hardening
In `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs`:
- Set `roles.runtime.builtins: []`.
- Update `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs` to prove that `dist/` rejects all Node built-ins (including `node:crypto` and `node:async_hooks`).

### D4 — Cross-Package Placement Mutations
Add mutation tests in both packages:
1. In `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs`:
   - Verify that moving Node binding code (importing `node:buffer`, `node:async_hooks`, `node:crypto`, `node:timers`) into Core `src/` fails closed with `undeclared-specifier`.
   - Verify that moving transport, collector, or browser code into Core fails closed.
2. In `packages/security-audit-sdk-node/tests/scope-mutations.test.ts`:
   - Verify unmutated package passes.
   - Verify approved built-ins pass.
   - Verify unapproved built-ins (`node:fs`, `node:http`) fail closed.
   - Verify third-party specifiers (`kafkajs`, `redis`) fail closed.
   - Verify undeclared host globals (`process`, `window`) fail closed.
   - Verify dynamic global evasion (`globalThis`, `eval`, `Function`) fails closed.
   - Verify forbidden integration filenames (`transport.ts`, `collector.ts`, `browser.ts`) fail closed.
   - Verify forbidden manifest exports fail closed.

## Risks / Trade-offs

- [Risk: Scope gate execution time slows down `validate` loop] → Mitigation: AST parsing over 8 small source files takes <100ms.
- [Risk: Inadvertent breaking of Core tests when zeroing runtime built-ins] → Mitigation: Core `src/` and `dist/` already have zero Node built-ins; only the synthetic test fixture in `shipped-import-policy.test.mjs` needs realignment to test examples/ instead of dist/ for allowed built-ins.

## Migration Plan

1. Propose change `rescope-portability-and-production-scope-gates` with full OpenSpec assessment and delta specs.
2. Implement scope gate scripts and policies in `packages/security-audit-sdk-node`.
3. Harden Core shipped import policy and test fixtures.
4. Add cross-package placement mutations in both packages.
5. Validate all workspaces locally with `make test` and `npm run validate`.
6. Open PR, verify CI green, admin merge.
7. Fold delta specs and archive change.

## Open Questions

None. The scope boundaries and SPI contracts were settled in #86 and #87.
