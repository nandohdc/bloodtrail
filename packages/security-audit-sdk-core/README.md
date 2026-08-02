# @bloodtrail/security-audit-sdk-core

Framework-independent ESM TypeScript SDK core for constructing and validating events that conform to Bloodtrail Security Audit Event Contract version `1.0.0`.

## Status and authorization boundary

This package is an isolated technical candidate. It is private, unpublished, and unlicensed for distribution. Its implementation is not project-owner approval and does not authorize:

- production deployment or production event collection;
- processing real-user data;
- application or framework instrumentation;
- production transports, exporters, collectors, queues, outboxes, storage, or SIEM integration;
- analytics, detection, browser telemetry, or cryptographic audit-log chaining.

The package contains a transport-neutral sink interface and non-production test sinks only. It is not a production deployment guide.

## Purpose

The SDK provides:

- deterministic contract-derived types, constants, event metadata, and a standalone Draft 2020-12 validator;
- 24 named event methods whose names, categories, actions, lifecycle constraints, and minimum delivery classes are derived from the canonical catalog;
- runtime-verifiable authority-specific context constructors;
- `AsyncLocalStorage` context scopes;
- transaction-aware operation state;
- causality, retry, re-execution, and redelivery semantics;
- prohibited-data scanning, field-scoped privacy transformations, and registered extensions;
- safe structured results and diagnostics;
- an immutable transport-neutral sink boundary;
- deterministic clocks, identifier providers, and test sinks.

The SDK does not weaken or replace canonical contract validation.

## Development installation

Prerequisites:

- Node.js `24` or `26` only. The pinned verification releases are `24.2.0` and `26.5.0`.
- TypeScript `>=5.9.2 <6`; repository verification uses exactly `5.9.2`.
- npm with lockfile-compatible `npm ci` support.
- Git and the repository OpenSpec CLI for the canonical repository verification command.

From the repository:

```sh
cd packages/security-audit-sdk-core
npm ci
npm run build
```

The package is not published. Do not install it from a registry or treat `private: true` as release approval.

## Module and package exports

The package is ESM-only. Use ESM imports; CommonJS package entry points are not supported.

| Export | Purpose | Production status |
| --- | --- | --- |
| `@bloodtrail/security-audit-sdk-core` | SDK factory, context constructors, named APIs, validation, generated public types/constants, results, errors, and sink types | Isolated candidate only |
| `@bloodtrail/security-audit-sdk-core/testing` | In-memory and capturing test sinks plus test-provider types | Test/development only |

Internal source, generated validator modules, raw event assembly, and unchecked sink invocation are not exported subpaths. The root declaration entry is `dist/index.d.ts`.

## Initialization and immutable configuration

```ts
import { createSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-core";
import { createCapturingAuditSink } from "@bloodtrail/security-audit-sdk-core/testing";

const sink = createCapturingAuditSink(); // test/development only
const audit = createSecurityAuditSdk({
  contractVersion: "1.0.0",
  producer: { name: "synthetic-audit-producer", version: "0.1.0" },
  service: { name: "synthetic-service", version: "0.1.0" },
  environment: { name: "test" },
  sink,
});
```

Initialization validates configuration and creates an SDK-owned shallow-frozen normalized envelope. Primitive and plain-value options such as producer, service, environment, deployment, base context, timeout, and transformation registration paths are copied into protected SDK-owned records. Replacing or mutating those source values after construction does not change the normalized snapshot. Unsupported contract versions fail before the SDK becomes ready.

Injected sinks, clocks, identifier providers, and transformation hooks remain caller-owned capabilities. The SDK retains their exact object references, invokes methods with their original receiver, and does not clone or recursively freeze the objects or their arrays, maps, sets, counters, private fields, or other state. Configuration immutability does not transfer ownership: callers may maintain collaborator state, remain responsible for safe concurrent behavior, and decide whether to freeze a collaborator before injection. Default clock and identifier providers use supported Node.js APIs. Provider output is still format-checked and event identifiers must remain unique within an SDK instance.

## Responsibility and trust boundaries

| Boundary | What it may establish | What it must not claim |
| --- | --- | --- |
| Authoritative server-derived context | Facts resolved by application-owned authentication, tenancy, resource-ownership, or policy authorities and passed through the matching SDK constructor | That request or browser fields became authoritative merely because they were copied or cast |
| Client claims | Labeled claimed actor/tenant or client-reported context when policy permits | Authenticated identity, tenant ownership, authorization, or resource authority |
| SDK validation | Structure, registries, runtime provenance, cross-context consistency, prohibited-data policy, lifecycle/outcome/commit rules, causality, and extensions | Producer truthfulness, completeness, legality, non-repudiation, delivery, durability, or ingestion acceptance |
| Application responsibility | Resolve authoritative facts, call the correct named method, report trusted transaction transitions, choose business behavior after failure, and keep secrets out of inputs | Delegate authority or business truth to types, schema validity, or sink acceptance |
| Future delivery infrastructure | A separately governed transport/collector may define buffering, retries, durable acceptance, and operational failure policy | Redefine canonical event semantics or infer that a validated event is truthful |

Authority constructors are trusted-boundary APIs, not identity providers. The application must call them only after its own authoritative resolution. Runtime brands prevent plain-object and TypeScript-cast forgery inside a process, but they cannot detect a compromised application deliberately supplying false server facts.

## Context and lifecycle

Use `audit.runWithContext(frame, callback)` or `runWithAuditContext(frame, callback)` to establish an immutable `AsyncLocalStorage` frame. Nested scopes merge only explicit fields and restore their parent. Promise and timer continuations created inside a scope inherit it under the supported Node runtimes; detached work created outside the scope must receive explicit context. Missing required context fails safely rather than fabricating identity, tenancy, requests, or traces.

The SDK starts in `ready`. `shutdown()` establishes a no-new-emissions boundary, waits up to the configured bound for in-flight sink calls, then invokes optional sink `flush` and `shutdown` at most once. Concurrent shutdown callers share the in-progress result. Calls after shutdown return `SDK_SHUT_DOWN`. `flush()` and sink acceptance do not mean durable handoff.

## Event, operation, privacy, and sink APIs

- Use the 24 named methods listed in [API.md](./API.md). They derive canonical identity and delivery class; callers cannot override them.
- Use `beginOperation()` for transaction-aware work. Named methods trust only the exact operation handle issued by the same SDK instance; plain objects, snapshots, copies, object spreads, serialized values, and foreign-instance handles are rejected before sink invocation. Report `markCommitted`, `markNotCommitted`, `markPartiallyCommitted`, `markCompensated`, or `markCancelled` only from the application's trusted transaction boundary. Successful transactional emission before commit is rejected without invoking the sink.
- Terminal success is synchronously reserved per SDK instance and SDK-issued operation/event identity before sink handoff. A concurrent or sequential duplicate returns bounded `SDK_DUPLICATE_SUCCESS` without another validation-hook or sink invocation. Acceptance completes the reservation; rejected, unknown, thrown, or rejected-promise sink outcomes release it for a later explicit caller retry. This is not automatic retry or durable delivery. Retention bounding and the final deduplication horizon remain future F-08 work.
- Authorization evidence and business outcome are independent. `allow` does not prove later business success.
- Pure redelivery uses `redeliver()` with the same immutable validated event and event ID. Re-execution uses a named method with a positive retry relationship and receives a new event ID.
- Required asynchronous completion carries both causation and original-event identity.
- Transformation registrations are synchronous, initialization-only, field-scoped, bounded, and followed by prohibited-data and canonical validation. Each copied registration path points to the original caller-owned hook object; key material is never an output field.
- Extensions are limited to generated registered namespaces. They cannot shadow canonical fields or upgrade trust.
- `AuditEventSink.emit()` receives one validated frozen event and returns only sink-boundary `accepted`, `rejected`, or `unknown` state. The event is SDK-owned immutable data; the sink and any sink-owned queue or counters remain caller-owned and mutable. The core implements no retry, queue, storage, collector, or delivery guarantee.
- Generic `emit()` and `redeliver()` remain trusted-producer boundaries for complete canonical events. Operation-handle provenance protects sanctioned named construction; it cannot prove that compromised trusted application code supplied a truthful complete event to a generic API.
- Canonical delivery classes are `best_effort`, `security_significant`, `transaction_critical`, and `policy_critical`; named APIs derive the applicable minimum and callers cannot override it.
- `createCapturingAuditSink` and `createInMemoryAuditSink` are test utilities only. They perform no network or filesystem I/O and provide no durability.

Expected validation and sink failures are returned as `AuditResult` values with stable bounded codes and paths. Initialization misuse may throw `SecurityAuditSdkError`. Caller value data is limited to finite numbers, strings, booleans, null, dense arrays, and plain records; unsupported host/behavior-bearing values return `SDK_INVALID_INPUT`, while configuration construction uses `SDK_INVALID_CONFIGURATION`. Nested `BigInt` and cyclic values return `FIELD_SERIALIZATION_FAILED`, not `FIELD_LIMIT_EXCEEDED`; genuine successfully serialized oversize values retain `FIELD_LIMIT_EXCEEDED`. Getter, Proxy, clone, and serialization details are discarded, `toJSON()` is not invoked as a conversion hook, and the sink is not called after input normalization fails. Serialized errors omit raw rejected values, complete events, arbitrary causes, stacks, and secret-bearing sink messages. See [SECURITY.md](./SECURITY.md) for prohibited patterns and safe alternatives.

## Examples and API reference

[API.md](./API.md) documents initialization, context constructors, all 24 methods, operations, lifecycle, errors, privacy, extensions, and test utilities. Compilable synthetic examples are in [`examples/scenarios.ts`](./examples/scenarios.ts), with a verification runner in [`examples/run.ts`](./examples/run.ts). They cover authentication success, authorization and cross-tenant denial, role assignment, administrative impersonation, sensitive modification/export, asynchronous completion, retry/re-execution, transaction success/failure, privacy transformation, registered extension, concurrent contexts, and deterministic testing.

## Contract compatibility

This candidate implements exactly contract version `1.0.0`, bound to normative contract commit `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993`. `compatibility.json` is the machine-readable compatibility manifest and `contract-provenance.json` identifies all authoritative inputs. The SDK cannot silently change contract semantics. Unsupported versions fail safely. Contract changes require separate contract governance before SDK adaptation.

Read [MIGRATION.md](./MIGRATION.md) before changing SDK versions. Production users must not assume that a future SDK version remains compatible without checking the compatibility manifest, migration notes, exported API, and contract binding.

Generated files under `src/generated/` are repository artifacts and must not be edited. Run generation from the canonical inputs and use drift checking instead.

## Canonical verification

From this package directory, the single repository entry point is:

```sh
npm run verify
```

It deliberately removes local dependencies and disposable outputs, installs exact lockfile dependencies with `npm ci`, rejects generated drift before generation, regenerates and rechecks, type-checks, builds, compiles and runs runtime/type/example and isolated verification-mutation tests, checks exports/runtime policy/contract immutability/scope/dependencies/coherence, runs `npm audit`, inspects `npm pack --dry-run`, performs lifecycle-appropriate strict OpenSpec validation, enforces changed-path ownership, checks Git whitespace, and requires an empty index. It needs network access for the clean install and audit.

Lifecycle selection is deterministic from `verification-lifecycle.json`. The default verifies the active remediation when it exists and the dated remediation archive after archival. Explicit diagnostics use `--mode active|governed|archived`; `--change implement-security-audit-sdk-core` selects the immutable original SDK archive. Active mode validates the live remediation and keeps later issue/final-decision tasks pending. Governed mode requires exact technical and owner-decision bindings while merge/archive remain pending. Archived mode requires active absence, one matching dated archive, complete tasks, canonical capability materialization, preserved commit bindings, and continued production/publication restrictions.

Changed-path verification compares security-sensitive owned roots against the remediation baseline instead of treating all later repository history as SDK-owned. Canonical event-contract and original archived-governance drift remain fatal; unrelated merged files do not. Non-ignored untracked SDK source remains visible and fails. Files ignored by standard Git ignore configuration are excluded; a non-ignored root `CLAUDE.md` is classified as unrelated local instruction content, not as SDK implementation.

For the exact supported-runtime matrix, run the documented Node `24.2.0` and `26.5.0` procedure in [API.md](./API.md). The canonical command checks the current runtime and declared matrix; the two runtime executions remain independent evidence.
