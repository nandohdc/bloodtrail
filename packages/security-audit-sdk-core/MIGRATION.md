# Compatibility and migration policy

This policy applies to `@bloodtrail/security-audit-sdk-core`. The package is currently a private, unpublished candidate at version `0.4.0`; this document defines compatibility rules without authorizing release or production use.

## Two independent version axes

1. **SDK package version** follows Semantic Versioning for the documented package exports, runtime behavior, generated public types, result/error behavior, and supported toolchain.
2. **Security Audit Event Contract version** governs canonical event structure and semantics through the separate `security-audit-event-contract` process.

An SDK version does not create or approve a contract version. The SDK implementation cannot silently change contract semantics.

## Current compatibility manifest

`compatibility.json` is the machine-readable source for this candidate's compatibility declaration:

- package: `@bloodtrail/security-audit-sdk-core` `0.4.0`;
- supported contract versions: exactly `2.1.0` (minimum and maximum are both `2.1.0`);
- normative contract target: `74ccbcfd26a28c91fe6f98f8a066c8b25b883a3e`;
- Node.js: majors `24` and `26` only; exact verification releases `24.2.0` and `26.5.0`;
- TypeScript: `>=5.9.2 <6`; exact repository compiler `5.9.2`;
- module policy: ESM public package with an internal generated CommonJS standalone-validator boundary;
- package exports: `.` and `./testing` only.

Unsupported contract versions fail safely during initialization. The SDK does not guess, coerce, downgrade, or apply best-effort interpretation.

Production users must not assume a future SDK version remains compatible without checking the compatibility manifest, this migration policy, the package export map, and the exact contract binding.

## SDK Semantic Versioning

The following classifications apply once a release is authorized. During `0.x`, conservative consumers should still review every change as potentially breaking; the classifications remain the design rule for change review.

### Patch-compatible SDK changes

A patch may:

- fix an implementation defect while preserving version `1.0.0` canonical interpretation;
- tighten a safe diagnostic bound without changing existing stable code meaning;
- improve documentation or internal performance without observable semantic change;
- correct an internal implementation that previously rejected or accepted contrary to the already-governed contract, with explicit evidence that the canonical contract itself did not change.

A patch must not alter authority, requiredness, privacy, lifecycle, outcome, commit, causality, delivery-class, registry, or extension meaning.

### Minor-compatible SDK changes

A minor may:

- add an optional public helper that does not weaken existing paths;
- add an SDK-specific error code while preserving every existing code's meaning;
- add an optional package export only after explicit review;
- deprecate a public API while keeping it operational.

Additive generated fields or event APIs are not automatically minor: if they originate in canonical contract semantics, contract governance and the applicable contract-version migration are required first.

### Breaking SDK changes

A major is required for:

- removing or incompatibly changing a documented export, method, parameter, return type, lifecycle behavior, or sink result;
- making generated public types incompatible for the same supported contract;
- removing or changing the meaning/category of an existing SDK error code;
- removing a supported Node major or raising the minimum TypeScript version;
- changing ESM/package export policy;
- weakening validation or changing canonical interpretation.

A package major alone cannot authorize a canonical semantic change.

## Generated-type compatibility

Generated types are exact projections of the approved source, schema, catalog, field policies, and registries. They are public through the root export but remain generated artifacts:

- do not edit `src/generated/*`;
- run `npm run generate` and `npm run check:generated`;
- compare generated API and fixture behavior during SDK upgrades;
- classify a generated incompatibility as breaking package API unless it is part of a separately governed contract-version migration;
- do not infer runtime safety from successful TypeScript compilation.

Generated-code drift is a verification failure, not a migration mechanism. If canonical inputs and generated output differ, stop and determine whether the generator is stale or an unauthorized contract modification occurred.

## Error-code evolution

- Adding a new SDK-specific safe error code is minor when no existing case changes meaning.
- Deprecating a code is minor and must document its replacement and transition period.
- Removing a code, changing its category, or assigning its existing spelling to a different condition is breaking.
- Canonical contract error codes follow contract governance; the SDK cannot redefine them through package versioning.

The F-05/F-12 correction adds `SDK_INVALID_INPUT` and `FIELD_SERIALIZATION_FAILED` to the SDK registry without changing Security Audit Event Contract `1.0.0`. Callers with exhaustive error handling must add both cases. `BigInt`, cycles, and serialization failures previously misreported as `FIELD_LIMIT_EXCEEDED` now report `FIELD_SERIALIZATION_FAILED`; unsupported or unsafe function, symbol, accessor, Proxy, clone, host-object, or custom-prototype input reports `SDK_INVALID_INPUT`. Genuine measured size violations remain `FIELD_LIMIT_EXCEEDED`.

This is source-compatible and patch-level for exception safety, but the additive public codes are behaviorally observable and would ordinarily require a minor release under this package's error-code policy. The package remains private and unpublished at candidate version `0.1.0`, so this pass keeps the version unchanged. Constructors that already documented stable SDK-owned throws continue to throw `SecurityAuditSdkError`; result-returning APIs continue to return `AuditResult` and no public contract type changes.

## Deprecation

Deprecation requires:

1. documentation in the release notes and this migration file;
2. a supported replacement that preserves contract semantics;
3. no silent runtime behavior change in the deprecating release;
4. removal only in a package major, except for an explicitly governed urgent security correction.

There are no deprecated public APIs in candidate `0.1.0`.

## Operation-evidence security correction

Named-method operation inputs no longer accept `GeneratedOperationContext` structural values. Consumers must retain the exact `AuditOperationHandle` returned by `beginOperation()`, apply terminal state through its sanctioned methods, and pass that same handle to a named method on the same SDK instance. `snapshot()` output is observational and cannot be passed back as trusted evidence. Plain objects, object spreads, manual copies, `structuredClone`, JSON round trips, fake handles, and cross-instance handles are rejected before sink invocation.

This is a source-level breaking API tightening because previously accepted TypeScript literals and generated input values containing structural `operation` data no longer type-check. If applied to a published stable package, it requires a major version. The package remains private and unpublished in initial-development candidate `0.1.0`, so this governed correction does not create a release or change the package version in this pass; any future release decision must account for the breaking migration explicitly. Contract `1.0.0`, canonical event representation, generic `emit()`/`redeliver()` trusted-producer behavior, and existing error-code registry remain unchanged. Invalid or foreign evidence uses the existing `SDK_INVALID_OPERATION_TRANSITION` lifecycle code at `/operation`; premature same-instance success remains `PREMATURE_SUCCESS`, and binding mismatch remains `SDK_OPERATION_EVENT_MISMATCH`.

## Complete-event redelivery and named-binding correction

Public `emit(event)` and `redeliver(event)` retain their single-argument `SecurityAuditEvent` signatures and root exports. `redeliver(event)` continues to accept a complete canonical event from a trusted caller, including a complete structural clone or an event generated by another SDK instance. It now has an explicit internal `pure_redelivery` intent, revalidates every call, preserves identity, timestamps, and all canonical metadata, and avoids caller mutation, identifiers, clocks, transformations, generated-ID history, and terminal-completion state. Repeated valid calls each invoke the sink once.

A named method receiving `redelivery.event` no longer takes the prior unchecked early return. It validates the complete canonical event, enforces fixed event/catalog/schema metadata, and, when an operation handle is supplied, enforces exact method/event and operation/transaction/correlation binding. Named retry/re-execution remains ordinary named execution: it generates a new event ID, retains required original-event and causation relationships, uses exact operation authority plus terminal reservation/completion semantics, and runs valid configured transformations.

F-11 adds no `SDK_INVALID_REDELIVERY` or other error code. Unsafe or unsupported input uses `SDK_INVALID_INPUT` or `FIELD_SERIALIZATION_FAILED`; structural and semantic defects retain `SDK_SCHEMA_VALIDATION_FAILED` or the applicable contract code; fixed catalog mismatch uses `UNKNOWN_CATALOG_VALUE`; schema mismatch uses `UNSUPPORTED_SCHEMA_VERSION`; operation binding mismatch uses `SDK_OPERATION_EVENT_MISMATCH`; sink rejection uses `SDK_SINK_REJECTED`; sink `unknown`, throw, or rejected promise uses `SDK_SINK_FAILURE`; shutdown uses `SDK_SHUTTING_DOWN` or `SDK_SHUT_DOWN`.

The public complete-event model is source-compatible. Tightened named-redelivery validation and binding are a behaviorally observable security/lifecycle correction that would require explicit release notes for a published package. This private unpublished candidate remains `0.1.0`; contract `1.0.0`, package exports, runtime dependencies, and package publication state are unchanged. The correction adds no same-instance event brand, provenance ledger, automatic retry, queue, persistence, broker, transport, collector, durability guarantee, production authorization, or publication authorization.

## Configuration-ownership correctness fix

Configuration normalization now shallow-freezes the SDK-created normalized envelope and field-specifically copies/freezes SDK-owned plain values. Injected sinks, clocks, identifier providers, and transformation hooks are retained as the exact caller-owned objects. Their methods are invoked with the original receiver, and the SDK does not structurally clone or recursively freeze them or their nested mutable state.

The observable change is that an ordinary collaborator and its caller-owned arrays, maps, sets, queues, and counters no longer become frozen as a side effect of SDK construction. Code must not rely on the SDK to freeze an injected dependency; callers that require freezing remain responsible for doing so before injection and for ensuring their class supports it. Replacing a top-level configuration property after construction still does not replace the SDK's selected collaborator reference, and mutation of copied primitive/plain-value options still does not change normalized behavior. Transformation registration paths are copied at construction while each hook object retains its identity and class/private-field semantics.

This is a source-compatible patch-level correctness and ownership fix: no public export, declaration, error code, provider interface, canonical event interpretation, or contract version changes. The prior caller-object mutation contradicted the documented immutable-configuration boundary and could turn a valid mutable sink into delivery failure. The package remains private and unpublished at candidate `0.1.0`; this correction does not authorize release or production use.

## Transformation-path construction validation

Transformation-hook paths are now validated once during SDK construction against the same internal transformability predicate the runtime pipeline enforces. A registration is accepted only when its path appears in the canonical field policy with a transform-eligible policy (`transform_required` or `conditionally_allowed`) and does not target immutable event, schema, tenant-scope, authorization-decision, delivery-class, or trust-level fields. Field-policy permission alone is not sufficient.

The observable change is that a hook configuration for an intrinsically unsupported path — for example `event.outcome_reason.code` or `event.outcome_reason.message`, which the field policy marks conditionally allowed but the runtime never transforms — previously constructed successfully and then failed every event with `SDK_HOOK_FAILURE`, and now fails once at construction with the existing bounded `SDK_INVALID_CONFIGURATION` at `/transformations/<index>/path`. Consumers must remove or correct such registrations; no valid transformable path is affected, hook invocation timing is unchanged for accepted registrations, and hooks are never invoked during construction.

This is a patch-level correctness and reliability correction: no public export, declaration, error code, hook-path type, canonical event interpretation, or contract version changes, and runtime path enforcement remains as defense in depth. The package remains private and unpublished at candidate `0.1.0`; this correction does not authorize release or production use.

## Bounded identity-retention configuration

Generated event-ID and issued operation-ID reuse detection now uses two independent, SDK-instance-local, count-bounded FIFO histories instead of identifier sets that grew for the process lifetime. Capacities come from the new optional `retention.recentGeneratedEventIds` and `retention.recentIssuedOperationIds` options, which default independently to `4096` and accept only finite positive safe integers up to the hard maximum `100000`. Invalid capacities — zero, negative, fractional, `NaN`, infinite, string, `BigInt`, above the maximum, accessor-backed, array, custom-prototype, or unknown nested `retention` keys — fail construction with the existing bounded `SDK_INVALID_CONFIGURATION` at `/retention` or the applicable nested path. Values are rejected, never clamped. Terminal-operation completion state moved to storage weakly keyed by the SDK-issued `AuditOperationHandle`, so releasing the last reference to a handle no longer keeps it alive solely for SDK deduplication.

The observable change is the horizon. Each history is insertion-order FIFO: membership reads and duplicate insertions do not refresh age, and a distinct insertion at capacity evicts the oldest retained identifier. Consumers that relied on the previous effectively permanent, process-lifetime local duplicate memory now receive a shorter guarantee — once an identifier is evicted it is outside that instance's local duplicate knowledge and may be accepted again if every other validation, authority, lifecycle, and sink rule passes. Size each window for the local workload; a value near the maximum trades bounded memory for a longer collision window. The SDK does not claim guaranteed 24-hour retention, fail-closed overflow, permanent rejection after eviction, durable replay prevention, distributed or cross-process deduplication, or restart-resistant identity history. Any of those requires separately governed durable identity-retention infrastructure.

The two FIFO windows are collision-detection horizons only. They never grant operation authority, restore a copied or forged handle, bypass event binding, or evict an active reservation or a completed terminal-duplicate guard: that state lives with the live handle and survives unrelated retention churn for the handle's lifetime. Redelivery does not insert generated event IDs, consume issued operation-ID capacity, or reserve or release terminal completion, so repeated redelivery cannot exhaust either window.

No migration is required for callers that omit `retention`, because both defaults apply automatically and the option is additive and optional. Callers that supply `retention` must ensure each capacity is a positive safe integer no greater than `100000`, since an out-of-range or malformed value now fails initialization rather than being ignored or clamped. Under this package's Semantic Versioning policy the additive optional configuration is minor, but the narrowed local duplicate-detection horizon is behaviorally observable and would require explicit release notes — and a documented sizing recommendation — for a published package. No public export, error code, provider interface, canonical event interpretation, or contract version changes; contract `1.0.0`, package exports, and runtime dependencies are unchanged. The package remains private and unpublished at candidate `0.1.0`; this correction does not authorize release or production use.

## Contract 1.1.0 provenance transition

Candidate `0.2.0` replaces its exact contract baseline with `1.1.0`; callers must update the construction literal from `"1.0.0"` to `"1.1.0"`. The contract adds optional `risk.model.provenance.derived_from` for code-point-ordered material input paths of `derived_server` risk models. Existing events that omit the field remain valid. Supplied paths are rejected when malformed, duplicated, unordered, unresolvable, absent from the event, non-derived, or cyclic. This candidate remains private and unpublished and does not authorize release or production use.

## Contract 2.0.0 trust-floor enforcement

Candidate `0.3.0` replaces its exact contract baseline with `2.0.0`; callers must update the construction literal from `"1.1.0"` to `"2.0.0"`. This is breaking. Every event carrying `risk` must now carry both `risk.model.provenance.trust_level` and `risk.model.provenance.derived_from`; omitting either fails with `DERIVED_FROM_MISSING`. The declared level may be `derived_server` or any less trusted level, but never more trusted than the least trusted listed input, whose trust is the contract's declared trust for that path — a violation fails with `DERIVED_FROM_TRUST_FLOOR_EXCEEDED` at `/risk/model/provenance/derived_from/<index>`. Levels above `derived_server` fail with `DERIVED_FROM_NON_DERIVED`, and any input under `risk` fails with `DERIVED_FROM_CYCLE`. A producer whose risk model reads a `client_claim` input declares `client_claim` rather than being unable to emit. This candidate remains private and unpublished and does not authorize release or production use.

## Contract 2.1.0 client-evidence reference

Candidate `0.4.0` replaces its exact contract baseline with `2.1.0`; callers must update the construction literal from `"2.0.0"` to `"2.1.0"`, and `"2.0.0"` now fails with `SDK_UNSUPPORTED_CONTRACT_VERSION`. The contract adds an optional, closed `client_evidence` reference: a lowercase UUID v4 `interaction_id`, one of eight `interaction_kind` values, `envelope_version` `1`, and provenance fixed to `client_reported`, `client_claim`, `web_browser`, and `interaction_ephemeral`. Events that omit it remain valid and mean nothing by its absence. The generated event type gains the optional member; this candidate's builders do not populate it, because mapping a validated client envelope into the reference is separate governed work. A risk model that lists `client_evidence.interaction_id` as a material input is floored at `client_claim`. This candidate remains private and unpublished and does not authorize release or production use.

## Contract-version upgrades

A contract semantic change requires the `security-audit-event-contract` governance lifecycle before SDK work. An additive contract-minor version remains contract-minor on that independent version axis. After a new contract version is approved, SDK adaptation must use a separate reviewed change that preserves `EXACT_ONE`:

1. record the exact normative contract commit and the one canonical contract version the adapting SDK package version will support;
2. classify replacement of the package's sole supported-contract baseline and public contract-version literal as SDK compatibility-major, without reclassifying the canonical contract change;
3. while the private unpublished package remains in `0.x`, express that classification through the project's `0.x` policy only if a release is separately authorized; the first published release inherits the classification, and from `1.0.0` onward baseline replacement requires an SDK major;
4. regenerate the public types and validator as one exact projection of the newly approved artifacts;
5. add positive, negative, semantic, compatibility, and migration fixtures for the new sole baseline;
6. update `compatibility.json`, provenance, exports if needed, and migration documentation so the complete package compatibility surface names that same one version;
7. reject every other contract version safely before readiness, without negotiation, coercion, downgrade, fallback, best-effort interpretation, or live switching; and
8. receive exact-commit SDK review without inferring contract, release, collector, or production approval.

The adapting producer package does not retain the previous contract version alongside the new one. Several SDK package versions may continue to support the same contract version, but each package version supports exactly one. A separately authorized collector MAY bridge migration using an explicitly enumerated finite version set; that collector policy neither broadens producer support nor authorizes a collector or any production integration. Reconsidering multi-version producer support requires both a second canonical contract version and an authorized collector, through a new governed change.

The compatibility-major classification does not itself create a package release, select a concrete version number, or change the current candidate version.

SDK migration and schema/contract migration are distinct. Changing an SDK call site does not migrate stored or in-flight canonical events, and changing a schema does not automatically migrate application integration.

## Node.js and TypeScript changes

Only Node 24 and 26 are supported. Node 25 and any unlisted major are unsupported even if the `>=24` numeric relation might otherwise suggest compatibility. The package `engines` expression and manifest encode the exact major set.

Dropping Node 24 or 26 is a breaking SDK change. Adding a Node major requires exact runtime evidence and a manifest update. Raising the TypeScript minimum above `5.9.2` is breaking because public generated declarations are part of the compatibility surface. TypeScript versions outside `>=5.9.2 <6` are untested and unsupported.

## Package-export stability

Supported imports are exactly:

- `@bloodtrail/security-audit-sdk-core`;
- `@bloodtrail/security-audit-sdk-core/testing`.

Imports from `dist/*`, `src/*`, generated validator files, validation internals, or undeclared subpaths are unsupported. Adding an export is at least minor; removing or incompatibly changing one is major. The `./testing` export remains explicitly non-production even when its shape is stable.

## Consumer migration checklist

For any future SDK update:

1. read the new `compatibility.json` and verify the exact contract version/range;
2. confirm the application's Node and TypeScript versions remain supported;
3. inspect package exports and generated declaration changes;
4. review error-code additions, deprecations, removals, and meaning changes;
5. regenerate compile-time fixtures and run all runtime/negative semantic tests;
6. check authority-provider, tenant/resource, privacy, operation, causality, sink, and lifecycle behavior;
7. confirm no generated drift and no hidden contract modification;
8. review package contents, runtime dependencies, lockfile, licenses, and audit results;
9. obtain any separately required package-release, application-integration, privacy, production, and delivery authorization.

No future SDK compatibility statement grants production deployment, event collection, real-user processing, framework instrumentation, transport/collector use, reliable delivery, storage/SIEM, or legal approval.
