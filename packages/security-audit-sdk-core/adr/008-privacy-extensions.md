# ADR-SDK-008: Privacy transformations and extensions

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

A bounded recursive prohibited-data scan runs before hooks and again before sink handoff. Initialization-only transformation hooks are field-scoped, receive only declared values, cannot process prohibited values, and cannot overwrite canonical authority. Purpose/tenant-scoped keyed outputs carry non-secret version metadata. Post-hook schema, authority, privacy, and extension validation is mandatory.

Hook-path compatibility is decided once during configuration normalization (F-10). Construction accepts a transformation path only when the shared internal transformability predicate accepts it: the path must appear in the generated field policy with `transform_required` or `conditionally_allowed` policy and must not target immutable event, schema, tenant-scope, authorization-decision, delivery-class, or trust-level fields. Field-policy permission alone is not sufficient; an intrinsically unsupported path fails initialization with the existing bounded `SDK_INVALID_CONFIGURATION` before any SDK instance, hook invocation, or sink call exists. Runtime path enforcement remains as defense in depth, and dynamic hook results keep their existing bounded runtime failures.

Only version 1.0.0 registered extension namespaces and fields are typed and accepted. Unknown fields, oversized values, prohibited data, and canonical shadowing are rejected. No generic `Record<string, unknown>` extension escape hatch is public.
