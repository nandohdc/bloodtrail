Core couples directly to host-specific Node primitives (`node:crypto` in `src/providers.ts`, `node:async_hooks` in `src/context.ts`), host globals (`Buffer.byteLength` in `src/errors.ts` and `src/validation/prohibited.ts`, `setTimeout`/`clearTimeout` with `unref()` in `src/sdk.ts`), and a standalone CommonJS validator artifact (`src/generated/schema-validator.generated.cjs` using `module`). This change moves platform capabilities behind Service Provider Interfaces (SPIs) while preserving all audit semantics, catalog rules, authority invariants, and ambient-context abstractions in a platform-neutral Core.

## Why

The architecture mandates a strict layering: normative contract → semantic core → platform binding → delivery → collector (PLAN-001). Direct coupling to Node-specific modules, host globals, CommonJS loaders, and Node engine constraints prevents the Core SDK from being embedded in non-Node environments (such as browsers, Deno, edge runtimes, or mobile hosts) without dragging Node runtime assumptions along (PLAN-014).

Now that prerequisite governance is complete — #76 (contract-version policy), #78 (authority-scope formalization under Option C), #83 (standalone repository topology), and #71 (static platform-coupling detection) — Core can be extracted into a platform-neutral package with zero Node imports, zero host globals, zero undeclared runtime dependencies, and no Node engines constraint, validated against Node and a paper second consumer.

## What Changes

- **Define `PlatformProvider` SPI**: Extract identifiers, clock, byte length, timers (with optional `unref` capability), and schema runtime behind Core provider interfaces (PLAN-045).
- **Define `ContextProvider` SPI**: Abstract ambient execution context behind an SPI (`ContextProvider`) while retaining the brand registry, brand kinds, and authority validation in Core (PLAN-016). Node supplies `AsyncLocalStorage`; other runtimes supply explicit or host-native context.
- **Eliminate Node built-in imports from Core**: Remove `import { randomUUID } from "node:crypto"` from `src/providers.ts` and `import { AsyncLocalStorage } from "node:async_hooks"` from `src/context.ts`. Core defines interfaces and accepts configured providers.
- **Eliminate Node globals from Core**: Replace direct `Buffer.byteLength` invocations in `src/errors.ts` and `src/validation/prohibited.ts` with the platform byte length SPI, backed by a standard `TextEncoder` fallback.
- **Decouple schema runtime**: Place event schema validation behind an `AuditSchemaRuntime` SPI so Core has no CommonJS loader dependency and does not reference the CommonJS `module` global.
- **Make timer unreferencing optional**: Core's timer management treats handle unreferencing (`unref()`) as an optional capability with observable degradation, preventing idle process retention where supported while avoiding assumptions on non-Node hosts.
- **Prove single-copy Core invariant**: Under settled Option C (ADR 0010), Core resolves to exactly one module instance in any supported consumer graph. Prove this with a duplicate-Core fixture that fails closed before sink handoff and a matching null control.
- **Rescope dependency gate**: Rescope `check-dependencies.mjs` and `check-coherence.mjs` from "empty dependencies" to "no third-party runtime dependencies", allowing first-party bindings to declare Core as a runtime dependency while strictly rejecting third-party dependencies.
- **Add paper second consumer**: Add a compile-only, types-only paper second consumer representing a non-Node host (e.g. browser/Deno) and prove Core compiles cleanly against it under `test:types` without weakening types.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Add observable requirements for the platform-neutral Core foundation: the `PlatformProvider` SPI (IDs, clock, byte length, timers with optional `unref`, schema runtime), the `ContextProvider` SPI (ambient context abstraction with nested isolation and cleanup), the single-copy Core invariant (fail-closed cross-copy rejection proved with duplicate-Core fixture and null control), and the zero-host-coupling Core boundary (no Node imports, no Node globals, no third-party runtime dependencies, verified against a typecheck-only paper second consumer).

## Impact

- **Affected code**: `packages/security-audit-sdk-core/src/providers.ts`, `src/context.ts`, `src/errors.ts`, `src/validation/prohibited.ts`, `src/sdk.ts`, `src/config.ts`, `scripts/platform-coupling-policy.mjs`, `scripts/check-dependencies.mjs`, `scripts/check-coherence.mjs`, `compatibility.json`, and the test suites.
- **Pinned constants**: Catalog event count (24) and named event API count (24) remain unchanged. Authority brand constructor count (35) and brand kind count (19) remain unchanged.
- **Design-pattern governance**: Full assessment with all 15 security dimensions justified.
- **Out of scope**: No transport, collector, storage, browser runtime package, or production integration is authorized.
