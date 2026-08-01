# ADR-SDK-008: Privacy transformations and extensions

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

A bounded recursive prohibited-data scan runs before hooks and again before sink handoff. Initialization-only transformation hooks are field-scoped, receive only declared values, cannot process prohibited values, and cannot overwrite canonical authority. Purpose/tenant-scoped keyed outputs carry non-secret version metadata. Post-hook schema, authority, privacy, and extension validation is mandatory.

Only version 1.0.0 registered extension namespaces and fields are typed and accepted. Unknown fields, oversized values, prohibited data, and canonical shadowing are rejected. No generic `Record<string, unknown>` extension escape hatch is public.
