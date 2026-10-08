## Why

The quickstart's failed-login example currently asserts a server-authoritative human identity for a caller who never authenticated. It also gives that caller an actor identifier and a display name, in an event whose contract purpose is to record failed authentication without account enumeration. An evaluator who avoids that identity reaches two alternatives that type-check but fail only at runtime: a claimed identity from the submitted username is rejected with `AUTHORITY_ESCALATION`, and an anonymous actor with no tenant is rejected with `MISSING_TENANT_CONTEXT`.

## What Changes

- Correct the failed-login quickstart call to use the existing anonymous actor constructor and the existing tenantless tenant scope.
- State why a client-submitted username is a claim rather than an actor identity, and when a server-resolved tenant may replace the tenantless scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a bounded evaluator-document correction: it changes no capability requirement, package source, public API, constructor, brand, validation rule, or kit gate. The change therefore opts out of spec deltas.

## Impact

- `packages/security-audit-sdk-node/docs/quickstart.md` is the only file outside this change directory.
- The existing kit gate is unchanged and continues to run and type-check every quickstart TypeScript block; no check, control, or reviewed exception is added.
