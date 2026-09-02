## Why

Authority brands are currently scoped by a module-private `context.ts` registry, but that scope is an implementation consequence rather than a recorded requirement. The project owner selected bounded module-copy scope with a single-copy Core (option C) on 2026-08-23; the choice must become a reviewable, testable SDK requirement before dependent authority-scope, duplicate-diagnostic, and Core-extraction work proceeds.

## What Changes

- Ratify option C: brands are scoped to the `context.ts` module copy, while a supported consumer graph must resolve Core to exactly one module instance.
- Make forge resistance, same-copy cross-instance acceptance, cross-copy fail-closed behavior, and the distinct duplicate-Core diagnostic ownership of #79 explicit requirements.
- Require #86 to prove a duplicated-Core fixture fails closed, its non-duplicate null control passes, and the strict runtime-dependency rule permits only an allowlisted first-party Core dependency while continuing to reject third-party runtime dependencies.
- Extend ADR-SDK-004 and add root ADR 0010 for the settled A/B/C analysis; preserve the 11-ADR SDK sequence and do not create a twelfth SDK ADR.
- Preserve the current runtime, generated artifacts, package surface, frozen canonical contract, #79 issue body, and all production/real-user-data exclusions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Make authority-brand scope, supported-graph Core uniqueness, fail-closed cross-copy behavior, and bounded dependency-proof obligations normative.

## Impact

This is a Full-assessment, material modification of the `security-audit-sdk-core` capability triggered by `security_sensitive_behavior`, although its proposal and authorized materialization are prose, specification, and verification-plan work. The future apply phase affects the existing SDK authority ADR, `docs/adr/0010-sdk-core-authority-scope.md`, the capability spec, and tasks for #86; it does not authorize #78 implementation, a #79 issue-body rewrite, any registry relocation, a global singleton, or production transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, or audit-log chaining work.
