## Context

See `proposal.md` for motivation and the delta specification for normative requirements.

The SDK Core currently couples directly to Node runtime primitives:
1. `src/providers.ts` imports `randomUUID` from `node:crypto`.
2. `src/context.ts` imports `AsyncLocalStorage` from `node:async_hooks`.
3. `src/errors.ts` and `src/validation/prohibited.ts` invoke `Buffer.byteLength(..., "utf8")`.
4. `src/sdk.ts` invokes `setTimeout`/`clearTimeout` and accesses `handle.unref()`.
5. `src/generated/schema-validator.generated.cjs` is a CommonJS artifact accessing the `module` wrapper global.
6. `package.json` declares an explicit Node `engines` constraint (`>=24 <25 || >=26 <27`).

The coupling policy instrument (`packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs`) already detects and reports all host couplings and module specifiers. Prerequisite issues #76 (contract-version policy), #78 (authority scope formalization), #83 (repository topology), and #71 (static platform-coupling detection) are closed. Settled Option C from ADR 0010 establishes that Core relies on a single-copy invariant in consumer graphs to preserve the module-private `WeakMap` authority registry without requiring cross-package brand coordination.

## Goals / Non-Goals

**Goals:**
- Extract all platform capabilities into clean Service Provider Interfaces (`PlatformProvider`, `ContextProvider`).
- Eliminate all Node built-in imports (`node:crypto`, `node:async_hooks`) and host globals (`Buffer`) from Core source.
- Decouple schema validation so Core does not require a CommonJS loader.
- Treat timer handle unreferencing (`unref()`) as an optional capability with graceful degradation.
- Prove single-copy Core invariant via an automated duplicate-Core fixture and matching null control.
- Rescope the dependency gate to allow first-party runtime dependencies while strictly prohibiting third-party dependencies.
- Validate neutrality by compiling a types-only paper second consumer against Core under `test:types`.
- Preserve all 24 catalog event APIs, 35 brand constructors, 19 brand kinds, and existing audit semantics without drift.

**Non-Goals:**
- No implementation of `packages/security-audit-sdk-node` (that is owned by downstream issue #87).
- No modification of the canonical contract or generated schema files in `contracts/security-audit`.
- No introduction of transport, collector, storage, browser runtime packages, or production integration.
- No loosening of authority validation: branded values remain strictly forge-resistant and bound to module-copy scope.

## Decisions

### D1 — Platform capabilities mediated by `PlatformProvider` SPI

The five host capabilities identified by PLAN-045 are unified under provider interfaces:
- `AuditClock`: returns current time (`now(): Date`).
- `AuditIdentifierProvider`: generates cryptographic random IDs for events, operations, correlation, etc.
- `AuditByteLengthProvider`: measures UTF-8 string byte length (`byteLength(s: string): number`), with Core providing a standard `new TextEncoder().encode(s).length` fallback when no host provider is configured.
- `AuditTimerProvider`: schedules timeouts with optional `unref` capability.
- `AuditSchemaRuntime`: validates canonical event structures (`validate(event: unknown): AuditResult<void>`).

The rejected alternative is an ESM generator rewrite for the 248 KB standalone validator. Rewriting the code generator touches the contract workspace and generator pipeline; an SPI isolates the CommonJS artifact to host bindings without touching the contract generator.

### D2 — Ambient context mediated by `ContextProvider` SPI

`src/context.ts` is split into:
1. Core authority structures: the `WeakMap` brand registry, the 19 `AuditBrandKind` definitions, the 35 brand constructors, and brand verification functions stay in Core.
2. Context abstraction: `ContextProvider` SPI (`run<R>(context: AuditContext, fn: () => R): R; get(): AuditContext | undefined`).
Node bindings implement this SPI using `AsyncLocalStorage`; non-Node bindings use explicit or host-native context.

The rejected alternative is removing ambient context entirely. That would force every event builder to accept an explicit context parameter, breaking all 24 named event APIs and consumer ergonomics.

### D3 — Optional `unref()` timer handle capability

Core's timer provider represents `unref()` as an optional method on scheduled handles. When present (as in Node), it is called to avoid retaining idle processes during shutdown drain. When absent (as in standard browser/web workers), Core proceeds without error and records the capability status.

The rejected alternative is assuming `unref()` exists or shimming it with a no-op global. Explicit degradation preserves transparency.

### D4 — Single-copy Core invariant proven by duplicate-Core fixture

Under Option C (ADR 0010), Core resolves to exactly one module instance in any supported consumer graph. To verify this property fails closed if violated:
- An automated fixture creates two distinct installed copies of Core in an isolated `mkdtemp` tree.
- A branded context from copy A is passed to an SDK instance in copy B, proving it is rejected with `AUTHORITY_ESCALATION`.
- A matching null control verifies that when Core is properly deduplicated into a single instance, execution succeeds.

The rejected alternative is a global `globalThis` registry fallback. A global registry creates an ambient reachability vector that defeats module-copy forge resistance.

### D5 — Rescope dependency gate to "no third-party runtime dependencies"

`check-dependencies.mjs` and `check-coherence.mjs` are updated from checking `dependencies === {}` to checking that all declared runtime dependencies match an explicit first-party allowlist (`@bloodtrail/*`). Any third-party dependency remains strictly prohibited.

The rejected alternative is removing the dependency check entirely. A strict first-party allowlist prevents accidental external dependencies while allowing the Node binding to depend on Core.

### D6 — Paper second consumer as types-only compile target

To verify that Core is truly platform-neutral without building a premature production host package, a paper second consumer is created under `tests/fixtures/paper-consumer/`. It implements `PlatformProvider` and `ContextProvider` using hypothetical non-Node primitives (e.g. Web Crypto `crypto.randomUUID()`, `TextEncoder`, standard `setTimeout`, and explicit context stack) as TypeScript types only, and is compiled via `tsc --noEmit` under `test:types`.

The rejected alternative is a superficial mock test in the Node test suite, which does not prove type compatibility under non-Node compile targets.

### D7 — Preserved constants and counts

The following counts are asserted before and after extraction and must remain exact:
- Catalog event count: 24
- Named event APIs: 24
- Brand constructors: 35
- Brand kinds: 19

## Migration Plan

1. Land the complete proposal packet (`proposal.md`, `specs/security-audit-sdk-core/spec.md`, `design.md`, `tasks.md`, `assessment.json`) in a proposal PR.
2. Run RED measurements: prove current Node coupling via `test:scope` and prove paper second consumer fails against unmodified Core.
3. GREEN implementation: introduce SPI interfaces, refactor `providers.ts`, `context.ts`, `errors.ts`, `validation/prohibited.ts`, and `sdk.ts`.
4. Run verification: coupling policy passes with zero Node imports/globals, duplicate-Core fixture passes, paper consumer compiles cleanly, and all 19 SDK validation gates pass.
5. Canonical fold: fold delta spec into `openspec/specs/security-audit-sdk-core/spec.md`.
6. Archive change in a byte-preserving relocation commit.

## Risks / Trade-offs

- **[Schema runtime interface leaking Ajv types]** → Core defines clean domain-specific validation result types (`AuditResult<void>`); no Ajv internal classes or error objects are exposed in Core's public API.
- **[Performance of byte length calculation]** → Benchmarks show `TextEncoder.encode(s).length` takes ~0.18 µs per operation. In Node, the binding can supply `Buffer.byteLength` (~0.025 µs); Core's fallback ensures portability.
- **[Timer unref absence on web hosts]** → Explicit capability check prevents runtime exceptions while documenting the degradation behavior.
- **[Accidental duplicate-Core in consumer graph]** → Option C fails closed on duplicate Core instances; the duplicate-Core fixture and diagnostic guide consumers to deduplicate.
