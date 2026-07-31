# Sources And Evidence

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

Retrieval date: 2026-07-31

| ID | Version | Normative Scope | URL | Support Type | Exact Bloodtrail Design Decision |
| --- | --- | --- | --- | --- | --- |
| nist-sp-800-53-rev5 | Rev. 5 | AU-2, AU-3, AU-5, AU-8, AU-9, AU-11, AU-12 event selection, content, timestamp, protection, retention, and generation guidance. | https://github.com/usnistgov/oscal-content/tree/main/nist.gov/SP800-53/rev5 | recommendation | Use NIST AU control objectives as evidence for event selection, content, timestamp, protection, retention, and generation concerns; Bloodtrail defines the project-specific contract. |
| ocsf-1.8.0 | 1.8.0 | Cybersecurity event normalization categories, classes, profiles, objects, attributes, extensions, and versioning. | https://github.com/ocsf/ocsf-schema/releases/tag/1.8.0 | mapping_option | Keep OCSF 1.8.0 as a version-pinned downstream ingestion/export mapping with explicit exact, transformed, extended, unmapped, and lossy status. |
| otel-spec-1.59.0 | 1.59.0 | LogRecord timestamps, trace/span context, resource, instrumentation scope, attributes, body, and event name fields. | https://github.com/open-telemetry/opentelemetry-specification/blob/v1.59.0/specification/logs/data-model.md | mapping_option | Represent canonical occurrence/observation timestamps, trace/span context, resource, instrumentation scope, attributes, body, and event name through an optional OpenTelemetry transport mapping. |
| otel-semconv-1.43.0 | 1.43.0 | Stable event names without dynamic values and occurrence time guidance. | https://github.com/open-telemetry/semantic-conventions/blob/v1.43.0/docs/general/events.md | mapping_option | Use stable low-cardinality EventName and occurrence-time guidance in the optional OpenTelemetry transport mapping. |
| cloudevents-1.0.2 | 1.0.2 | Protocol-neutral event envelope context attributes and duplicate identity using source plus id. | https://github.com/cloudevents/spec/blob/ce%40v1.0.2/cloudevents/spec.md | mapping_option | Allow CloudEvents 1.0.2 only as an optional transport envelope; preserve the canonical event in data and reject envelope/payload conflicts. |
| w3c-trace-context | Recommendation | traceparent/tracestate trace-id and parent-id propagation plus privacy and trust-boundary considerations. | https://www.w3.org/TR/trace-context/ | requirement | When trace context is present, validate W3C trace/span formats and treat propagated context as correlation-only and untrusted at external boundaries. |
| json-schema-2020-12 | Draft 2020-12 | Schema dialect, identifiers, references, vocabularies, validation, and unevaluated property behavior. | https://json-schema.org/draft/2020-12/ | requirement | Declare JSON Schema Draft 2020-12 for structural validation and supplement it with deterministic semantic validation for cross-field authority rules. |
| semver-2.0.0 | 2.0.0 | Major, minor, and patch compatibility terminology after defining the public API. | https://semver.org/spec/v2.0.0.html | recommendation | Apply SemVer terminology only after defining Bloodtrail public compatibility as field paths, types, authority, privacy, requiredness, catalog semantics, validation results, and mapping guarantees. |
| owasp-logging | current referenced guidance | Application event logging selection, when/where/who/what context, sanitization, and data to exclude. | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html | recommendation | Use allowlist-first event selection, sanitization, and excluded-data guidance to support Bloodtrail privacy and misuse-resistance policy without asserting external approval. |

Support type is explicitly classified as an internal requirement, recommendation, or mapping option; it does not convert external guidance into automatic Bloodtrail approval.

## Facts And Gaps

### NIST SP 800-53 Rev. 5 AU controls

Facts:
- Identifies audit event selection and content concerns.
- Does not define Bloodtrail JSON envelope, actor model, tenant authority, or producer SDK behavior.

Support type: recommendation.

Exact decision supported: Use NIST AU control objectives as evidence for event selection, content, timestamp, protection, retention, and generation concerns; Bloodtrail defines the project-specific contract.

Recommendation or assumption: Use as evidence input only; do not treat it as a complete Bloodtrail requirement.

### OCSF schema

Facts:
- Provides downstream normalization vocabulary.
- Does not own Bloodtrail tenant, transaction, delivery, privacy, or producer authority semantics.

Support type: mapping_option.

Exact decision supported: Keep OCSF 1.8.0 as a version-pinned downstream ingestion/export mapping with explicit exact, transformed, extended, unmapped, and lossy status.

Recommendation or assumption: Use only at ingestion/export with tested event and field mappings.

### OpenTelemetry Specification Logs Data Model

Facts:
- Supports native occurrence and observation time plus W3C trace/span fields.
- Does not define Bloodtrail audit authority, privacy, catalog, or delivery classes.

Support type: mapping_option.

Exact decision supported: Represent canonical occurrence/observation timestamps, trace/span context, resource, instrumentation scope, attributes, body, and event name through an optional OpenTelemetry transport mapping.

Recommendation or assumption: Use only as optional transport representation.

### OpenTelemetry Semantic Conventions events guidance

Facts:
- Supports low-cardinality event naming and occurrence time separation.
- Leaves domain event structure to Bloodtrail.

Support type: mapping_option.

Exact decision supported: Use stable low-cardinality EventName and occurrence-time guidance in the optional OpenTelemetry transport mapping.

Recommendation or assumption: Pin mapping tests to 1.43.0.

### CloudEvents specification

Facts:
- Defines envelope metadata and data separation.
- Does not define canonical audit payload semantics or trust elevation.

Support type: mapping_option.

Exact decision supported: Allow CloudEvents 1.0.2 only as an optional transport envelope; preserve the canonical event in data and reject envelope/payload conflicts.

Recommendation or assumption: Permit only optional envelope wrapping; reject envelope/payload conflicts.

### W3C Trace Context

Facts:
- Defines trace-id and span-id shape and propagation concerns.
- Trace context is correlation-only, not identity or authorization.

Support type: requirement.

Exact decision supported: When trace context is present, validate W3C trace/span formats and treat propagated context as correlation-only and untrusted at external boundaries.

Recommendation or assumption: Validate structure and restart/omit at trust boundaries when needed.

### JSON Schema

Facts:
- Provides language-neutral structural validation.
- Cannot express every producer authority or tenant/resource invariant alone.

Support type: requirement.

Exact decision supported: Declare JSON Schema Draft 2020-12 for structural validation and supplement it with deterministic semantic validation for cross-field authority rules.

Recommendation or assumption: Use Draft 2020-12 plus deterministic semantic validation.

### Semantic Versioning

Facts:
- Provides vocabulary for compatible and incompatible change classes.
- Bloodtrail must define its own compatibility surface first.

Support type: recommendation.

Exact decision supported: Apply SemVer terminology only after defining Bloodtrail public compatibility as field paths, types, authority, privacy, requiredness, catalog semantics, validation results, and mapping guarantees.

Recommendation or assumption: Apply to schema/catalog field paths, requiredness, privacy, authority, vocabularies, mappings, and validation results.

### OWASP Logging Cheat Sheet

Facts:
- Supports event selection, sanitization, and excluded-data reasoning.
- Does not approve Bloodtrail retention, legal basis, or production architecture.

Support type: recommendation.

Exact decision supported: Use allowlist-first event selection, sanitization, and excluded-data guidance to support Bloodtrail privacy and misuse-resistance policy without asserting external approval.

Recommendation or assumption: Use as privacy and misuse-resistance evidence input only.
