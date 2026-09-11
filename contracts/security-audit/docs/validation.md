# Validation

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

| Layer | Responsibility |
| --- | --- |
| contract_authoring | meta-schema, registry references, collisions, field policy coverage, catalog completeness |
| type_generation_compile_time | deterministic TypeScript types and constants for developer feedback only |
| producer_runtime | structural schema, catalog, lifecycle, authority, tenant/resource, privacy, bounds before enqueue |
| ci | schemas, generated drift, examples, negative fixtures, mapping fixtures, compatibility |
| ingestion | authenticated producer, version, duplicate identity, revalidation, prohibited content, transport conflict |
| downstream | supported-version gate, provenance preservation, tenant access, mapping-loss awareness |

Validation error codes:

- MISSING_REQUIRED_ACTOR
- MISSING_TENANT_CONTEXT
- TENANT_RESOURCE_CONFLICT
- UNKNOWN_CATALOG_VALUE
- UNSUPPORTED_SCHEMA_VERSION
- PROHIBITED_DATA
- FIELD_LIMIT_EXCEEDED
- AUTHORITY_ESCALATION
- PREMATURE_SUCCESS
- AUTHORIZATION_OUTCOME_CONFLICT
- BAD_CAUSALITY
- INVALID_DELEGATION
- UNKNOWN_EXTENSION
- ENVELOPE_PAYLOAD_CONFLICT
- UNSUPPORTED_MAPPING_VERSION
- DUPLICATE_AUTHORITY
- PROHIBITED_BODY_ATTRIBUTES
- MISSING_NATIVE_MAPPING
- MAPPING_SCOPE_OVERCLAIM
- UNAPPROVED_POLICY_CRITICAL_POSTURE
- UNSUPPORTED_COMPATIBILITY_VERSION
- DERIVED_FROM_MALFORMED_INPUT
- DERIVED_FROM_DUPLICATE_INPUT
- DERIVED_FROM_NONCANONICAL_ORDER
- DERIVED_FROM_UNRESOLVABLE_INPUT
- DERIVED_FROM_ABSENT_INPUT
- DERIVED_FROM_EMPTY_INPUT
- DERIVED_FROM_NON_DERIVED
- DERIVED_FROM_CYCLE
- DERIVED_FROM_MISSING
- DERIVED_FROM_TRUST_FLOOR_EXCEEDED

Diagnostics include bounded metadata only: code, path, safe event name, schema version, and producer. Rejected values and full payloads are never echoed.

## Canonical Order Of risk.model.provenance.derived_from

Declared order: `code_point_ascending`.

Entries are ordered by ascending Unicode code-point value. To compare two entries,
decode both to sequences of code points and compare them position by position; at the first
position whose code points differ, the entry with the smaller code point sorts first. If one
entry is a prefix of the other, the shorter entry sorts first. Consecutive entries must be
strictly ascending under this order; a repeated entry is reported as the duplicate-input
outcome rather than the non-canonical-order outcome.

This is not UTF-16 code-unit order, and not locale collation. The two orders disagree for any
entry containing a character above U+FFFF, because a lead surrogate (U+D800..U+DBFF) is a
lower code unit than U+E000..U+FFFF while the character it encodes is a higher code point.
For example, U+FF01 precedes U+10000 by code point, but a UTF-16 code-unit comparison places
U+10000 first. An implementation that compares UTF-16 code units is not conformant.
