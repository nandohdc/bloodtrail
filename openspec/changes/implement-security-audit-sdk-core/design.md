## Context

See `proposal.md` for motivation and scope. Bloodtrail has one approved canonical capability, `security-audit-event-contract`, and its version 1.0.0 machine-readable artifacts are present under `contracts/security-audit/`. Contract Commit A `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993` is the reviewed normative technical target. The SDK change consumes that contract without modifying the capability or archived change.

The repository currently has no production application, package workspace, SDK, framework integration, or delivery infrastructure. The design must therefore establish an isolated package and public API without inventing application architecture. The contract distinguishes producer truth from structural validity: the SDK can enforce provenance, shapes, registries, and conflicts, but it cannot prove that a compromised configured producer supplied truthful authoritative state.

Planning artifacts do not authorize apply, package publication, production use, event collection, or real-user processing. The capability delta defines required observable behavior; this design describes the intended implementation approach.

## Goals / Non-Goals

**Goals:**

- Implement an isolated ESM TypeScript package at `packages/security-audit-sdk-core` with package name `@bloodtrail/security-audit-sdk-core`.
- Make version 1.0.0 contract-derived types, constants, event-specific builder inputs, and validation deterministic and drift-checked.
- Provide an idiomatic public API that is difficult to misuse and explicit about authority, transaction, causality, lifecycle, and sink boundaries.
- Keep runtime validation mandatory and complete even when TypeScript is bypassed.
- Provide concurrency-safe server context propagation with explicit trust/provenance.
- Keep output transport-neutral and preserve delivery class without implementing delivery guarantees.
- Achieve zero runtime production dependencies if the selected standalone schema-validation approach passes conformance; keep build/test dependencies pinned and development-only.
- Make all tests deterministic and reuse the approved contract fixtures directly.

**Non-Goals:**

- Selecting or integrating any production framework, exporter, collector, broker, queue, outbox, storage, SIEM, analytics/detection, browser telemetry, instrumentation, cryptographic chain, or diagnostic logging system.
- Providing durable buffering, retries, atomic business/audit persistence, production shutdown durability, or a universal fail-open/fail-closed response.
- Resolving production privacy, retention, legal, infrastructure, alerting, or policy-critical posture.
- Proving producer truthfulness, completeness, global ordering, or non-repudiation.
- Altering contract version 1.0.0 or its approved canonical capability.

## Package Architecture

The package is isolated under `packages/security-audit-sdk-core/` and contains:

- `src/index.ts`: supported public exports only;
- `src/sdk.ts`: initialization, lifecycle, named event API composition, and emission orchestration;
- `src/context.ts`: `AsyncLocalStorage` scope, explicit context merging, and trusted/claimed context distinctions;
- `src/builders/`: authority-specific and event-specific construction;
- `src/operations/`: transaction-aware operation state machine;
- `src/validation/`: generated schema validator adapter, semantic validator, registry/catalog checks, prohibited-data scan, and safe error mapping;
- `src/sinks/`: sink contract plus in-memory and capturing test sinks;
- `src/generated/`: generated types, discriminants, constants, catalog metadata, field-policy metadata, and standalone schema validator; never hand-edited;
- `scripts/`: deterministic generation and drift checks;
- `tests/`: runtime, compile-time, fixture, package, compatibility, and scope tests;
- package metadata, strict TypeScript configurations, lockfile, and package documentation.

The initial package is ESM-only with an explicit exports map. Build output contains JavaScript, declaration files, source maps if approved, generated contract metadata, and no internal subpath exports. The package uses Node's built-in test runner where practical and a compile-only TypeScript fixture suite for expected success/failure cases.

### Runtime policy

Initial policy is Node.js `>=24` with CI coverage on Node 24 LTS and Node 26. The package uses only APIs supported by that baseline, including stable `AsyncLocalStorage`, Web Crypto or `node:crypto`, and ESM. A required runtime-policy ADR must verify the release and maintenance status at implementation time, pin exact CI versions, and define dropping a supported Node major as a package breaking change. TypeScript compiler and module-resolution versions are pinned in the lockfile and tested under strict settings; changing the minimum supported TypeScript version follows package compatibility policy.

Alternative considered: target only the implementation host's Node 26. Rejected because it would unnecessarily narrow reusable SDK consumers and conflate the development environment with support policy.

## Public API

Initialization returns a single immutable SDK instance:

```ts
const audit = createSecurityAuditSdk({
  contractVersion: "1.0.0",
  producer,
  service,
  environment,
  deployment,
  sink,
  authoritativeContext,
  transformations,
  clock,
  identifiers,
});
```

`clock` and `identifiers` default to trusted production-safe providers and are injectable for tests. Configuration is cloned, normalized, validated, and frozen. Provider and hook registrations cannot be replaced after initialization.

The public surface includes:

- `createSecurityAuditSdk`;
- generated public event/context/value types and controlled constants;
- safe result and error-code types;
- named event methods for all catalog entries;
- explicit context-scope APIs;
- transaction-aware operation APIs;
- `AuditEventSink`, `AuditDeliveryResult`, and lifecycle interfaces;
- in-memory/capturing test sink constructors.

Internal raw canonical-event assembly, generated validator implementation, and unchecked sink invocation are not public exports.

Named calls follow the requested idiom:

```ts
await audit.authenticationSucceeded({ actor, session, authentication, request });
await audit.authorizationDenied({ actor, tenant, resource, authorization, request });
await audit.sensitiveResourceModified({ actor, tenant, resource, operation, outcome });
```

Each named method fixes schema/event/catalog identity and minimum delivery class, merges eligible scoped context, constructs a candidate, runs every validation layer, deep-freezes a canonical output snapshot, and invokes the sink once. A lower-level API may accept only a generated discriminated union, never a string-indexed arbitrary event.

## Context Model

`AsyncLocalStorage<AuditContextFrame>` stores an immutable frame containing separately typed slots for:

- authenticated principal;
- actor and delegated/impersonating actor;
- authoritative tenant context and separately labeled claimed tenant;
- session and authentication evidence;
- request/message identifiers;
- trace/span context;
- correlation and causation;
- operation and transaction identity;
- service/workload identity;
- environment and deployment metadata.

`audit.runWithContext(frame, callback)` validates and freezes a new frame, inherits only allowed fields, applies explicit overrides, runs the callback, and restores the parent scope. Context frames carry provenance and cannot be constructed from arbitrary request objects through one convenience cast.

### Authority boundary

The package cannot cryptographically prove application truth. Instead it makes authority entry explicit:

- configured server-side providers return `AuthoritativeActorContext`, `AuthoritativeTenantContext`, `AuthoritativeResourceContext`, `AuthenticationEvidence`, or `AuthorizationEvidence` after application-owned resolution;
- request/client parsers return `ClaimedContext` only;
- observed transport adapters, when later implemented, return observed provenance rather than authenticated identity;
- runtime validation verifies provenance/value combinations and cross-context consistency;
- documentation states that configured providers are trust boundaries and must not merely relabel request input.

Opaque TypeScript branding prevents accidental interchange in typed code. Runtime objects also carry canonical trust/provenance fields, so JavaScript and casted values remain semantically validated. Branding is compile-time misuse resistance, not proof of truthful producer behavior.

Alternative considered: accept one flat context object. Rejected because it makes client claims and authoritative values easy to conflate.

## Builder Model

Generated catalog metadata drives all 24 named builders. Shared builder modules construct actor, subject, principal, credential reference, delegation/impersonation, tenant, resource, authentication, authorization, request, source/destination, data, risk, correlation, integrity, and extension structures.

Builders follow three rules:

1. derive controlled values and catalog constants rather than accepting caller overrides;
2. omit unavailable optional fields rather than fabricate placeholders;
3. return immutable intermediate values with explicit authority/provenance.

Event methods take event-specific generated inputs. For example, `authorizationDenied` requires authoritative authorization decision/evidence and a denied outcome; a caller cannot substitute a generic `failure`. `sensitiveResourceModified` requires the cataloged resource/action context and transaction outcome. Generated inputs improve compile-time guidance, while event-specific runtime rules remain decisive.

## Transaction-aware Operation Model

`audit.beginOperation(input)` returns an operation handle with a private monotonic state machine:

```text
started -> committed
started -> not_committed
started -> partially_committed
committed -> compensated
```

Invalid transitions fail safely. The operation owns stable operation ID and optional transaction/correlation identity. A trusted application transaction boundary explicitly records the outcome through methods such as `markCommitted`, `markNotCommitted`, `markPartiallyCommitted`, or `markCompensated`. The API does not introspect databases or claim atomicity.

`emitSuccess()` checks that the event's catalog/lifecycle rule permits success and that required committed state is present. It rejects before sink invocation otherwise. `emitFailure()` and other outcome methods preserve authorization evidence separately. Each immutable occurrence gets a new event ID; retry/redelivery APIs retain or link IDs according to contract semantics.

Alternative considered: let callers pass `commitState: "committed"` directly to every event call. Rejected because it makes premature success trivial and loses transition evidence. Alternative considered: implement an outbox inside the operation. Rejected as prohibited delivery infrastructure.

## Validation Layers

Validation order is fixed and fail-safe:

1. normalize only documented SDK input forms without coercing canonical meanings;
2. recursively pre-scan keys and values for prohibited data before hooks or diagnostics;
3. invoke only field-scoped registered transformation hooks for `transform_required` or explicitly conditional fields;
4. assemble canonical version `1.0.0` candidate with derived catalog constants;
5. run the generated Draft 2020-12 validator;
6. run field bounds, registry, catalog, event-specific requiredness, authority/provenance, tenant/resource, lifecycle/outcome/commit, causality/retry, extension, and privacy semantic validators;
7. deep-clone/freeze the validated event;
8. invoke the sink and map its result through bounded lifecycle/error handling.

The generated schema validator is produced at build time using a pinned standards-compliant Draft 2020-12 implementation in standalone mode. The intended release artifact has no runtime dependency on the generator library. If standalone output cannot preserve strict conformance, deterministic output, CSP-compatible loading expectations, or package support, ADR-SDK-003 must select a pinned runtime schema dependency instead; zero runtime dependencies is subordinate to correctness.

CI separately runs generation drift, strict TypeScript compilation, runtime tests, approved fixtures, compatibility, package exports, supported Node versions, dependency/license/audit, and exact scope checks. Downstream ingestion must still revalidate; SDK success is not delivery or acceptance proof.

## Type-generation Strategy

A repository-local generator reads the authoritative source plus generated schema/catalog/policy/registry files and asserts their version and provenance agree. It emits:

- canonical structural TypeScript types;
- controlled string unions and constants;
- event-name discriminants;
- event-specific builder input types and conditional-field metadata;
- extension namespace types;
- SDK error-code constants derived from contract codes plus separately governed SDK lifecycle codes;
- standalone schema validator output.

The generator sorts object keys and registries deterministically, normalizes newlines, writes generated headers with input paths and contract version but no timestamps, and supports `--check`. Generated output is committed so consumers do not need the generator. Tests compile positive type fixtures and expected-error fixtures, compare all 24 event discriminants to the catalog, and prove no generated canonical type is manually shadowed.

Alternative considered: use a generic JSON-Schema-to-TypeScript tool without catalog/source metadata. Rejected because schema alone does not carry every authority, policy, event-specific, and registry rule. A pinned helper may be used internally only if output is post-checked against the source.

## Error Model

Public operations return a documented result union or throw a documented `SecurityAuditSdkError` only according to one consistent API policy selected in ADR-SDK-005. The proposal baseline favors result unions for expected validation/sink outcomes and exceptions for programmer/configuration errors during initialization, but the ADR must ensure named methods are consistent.

Every error contains:

- stable SDK or canonical contract code;
- bounded canonical path when safe;
- error category (`configuration`, `validation`, `authority`, `privacy`, `lifecycle`, `sink`);
- safe event name/schema version/event ID only when already validated and bounded;
- no raw rejected value, event body, arbitrary cause message, stack in serialized form, or sink payload.

Unknown dependency and sink errors map to bounded SDK codes. Original causes may remain available only through an explicitly non-serializing developer diagnostic hook if ADR-SDK-005 proves it cannot leak event data; general diagnostic logging remains out of scope.

## Sink Interface

The behavior is equivalent to:

```ts
interface AuditEventSink {
  emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult>;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

`AuditDeliveryResult` reports only the documented sink boundary: accepted, rejected, or unknown/failed, plus a bounded safe code. The SDK passes the event's immutable delivery class but does not implement class guarantees. Business behavior after sink failure belongs to later event-specific production policy.

Bundled sinks:

- `createInMemoryAuditSink`: bounded optional capacity for local tests; no durability claim;
- `createCapturingAuditSink`: deterministic capture and controlled failure injection for tests.

No console or file sink is included initially. This avoids normalizing accidental local exposure and avoids claims about rotation, retention, permissions, or operational safety. A later non-production sink requires a separate ADR/task amendment within scope.

## Lifecycle Behavior

The SDK state machine is:

```text
uninitialized -> ready -> shutting_down -> shut_down
```

`createSecurityAuditSdk` performs synchronous configuration validation plus any explicit asynchronous `initialize` step selected by ADR-SDK-006. No emissions are accepted before ready. Configuration is immutable thereafter.

Shutdown establishes a no-new-emissions boundary, waits for tracked in-flight `emit` calls up to a configured bounded duration, calls sink `flush`/`shutdown` in documented order at most once, and reports unresolved operations without exposing events or claiming durable handoff. Repeated shutdown is idempotent. The default timeout is a package behavior selected and tested by ADR; it is not a production delivery policy.

## Extension Model

Generated extension APIs expose only namespaces registered in version 1.0.0. Callers provide typed registered fields; runtime validation checks version, bounds, privacy, trust, and prohibited data. Extensions are merged only under `extensions`, never into canonical roots, and post-merge validation rejects canonical shadowing. No generic `Record<string, unknown>` extension escape hatch is public.

## Testing Strategy

The apply phase must build a single reproducible verification command covering:

- generation and byte-drift checks;
- strict TypeScript builds and compile-time positive/negative fixtures;
- all 24 approved positive events through schema and SDK semantic validation;
- every approved negative fixture with exact safe error code and secret non-echo assertions;
- each named event builder and its required/conditional inputs;
- actor/principal/delegation/impersonation distinctions;
- client claim and tenant/resource authority conflicts;
- `AsyncLocalStorage` inheritance, nesting, concurrency isolation, missing context, and cleanup;
- trace/correlation/causation/operation/retry/redelivery identity;
- operation state transitions, premature success, allow-plus-failure, compensation, and sink failure after commit;
- prohibited keys/values before and after hooks, transformation scope, and extension rejection;
- deterministic clocks/identifiers and malformed provider output;
- sink accepted/rejected/unknown behavior, shutdown races, idempotence, and bounded timeout;
- package export maps and inaccessible internal subpaths;
- Node 24 and 26 CI matrix and strict TypeScript baseline;
- package semantic compatibility and version `1.0.0` fixture interpretation;
- license, lockfile, vulnerability, runtime dependency, and exact no-production-scope checks.

Tests operate only on fictional contract fixtures. No real-user data or production application integration is permitted.

## Security and Privacy Boundaries

- Client/request data enters only claim or correlation paths unless an application-owned configured authority resolves it.
- Schema/type validity never upgrades trust.
- Prohibited-data scan precedes hooks and diagnostics and is repeated on canonical output.
- Hooks are field-scoped, initialized once, bounded, and unable to overwrite canonical authority.
- Events and context frames are cloned/frozen to avoid post-validation mutation and time-of-check/time-of-use drift.
- Sink errors are untrusted and sanitized.
- The SDK cannot establish producer truthfulness, completeness, durable delivery, legal compliance, or non-repudiation.
- Production privacy/legal review and policy-critical failure posture remain mandatory future gates.

## Required ADRs

1. **ADR-SDK-001 — Package, module, Node, and TypeScript support policy:** exact package name/path, ESM/exports, initial Node 24/26 matrix, TypeScript baseline, and compatibility consequences.
2. **ADR-SDK-002 — Canonical type generation:** source inputs, generator approach, event-specific discriminants, generated-file ownership, drift checks, and schema/source cross-checks.
3. **ADR-SDK-003 — Runtime schema validation:** pinned Draft 2020-12 engine, standalone versus runtime dependency, strict mode, formats, generated validator packaging, and conformance evidence.
4. **ADR-SDK-004 — Authority and context model:** configured authority providers, claimed/observed context, branding, `AsyncLocalStorage` inheritance/override rules, concurrency, and unsupported boundaries.
5. **ADR-SDK-005 — Public result and safe error model:** result-versus-exception policy, code registry, cause handling, size bounds, and compatibility.
6. **ADR-SDK-006 — Initialization, lifecycle, sink contract, and test sinks:** ready/shutdown states, in-flight policy, timeout, result semantics, immutability, and exclusion of console/file and production sinks.
7. **ADR-SDK-007 — Transaction-aware operation model:** state machine, trusted commit transition, event identities, asynchronous completion, retry/redelivery, and non-atomicity limitation.
8. **ADR-SDK-008 — Privacy transformations and extensions:** pre/post scans, field-scoped hooks, purpose/tenant key scope, metadata, extension typing, and canonical override prevention.
9. **ADR-SDK-009 — Package and contract compatibility:** relationship between SDK SemVer and contract 1.0.0, generated API changes, error-code evolution, Node support, migration, and unsupported versions.

All ADRs must be accepted before technical implementation tasks depending on them are marked complete. Acceptance is project design evidence, not production authorization.

## Risks / Trade-offs

- **Configured authority providers can still lie or relabel request input** → make the boundary explicit, validate provenance/conflicts, test misuse, and preserve the contract's bounded truthfulness claim.
- **Generated types may create false confidence** → keep runtime validation mandatory and independently exercise untyped inputs and negative fixtures.
- **Standalone schema validator output may be brittle across generator versions** → pin dependencies and lockfile, byte-check output, compile under all supported runtimes, and fall back to a pinned runtime dependency if correctness requires it.
- **Event-specific generated APIs may become large** → generate consistent methods/types from catalog metadata and retain one discriminated lower-level API without arbitrary names.
- **`AsyncLocalStorage` has integration edge cases** → document supported Node boundaries, test concurrency and nesting, and require explicit context when propagation is absent.
- **Transaction handle may be mistaken for outbox atomicity** → name and document it as state-aware construction only; test sink failure after commit and state that no durability is provided.
- **Deep scanning can be expensive or vulnerable to pathological objects** → reject unsupported prototypes/cycles, enforce depth/item/byte bounds before traversal, and benchmark bounded synthetic fixtures.
- **Hooks can leak sensitive data or mutate authority** → minimize hook inputs, freeze registrations, validate outputs, and never call hooks for prohibited values.
- **Test sinks may be used in production** → conspicuous names/docs, optional runtime warning only if it is not general logging, package metadata, and no delivery claims; production use remains governance-prohibited.
- **Supporting two Node majors increases CI burden** → keep the matrix explicit and treat support changes as governed compatibility decisions.

## Migration Plan

This is a new package with no existing SDK consumers.

1. Complete and review proposal artifacts; this stage performs no implementation.
2. During a separately authorized apply phase, commit any approved proposal baseline before implementation if required by the governed workflow.
3. Create and accept the nine SDK ADRs, scaffold the isolated package, pin development dependencies, and establish generation/tests.
4. Generate types and validator artifacts from contract version 1.0.0, then implement context, builders, operation model, validation, sinks, lifecycle, and documentation in task order.
5. Run read-only technical verification with an empty index before the implementation commit.
6. Bind owner review to the exact implementation commit, resolve findings, rerun verification, and record the final SDK-core decision separately.
7. Merge and archive only after all tasks, status surfaces, live PR checks, and authorization boundaries are coherent.

Rollback before publication is branch/commit reversion. No production rollback plan exists because deployment, application integration, and collection are prohibited in this change.

## Open Questions

None are deferred at proposal time. Exact dependency versions, lifecycle timeout value, and CI patch versions are implementation-time pinned details governed by the required ADRs; they do not change the capability behavior or task structure.
