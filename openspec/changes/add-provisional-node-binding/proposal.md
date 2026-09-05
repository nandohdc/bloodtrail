# Proposal — add-provisional-node-binding

Provide concrete Node.js implementations for the platform-neutral Security Audit SDK Core Service Provider Interfaces (SPIs) in a dedicated first-party package: `@bloodtrail/security-audit-sdk-node`.

## Why

The Bloodtrail SDK architecture enforces strict separation between the normative contract, semantic core, platform bindings, delivery, and collectors (PLAN-001, PLAN-014). In #86 (`extract-platform-neutral-core`), all host-specific Node primitives (`node:crypto` UUIDs, `node:async_hooks` AsyncLocalStorage, `Buffer.byteLength`, `node:timers` shutdown timers, and CJS schema validation) were extracted behind platform and context provider SPIs in `@bloodtrail/security-audit-sdk-core`.

To enable Node.js applications to execute the Security Audit Core SDK, a dedicated first-party Node binding package is required (PLAN-047). This package supplies concrete implementations of all Core platform and context SPIs using standard Node built-ins, reproducing existing Node behavior and safety properties while remaining explicitly provisional and unfrozen until vertical delivery evidence is established in #111 (after #109).

## What Changes

- **Create `packages/security-audit-sdk-node`**: Standalone workspace package owning its own `package.json`, `package-lock.json`, and tsconfig, with `private: true`, `license: "UNLICENSED"`, and zero third-party runtime dependencies per ADR 0009 and PLAN-014.
- **Implement Core SPIs with Node built-ins**:
  - `AuditIdentifierProvider`: `randomUUID` from `node:crypto`.
  - `AuditClock`: `new Date()` clock provider.
  - `AuditByteLengthProvider`: `Buffer.byteLength(value, "utf8")` using `node:buffer`.
  - `AuditTimerProvider`: `setTimeout` and `clearTimeout` with handle `unref()` from `node:timers`, reproducing `shutdownTimerOwnership` without process signal handlers or intervals.
  - `ContextProvider`: `AsyncLocalStorage` from `node:async_hooks`, ensuring isolated concurrent executions, nested scope restoration, and explicit missing context handling.
  - `AuditSchemaRuntime`: wrapping the contract-generated CJS validator.
- **Export `NodePlatformProvider` and initialization helpers**: Convenience factory and provider bundles to wire Core with Node host capabilities.
- **Explicit provisional status**: Document and enforce that the package API is explicitly unfrozen per PLAN-047; freezing is deferred to #111 following vertical delivery verification (#109).
- **Comprehensive verification**:
  - Exact equivalence with Core's baseline behavior.
  - Child-process tests proving no context leakage across concurrent or nested async scopes.
  - Shutdown tests proving process exits cleanly without lingering timer handles.
  - Packed tarball installation outside any workspace root across both Node 24.2.0 and 26.5.0.
  - Shipped import policy proving only approved `node:*` built-ins and `@bloodtrail/*` first-party dependencies.

## Capabilities

### New Capabilities

- `security-audit-sdk-node`: Defines the observable behavior, SPI implementations, runtime isolation, and package boundaries of the provisional Node.js binding for the Bloodtrail Security Audit Core SDK.

### Modified Capabilities

None.

## Impact

- **Affected code**: New package `packages/security-audit-sdk-node/` containing `src/`, `tests/`, `scripts/`, `package.json`, `package-lock.json`, `tsconfig.json`, and `compatibility.json`.
- **Core SDK stability**: Zero modifications to `@bloodtrail/security-audit-sdk-core` contracts or invariants.
- **Design-pattern governance**: Full assessment covering public API and integration triggers.
- **Out of scope**: No API freeze, transport, collector, framework adapters, production instrumentation, publication, or non-Node bindings.
