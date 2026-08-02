# Compatibility and migration policy

This policy applies to `@bloodtrail/security-audit-sdk-core`. The package is currently a private, unpublished candidate at version `0.1.0`; this document defines compatibility rules without authorizing release or production use.

## Two independent version axes

1. **SDK package version** follows Semantic Versioning for the documented package exports, runtime behavior, generated public types, result/error behavior, and supported toolchain.
2. **Security Audit Event Contract version** governs canonical event structure and semantics through the separate `security-audit-event-contract` process.

An SDK version does not create or approve a contract version. The SDK implementation cannot silently change contract semantics.

## Current compatibility manifest

`compatibility.json` is the machine-readable source for this candidate's compatibility declaration:

- package: `@bloodtrail/security-audit-sdk-core` `0.1.0`;
- supported contract versions: exactly `1.0.0` (minimum and maximum are both `1.0.0`);
- normative contract target: `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993`;
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

## Configuration-ownership correctness fix

Configuration normalization now shallow-freezes the SDK-created normalized envelope and field-specifically copies/freezes SDK-owned plain values. Injected sinks, clocks, identifier providers, and transformation hooks are retained as the exact caller-owned objects. Their methods are invoked with the original receiver, and the SDK does not structurally clone or recursively freeze them or their nested mutable state.

The observable change is that an ordinary collaborator and its caller-owned arrays, maps, sets, queues, and counters no longer become frozen as a side effect of SDK construction. Code must not rely on the SDK to freeze an injected dependency; callers that require freezing remain responsible for doing so before injection and for ensuring their class supports it. Replacing a top-level configuration property after construction still does not replace the SDK's selected collaborator reference, and mutation of copied primitive/plain-value options still does not change normalized behavior. Transformation registration paths are copied at construction while each hook object retains its identity and class/private-field semantics.

This is a source-compatible patch-level correctness and ownership fix: no public export, declaration, error code, provider interface, canonical event interpretation, or contract version changes. The prior caller-object mutation contradicted the documented immutable-configuration boundary and could turn a valid mutable sink into delivery failure. The package remains private and unpublished at candidate `0.1.0`; this correction does not authorize release or production use.

## Contract-version upgrades

A contract semantic change requires the `security-audit-event-contract` governance lifecycle before SDK work. After a new contract version is approved, SDK adaptation must use a separate reviewed change that:

1. records the exact normative contract commit and supported version range;
2. regenerates types and validator from the new approved artifacts;
3. adds positive, negative, semantic, compatibility, and migration fixtures;
4. decides whether one SDK version can support both contract versions without ambiguity;
5. updates `compatibility.json`, provenance, exports if needed, and migration documentation;
6. rejects unsupported versions safely;
7. receives exact-commit SDK review without inferring contract or production approval.

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
