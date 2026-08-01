## Why

Bloodtrail Security Audit Event Contract version 1.0.0 is approved as the authoritative design basis, but application developers do not yet have a framework-independent Node.js and TypeScript package that constructs and validates conforming events without duplicating or weakening the canonical model. A core SDK is needed to make correct event construction, context propagation, transaction-aware outcomes, safe validation, and transport-neutral handoff practical while retaining the contract's authority, privacy, compatibility, delivery-class, and governance boundaries.

## What Changes

- Add a framework-independent TypeScript SDK core for supported Node.js runtimes with a documented package structure, public API, immutable initialization configuration, lifecycle, and compatibility policy.
- Generate strict TypeScript types and event-specific discriminated builder inputs deterministically from the approved canonical source or JSON Schema; add drift detection and prohibit a manually maintained duplicate model.
- Provide misuse-resistant builders for actor, subject, authenticated principal, delegation and impersonation, credentials, tenant and resource context, authentication, authorization, requests, operations, correlation, causation, retry, delivery class, and registered extensions.
- Provide named event APIs such as `authenticationSucceeded`, `authorizationDenied`, and `sensitiveResourceModified`, with runtime JSON Schema, registry, authority, privacy, and event-specific semantic validation.
- Define an `AsyncLocalStorage` context model that propagates trusted server context without promoting request or client claims to authoritative identity, tenant, resource ownership, or authorization facts.
- Add a transaction-aware operation API that prevents or safely rejects success emission until committed state is known, while preserving distinct authorization decisions and business outcomes.
- Add stable event-ID generation plus injectable clocks and identifier sources for deterministic tests; preserve retry, redelivery, original-event, operation, correlation, and causation semantics.
- Add configurable redaction and transformation hooks that cannot bypass prohibited-field enforcement or silently weaken field policy.
- Add a transport-neutral `AuditEventSink` boundary that preserves delivery class but implements no production delivery guarantee; include only explicitly non-production in-memory and capturing test sinks, with any console/file sink requiring separate justification and conspicuous non-production labeling.
- Add safe structured SDK error codes for invalid configuration, missing authority, schema and semantic failures, prohibited data, conflicts, premature success, sink failure, and shutdown races without echoing rejected secrets or payloads.
- Add generated-type, compile-time, runtime, fixture, builder, context, transaction, privacy, extension, sink, package-export, Node.js compatibility, and no-production-dependency tests, reusing all approved positive and negative contract fixtures.
- Add package documentation, migration policy, security/privacy boundaries, required ADRs, exact-commit owner review, final SDK-core decision, and explicit authorization limits.
- Do not alter the approved `security-audit-event-contract` capability or silently reinterpret version 1.0.0. Any genuine semantic contract defect requires a separate versioned OpenSpec contract change.

## Scope

This change covers reusable SDK code for correct canonical event construction and validation, transport-neutral output, safe development/test sinks, and package documentation. SDK work remains isolated from production applications and uses the approved contract artifacts as its source of truth.

## Non-goals

This change does not implement or authorize Express, Fastify, NestJS, or other framework middleware; OpenTelemetry or OTLP export; Kafka, brokers, collectors, queues, local durable queues, transactional outboxes, retry or reliable-delivery infrastructure; storage; SIEM integration; analytics or detection rules; browser telemetry; production instrumentation; cryptographic chaining; general diagnostic logging; production event collection; real-user data processing; or production deployment.

It does not select one universal fail-open or fail-closed policy and does not resolve retention duration, residency, legal hold, policy-critical failure posture, alert/backlog thresholds, infrastructure products, released-schema removal windows, or applicable privacy/legal requirements.

## Developer Users

- Bloodtrail maintainers implementing reusable security-audit producers.
- Application and service developers integrating a later framework-specific adapter.
- Test authors validating application event semantics against contract version 1.0.0.
- Future transport implementers consuming validated events through the sink interface without redefining canonical fields.

## Alternatives

- **Hand-build events in each application:** rejected because it duplicates the model and makes authority, privacy, lifecycle, and compatibility drift likely.
- **Expose only raw JSON Schema validation:** rejected because schema validation alone cannot provide idiomatic typed builders, trusted context handling, transaction-aware APIs, or all semantic invariants.
- **Combine framework middleware and delivery infrastructure now:** rejected because it couples unrelated trust and reliability decisions and would exceed the approved authorization boundary.
- **Use OCSF, OpenTelemetry, or CloudEvents as the producer API:** rejected because Bloodtrail version 1.0.0 is canonical; those standards remain downstream mapping, optional transport representation, or optional envelope support.

## Risks

- Generated TypeScript types may overstate runtime safety unless runtime validation remains mandatory.
- Convenience APIs may accidentally promote untrusted context or obscure actor, tenant, resource, authorization, outcome, and commit distinctions.
- `AsyncLocalStorage` propagation may leak or lose context across unsupported asynchronous boundaries unless scope and tests are explicit.
- Transaction-aware builders may imply durability or atomicity that the core SDK cannot provide.
- Redaction hooks or test sinks may become bypasses for prohibited-data controls or be mistaken for production delivery.
- Node.js and TypeScript support claims may become broader than tested package and compiler matrices.
- Contract fixture reuse can drift if exact source version and generated artifacts are not pinned and checked.

## Success Criteria

- The SDK deterministically generates strict TypeScript types from the approved canonical artifacts and CI detects drift.
- Named builders and lower-level APIs produce version 1.0.0 events that pass structural and semantic validation.
- All approved positive fixtures validate and all approved negative fixtures fail with their exact safe codes without secret echo.
- Tests prove that client claims cannot become authenticated identity or authoritative tenant/resource context; controlled vocabularies and registered extensions are enforced.
- Tests prove that authorization and operation outcomes remain distinct, success before commit is rejected, and retry/asynchronous causality rules are enforced.
- Context propagation, deterministic clock/ID injection, sink lifecycle and failure handling, package exports, strict TypeScript compilation, and supported Node.js runtimes are tested.
- The implementation introduces no production transport, delivery guarantee, framework integration, application instrumentation, storage, SIEM, browser telemetry, or real-user processing.
- Exact-commit project-owner review records whether the reusable SDK package is approved; that decision does not authorize production deployment or collection.

## Relationship to the Approved Contract

The normative technical target is Contract Commit A `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993`. The canonical capability specification is `openspec/specs/security-audit-event-contract/spec.md`; the authoritative source, schema, catalog, policies, registries, ADRs, and fixtures under `contracts/security-audit/` govern implementation. This change may implement version 1.0.0 but may not weaken, extend, or reinterpret it. The archived contract change is historical and is not modified.

## Relationship to Later Changes

Framework integrations, production transports/exporters, reliable delivery, queue/outbox infrastructure, production instrumentation, storage, SIEM integration, analytics/detection, cryptographic chaining, and any real-user-data processing require separate reviewed OpenSpec changes after SDK-core approval.

## Capabilities

### New Capabilities

- `security-audit-sdk-core`: Defines the framework-independent Node.js/TypeScript SDK behavior for deterministic contract-derived types, authoritative context and builders, runtime validation, transaction-aware outcomes, safe errors, transport-neutral sinks, lifecycle, tests, and governance boundaries.

### Modified Capabilities

None. The approved `security-audit-event-contract` requirements are unchanged.

## Impact

- Adds a new isolated SDK package area during apply; no existing production application path is currently selected.
- Adds development/build dependencies needed for strict TypeScript generation, compilation, JSON Schema validation, tests, and packaging, subject to lockfile, license, vulnerability, and no-runtime-integration review.
- Reuses the canonical contract source, generated schema, catalog, policy, registry, ADR, and fixture artifacts without manually duplicating them.
- Establishes a public SDK API and package compatibility surface that will require versioning and migration governance.
- Planning artifacts alone authorize no implementation, production deployment, collection, infrastructure, or real-user processing. All implementation and governance tasks remain pending until apply.
