## 1. Contract baseline and architecture decisions

- [x] 1.1 Record Contract Commit A `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993`, contract version `1.0.0`, canonical capability path, and authoritative source/schema/catalog/policy/registry/fixture paths in the SDK package provenance manifest.
- [x] 1.2 Add a guard that fails if implementation modifies `openspec/specs/security-audit-event-contract/spec.md`, the archived contract change, or canonical version 1.0.0 semantics instead of proposing a separate versioned contract change.
- [x] 1.3 Complete ADR-SDK-001 for package path/name, ESM and exports policy, Node 24/26 support matrix, exact CI runtime versions, strict TypeScript baseline, and compatibility consequences.
- [x] 1.4 Complete ADR-SDK-002 for canonical type generation inputs, generator ownership, event-specific discriminants, deterministic output, drift checks, and source/schema/catalog cross-checks.
- [x] 1.5 Complete ADR-SDK-003 for the pinned Draft 2020-12 engine, strict mode and formats, standalone versus runtime dependency, generated validator packaging, conformance evidence, and correctness-over-zero-dependency fallback.
- [x] 1.6 Complete ADR-SDK-004 for configured authority providers, claimed and observed context, runtime provenance, TypeScript branding, `AsyncLocalStorage` inheritance/override/isolation, and producer-truth limitations.
- [x] 1.7 Complete ADR-SDK-005 for result-versus-exception behavior, safe error registry, bounded paths/metadata, dependency and sink cause handling, serialization, and error-code compatibility.
- [x] 1.8 Complete ADR-SDK-006 for immutable initialization, lifecycle states, in-flight shutdown policy and timeout, transport-neutral sink result semantics, included test sinks, and exclusion of console/file and production sinks.
- [x] 1.9 Complete ADR-SDK-007 for transaction-aware operation states, trusted commit transitions, authorization/outcome separation, asynchronous completion, retry/redelivery IDs, sink failure after commit, and explicit non-atomicity.
- [x] 1.10 Complete ADR-SDK-008 for prohibited-data pre/post scans, field-scoped transformations, purpose/tenant key scope, metadata, extension typing, and canonical authority override prevention.
- [x] 1.11 Complete ADR-SDK-009 for SDK SemVer versus contract version 1.0.0, public/generated API changes, error-code evolution, Node/TypeScript support, migration, and unsupported contract behavior.
- [x] 1.12 Verify all nine ADRs are internally coherent with the capability spec and accepted before marking dependent implementation tasks complete; record that ADR acceptance is not production authorization.

## 2. Isolated package scaffolding and dependency posture

- [x] 2.1 Create the isolated `packages/security-audit-sdk-core` ESM TypeScript package named `@bloodtrail/security-audit-sdk-core` without modifying a production application.
- [x] 2.2 Add strict build, test, type-test, generate, generated-drift, validate, package-export, compatibility, audit, and complete verification scripts.
- [x] 2.3 Configure a public exports map that exposes only documented SDK entry points and prevents imports of internal generated, raw assembly, unchecked sink, and validator implementation modules.
- [x] 2.4 Pin all build/test dependencies and lockfile versions; document each dependency's purpose, license, runtime/development classification, integrity, and vulnerability posture.
- [x] 2.5 Prove that runtime dependencies are empty when standalone schema validation is selected, or include only the exact ADR-approved standards-compliant validator dependency if correctness requires it.
- [x] 2.6 Add Node 24 and Node 26 compatibility configuration with exact versions and strict TypeScript/module-resolution settings from ADR-SDK-001.
- [x] 2.7 Add source/package scope checks that reject framework, transport/exporter, collector, broker/queue/outbox, storage, SIEM, analytics/detection, browser telemetry, instrumentation, cryptographic-chain, and diagnostic-logging implementations or dependencies.

## 3. Deterministic canonical generation

- [x] 3.1 Implement a deterministic generator that reads the approved canonical source plus generated schema, catalog, policy, and registries and rejects version/provenance disagreement.
- [x] 3.2 Generate canonical event structures, controlled string unions/constants, event-name discriminants, and contract version metadata with generated-file headers and no timestamps.
- [x] 3.3 Generate event-specific builder input types for all 24 catalog entries, including required and conditionally required contexts, allowed lifecycle/outcome/commit combinations, and fixed minimum delivery class.
- [x] 3.4 Generate actor, subject, authenticated principal, credential reference, delegation/impersonation, tenant, resource, authentication, authorization, request, correlation, data, integrity, and registered extension types from canonical metadata.
- [x] 3.5 Generate canonical and SDK error-code constants with separately governed namespaces and no manually maintained duplicate registry.
- [x] 3.6 Generate or package the strict Draft 2020-12 standalone validator according to ADR-SDK-003 and prove it compiles on every supported Node runtime.
- [x] 3.7 Implement `--check` byte-drift mode with stable sorting/newlines and tests proving two unchanged generation runs are byte-identical.
- [x] 3.8 Add cross-checks proving all 24 catalog entries and every canonical/extension field, registry value, privacy assignment, authority category, and delivery class are represented in generated SDK metadata.
- [x] 3.9 Add strict compile-time positive and expected-error fixtures proving generated discriminants, required fields, controlled values, and extension rules correspond to contract version 1.0.0.

## 4. Initialization, public API, clock, and identifiers

- [x] 4.1 Implement immutable configuration cloning, normalization, validation, and freezing for contract version, producer, service, environment, deployment, authority providers, transformations, sink, clock, and identifiers.
- [x] 4.2 Reject missing configuration, unsupported contract/schema version, invalid provider/hook/sink shapes, and unsafe defaults before the SDK becomes ready.
- [x] 4.3 Implement the documented public SDK factory and result/error types while keeping raw canonical assembly and unchecked sink invocation internal.
- [x] 4.4 Implement trusted default occurrence/observation clocks and collision-resistant event, operation, correlation, causation, request, message, and transaction identifier providers using supported Node APIs.
- [x] 4.5 Implement fixed initialization-time clock and identifier injection for deterministic testing and reject malformed, invalidly reused, or contract-incompatible provider output.
- [x] 4.6 Deep-clone and freeze configuration, context frames, intermediate authoritative values, and validated output so caller mutation cannot change post-validation behavior.
- [x] 4.7 Add package export and JavaScript/untyped-use tests proving public imports work and internal subpaths remain inaccessible.

## 5. Authority-specific context builders

- [x] 5.1 Implement distinct actor, subject, authenticated-principal, service/workload, credential-reference, delegation, and impersonation builders with canonical provenance and trust validation.
- [x] 5.2 Implement client/request claim builders that can never produce authenticated or server-authoritative branded/runtime values without an ADR-approved configured authority result.
- [x] 5.3 Implement actor/effective/claimed/parent/resource-owning tenant and tenantless/platform/cross-tenant context builders using distinct canonical fields.
- [x] 5.4 Implement authoritative resource builders that preserve type, stable ID, owning tenant, parent, data classification, and action/operation vocabulary.
- [x] 5.5 Implement authentication/session evidence builders and authorization decision/policy/enforcement builders without accepting raw credentials or inferring authorization from outcome or HTTP status.
- [x] 5.6 Implement request/message, observed source/destination, service/workload, environment, deployment, data, risk, retention, delivery, integrity, and correlation context builders with their exact authority boundaries.
- [x] 5.7 Add runtime branding/provenance checks that detect TypeScript casts or JavaScript objects attempting to relabel client claims as authenticated identity, authoritative tenant/resource ownership, or authorization evidence.
- [x] 5.8 Add cross-validation for actor, effective, authorization, and resource-owning tenants; require explicit authoritative cross-tenant/platform context and reject caller-claimed authorization.

## 6. Async context propagation

- [x] 6.1 Implement `AsyncLocalStorage` context frames with explicit immutable slots for principal, actor/delegation, tenant, session/authentication, request/message, trace/span, correlation/causation, operation/transaction, workload/service, environment, and deployment.
- [x] 6.2 Implement explicit context-scope entry, allowed inheritance, field-specific override, nested restoration, and no-context behavior without fabricating identity, tenant, trace, or request values.
- [x] 6.3 Preserve incoming trace/request values as correlation or claimed/observed context and prevent their use as authentication, authorization, or authoritative tenant evidence.
- [x] 6.4 Add concurrency tests proving overlapping requests cannot leak actor, tenant, session, authorization, operation, or correlation state.
- [x] 6.5 Add nesting, exception, promise, timer, and supported asynchronous-boundary tests proving context restoration and documenting boundaries where explicit propagation is required.
- [x] 6.6 Add missing-authoritative-context tests for each event-specific requirement and verify safe errors omit the unavailable or rejected raw input.

## 7. Cataloged event builders

- [x] 7.1 Implement generated named SDK methods for all 24 contract version 1.0.0 events and verify exact one-to-one catalog coverage.
- [x] 7.2 Derive event name, category, action, schema identity/version, lifecycle constraints, and minimum delivery class from generated catalog metadata; expose no caller override path.
- [x] 7.3 Implement event-specific required/conditional context validation for account, authentication/MFA/session/password-reset, authorization/role/privilege, impersonation, sensitive-resource/data, configuration, and tenant-violation events.
- [x] 7.4 Implement a lower-level generated discriminated-union builder only if ADR-SDK-002 approves it; reject arbitrary strings, actions, schema versions, delivery classes, and generic object escape hatches.
- [x] 7.5 Implement canonical candidate assembly that omits unavailable optional values, never fabricates placeholders, and preserves actor/subject/principal/credential/delegation distinctions.
- [x] 7.6 Validate and deep-freeze every event before invoking the sink exactly once; prevent any internal or test path from representing unvalidated input as emitted SDK output.
- [x] 7.7 Add named builder tests for every event, including required/conditional omissions, actor types, tenant scopes, lifecycle/outcome combinations, and cataloged delivery classes.

## 8. Operation, transaction, retry, and causality model

- [x] 8.1 Implement the ADR-SDK-007 monotonic operation state machine for started, committed, not-committed, partially committed, and compensated states with safe invalid-transition errors.
- [x] 8.2 Implement trusted `markCommitted`, `markNotCommitted`, `markPartiallyCommitted`, and `markCompensated` transitions without database introspection, outbox behavior, or atomic durability claims.
- [x] 8.3 Implement success/failure/partial/cancelled/compensation emission APIs that keep authorization decision, operation outcome, lifecycle phase, and commit state independent.
- [x] 8.4 Reject success emission before required commit state and prove the sink is not called on premature success.
- [x] 8.5 Preserve stable operation/transaction/correlation identity while assigning a distinct immutable event ID to each new occurrence.
- [x] 8.6 Implement pure-redelivery identity preservation and re-execution retry relationships; require original-event identity for positive retry attempts.
- [x] 8.7 Require causation and original-event identity for catalog entries whose asynchronous completion semantics need them; reject self-causation and missing links.
- [x] 8.8 Add tests for allow-plus-operation-failure, denied-versus-failure, commit then sink failure, partial commit, compensation, retry, redelivery, re-execution, fan-out, and asynchronous completion.

## 9. Runtime validation, privacy, transformations, and extensions

- [x] 9.1 Implement the ordered validation pipeline: bounded normalization, recursive prohibited-data scan, field-scoped transformations, canonical assembly, Draft 2020-12 validation, semantic validation, final scan/freeze, and sink handoff.
- [x] 9.2 Enforce exact schema version, structural bounds, catalog membership, every controlled registry, event-specific fields, authority/provenance, tenant/resource consistency, lifecycle/outcome/commit, causality/retry, and delivery assignment.
- [x] 9.3 Implement cycle, unsupported-prototype, depth, item-count, string/byte, and object-shape guards before recursively processing untrusted input.
- [x] 9.4 Reject passwords, verifier material, raw tokens, API/private keys, cookies, recovery/factor contents, payment-card data, connection strings, full bodies, arbitrary serialized objects, and raw secrets before hooks, errors, or sinks can observe them.
- [x] 9.5 Implement initialization-only field-scoped redaction/transformation hooks with minimal input, bounds, deterministic behavior where required, privacy-policy association, and post-hook authority/prohibited-data validation.
- [x] 9.6 Implement purpose- and tenant-scoped keyed transformation metadata without exposing keys or representing plain hashes of guessable identifiers as adequate pseudonymization.
- [x] 9.7 Implement only registered version 1.0.0 extension namespaces/fields and reject unknown extensions, oversize values, prohibited data, trust escalation, and canonical shadowing.
- [x] 9.8 Reuse every approved positive fixture and negative fixture directly, preserving expected interpretation and exact safe rejection codes without copying or editing fixture semantics.
- [x] 9.9 Add tests proving compile-time typing, runtime SDK validation, CI fixture/compatibility checks, and downstream ingestion responsibilities remain distinct.

## 10. Safe errors, sink abstraction, and lifecycle

- [x] 10.1 Implement the ADR-SDK-005 safe public error/result model with stable codes, bounded paths/categories, and no raw value, full event, payload, unbounded cause, or stack in serialized output.
- [x] 10.2 Cover invalid configuration, unsupported version, missing authority/context/field, registry, authority escalation, tenant-resource conflict, schema/semantic, prohibited data, extension, premature success, causality, sink failure, and shutdown errors.
- [x] 10.3 Implement the immutable transport-neutral `AuditEventSink` and bounded accepted/rejected/unknown result model while preserving event ID and cataloged delivery class.
- [x] 10.4 Implement in-memory and capturing test sinks with deterministic capture and failure injection, no network/filesystem behavior, and no durability/delivery claim.
- [x] 10.5 Exclude console and file sinks unless a separately reviewed in-scope ADR amendment justifies conspicuous non-production behavior and complete privacy controls.
- [x] 10.6 Implement ready, shutting-down, and shut-down lifecycle states, a documented no-new-emissions boundary, tracked in-flight calls, bounded wait, ordered optional flush/shutdown at most once, shared concurrent shutdown, and safe `SDK_SHUT_DOWN` results for lifecycle calls after shutdown.
- [x] 10.7 Sanitize thrown/rejected sink causes and test unbounded, secret-bearing, cyclic, and hostile error objects without leaking their content.
- [x] 10.8 Add sink accepted/rejected/unknown, post-commit sink failure, shutdown race, timeout, duplicate shutdown, and after-shutdown emission tests without claiming durable handoff.

## 11. Complete verification and compatibility evidence

- [x] 11.1 Add one reproducible complete verification command covering generation, strict compilation, type tests, runtime tests, fixtures, package exports, compatibility, dependency/audit, OpenSpec, whitespace, and exact scope.
- [x] 11.2 Run and record all 24 approved positive fixtures through the standards-compliant schema engine and SDK semantic boundary.
- [x] 11.3 Run every approved negative fixture and assert its exact bounded safe code, path limit, and absence of secret markers in serialized diagnostics.
- [x] 11.4 Add package API and generated-type compatibility fixtures for patch/minor/major changes, error-code additions/removals, Node/TypeScript support, and unsupported contract versions.
- [x] 11.5 Add Node 24 and 26 execution evidence and strict TypeScript compile-time evidence without claiming untested runtime/compiler compatibility.
- [x] 11.6 Add dependency license, lockfile integrity, vulnerability, runtime dependency, package content, and no-production-implementation evidence.
- [x] 11.7 Add exact changed-path and import/dependency scans proving no framework middleware, exporter/transport, collector, broker/queue/outbox, storage, SIEM, analytics/detection, browser telemetry, production instrumentation, cryptographic chain, or diagnostic logging was implemented.
- [x] 11.8 Verify the canonical contract capability, archived change, Contract Commit A technical artifacts, and approved fixtures were not modified except through a separately approved genuine contract correction.
- [x] 11.9 Run a terminology and cross-artifact semantic-coherence sweep across proposal, design, spec, ADRs, package API, generated code, validator, tests, and documentation; resolve contradictions rather than relying on structural validation.

## 12. Documentation and migration policy

- [x] 12.1 Document installation, supported Node/TypeScript versions, ESM imports, immutable initialization, authority-provider responsibilities, context propagation, named builders, operation model, validation, errors, sinks, lifecycle, and deterministic testing.
- [x] 12.2 Document client-claim, tenant/resource, credential/secret, authorization/outcome, commit, causality/retry, transformation, extension, and producer-truth security boundaries with misuse examples.
- [x] 12.3 Document SDK/package SemVer relative to contract version 1.0.0, generated API changes, error-code evolution, Node/TypeScript support changes, unsupported versions, and distinct SDK-versus-schema migration.
- [x] 12.4 Document that SDK validation is not producer truthfulness, ingestion acceptance, delivery, durability, legal compliance, non-repudiation, production authorization, or permission to process real-user data.
- [x] 12.5 Document follow-on change boundaries for framework adapters, production transport/exporters, reliable delivery/outbox, application instrumentation, storage/SIEM, analytics/detection, cryptographic chaining, and real-user privacy/legal approval.

## 13. Read-only technical verification

- [x] 13.1 Perform a read-only verification of package architecture, generated types, public API, authority/context model, builders, operation state, validation, privacy, extensions, errors, sinks, lifecycle, compatibility, documentation, and production-scope exclusions before staging.
- [x] 13.2 Run the complete verification command, strict OpenSpec validation, Git whitespace/final-newline checks, generated-artifact drift, npm audit, package content checks, and exact changed-path review with an empty index.
- [x] 13.3 Review every checked technical task against repository evidence and report unsupported completion, contract conformance, production authorization, commit readiness, merge readiness, and archive readiness separately.
- [x] 13.4 Confirm technical commit readiness only if no blocking finding exists; keep owner review, final decision, production deployment, collection, and archive states explicitly pending.

## 14. Exact-commit SDK review and authorization boundary

- [ ] 14.1 Commit and push the verified SDK implementation separately from proposal and governance records, capture the exact implementation commit, and verify the remote/PR head before requesting review.
- [ ] 14.2 Prepare an SDK-core review packet naming the exact implementation commit, Contract Commit A and version 1.0.0 binding, public/generated APIs, validation/context/operation behavior, dependencies, tests, unresolved decisions, scope, and assurance limitations without pre-populating a decision.
- [ ] 14.3 Obtain and record explicit project-owner feedback on the exact SDK implementation commit; do not treat AI verification, checked tasks, PR state, assignment, or informal messages as approval.
- [ ] 14.4 Resolve review findings, rerun complete read-only verification, and obtain explicit exact-commit reconfirmation after any public API, generated type, validation, authority/privacy, sink, dependency, test, or authorization-boundary change.
- [ ] 14.5 Obtain the project owner's explicit final SDK-core decision and state whether reusable package implementation/publication is authorized; preserve the self-review assurance limitation.
- [ ] 14.6 State explicitly that SDK-core approval does not authorize production deployment, production event collection, real-user data processing, framework instrumentation, collectors/transports, queue/outbox infrastructure, storage, SIEM, analytics, or production delivery policy.
- [ ] 14.7 Complete the final lifecycle-status sweep, reach 100% tasks only with supported records, verify live PR head/checks/mergeability, merge, and archive in a separate commit according to the governed workflow.
