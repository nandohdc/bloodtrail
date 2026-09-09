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

Diagnostics include bounded metadata only: code, path, safe event name, schema version, and producer. Rejected values and full payloads are never echoed.
