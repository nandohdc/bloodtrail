## Context

In #86 (`extract-platform-neutral-core`), `@bloodtrail/security-audit-sdk-core` was refactored into a platform-neutral Core package with all host-specific primitives decoupled behind Service Provider Interfaces (SPIs).

Issue #87 realizes the planned provisional Node.js binding (`@bloodtrail/security-audit-sdk-node`) per PLAN-014, PLAN-016, and PLAN-047. The binding implements every Core platform and context SPI using native Node.js built-in modules, reproducing existing Node behavior while maintaining standalone workspace isolation per ADR 0009.

## Goals / Non-Goals

**Goals:**
- Implement every Core platform SPI (`AuditClock`, `AuditIdentifierProvider`, `AuditByteLengthProvider`, `AuditTimerProvider`, `AuditSchemaRuntime`) and `ContextProvider` using Node.js built-ins.
- Prove exact equivalence with pre-split Node behavior through baseline differential assertions.
- Prove context isolation and zero async leakage using child-process test harnesses.
- Prove that shutdown timers unref properly and allow immediate process exit without pending handle retention.
- Enforce standalone package topology: `packages/security-audit-sdk-node` with own `package.json`, `package-lock.json`, `private: true`, `license: "UNLICENSED"`, and zero third-party runtime dependencies.
- Prove package tarball installation and import across supported Node versions (`24.2.0` and `26.5.0`) outside any workspace root.
- Document the package API as explicitly provisional and unfrozen per PLAN-047 (freezing is owned by #111 after #109).

**Non-Goals:**
- No API freeze: the public API remains provisional and may evolve until #111.
- No transports, collectors, storage, or network delivery implementations.
- No framework integrations (Express, Fastify, Nest, etc.).
- No process signal handlers (`SIGTERM`, `SIGINT`) or automatic shutdown hooks.
- No non-Node platform implementations.

## Decisions

### D1 — Core SPI to Node Implementation Mapping

| Core SPI | Node Implementation | Verification / Equivalence Test |
| --- | --- | --- |
| `AuditClock` | `nodeClock` (`new Date()`) | Asserts timestamp matches host system time and format matches ISO-8601 |
| `AuditIdentifierProvider` | `nodeIdentifiers` (`node:crypto.randomUUID()`) | Asserts RFC 4122 v4 UUID format and uniqueness across all 7 identifier kinds |
| `AuditByteLengthProvider` | `nodeByteLength` (`Buffer.byteLength(val, "utf8")`) | Compares output against Core's TextEncoder fallback across multi-byte UTF-8 inputs |
| `AuditTimerProvider` | `nodeTimers` (`node:timers` with `handle.unref()`) | Child-process test asserts process terminates cleanly with active timer |
| `ContextProvider` | `nodeContextProvider` (`node:async_hooks.AsyncLocalStorage`) | Child-process tests assert concurrent isolation and nested scope restoration |
| `AuditSchemaRuntime` | `nodeSchemaRuntime` (generated CJS validator wrapper) | Validates canonical contract positive/negative event fixtures |

### D2 — Standalone Package Topology

Per ADR 0009, `@bloodtrail/security-audit-sdk-node` lives at `packages/security-audit-sdk-node` with its own `package.json`, `package-lock.json`, `tsconfig.json`, and `compatibility.json`. It declares:
- `private: true`
- `license: "UNLICENSED"`
- `dependencies`: `{"@bloodtrail/security-audit-sdk-core": "0.1.0"}` (allowed first-party dependency)
- `engines`: `>=24 <25 || >=26 <27`

### D3 — Strict Shutdown Timer Ownership Without Signal Handlers

`shutdownTimerOwnership` specifies that timers must support `unref()`, must be cleared idempotently in a structured `finally`, and must NOT install process signal handlers (`SIGTERM`, `SIGINT`) or recurring intervals. The Node timer provider reproduces this contract directly without modifying host process signals.

### D4 — Child-Process Verification for Context Isolation and Process Exit

Unit tests in an ongoing Node process cannot verify that a timer prevented process exit or that `AsyncLocalStorage` cleaned up all handles upon exit. Verification uses spawned child processes that assert:
1. Two concurrent async operations under distinct context frames do not observe or leak data.
2. A process scheduling an unreferenced shutdown timer exits promptly with exit code 0 without hanging.

### D5 — Provisional and Unfrozen Surface Classification

The package `compatibility.json` and README explicitly classify the API as provisional and unfrozen. The provisional classification ensures consumers recognize the surface is subject to refinement during vertical delivery implementation (#102–#109) prior to final freeze in #111.

## Migration Plan

1. Propose change `add-provisional-node-binding` with proposal packet and full assessment.
2. Implement `packages/security-audit-sdk-node` with source, tests, and build scripts.
3. Validate against Node 24 and Node 26 matrices.
4. Execute child-process leakage and shutdown exit tests.
5. Verify package contents and packed tarball installation outside workspace root.
6. Fold delta specification into canonical specs and archive change.
