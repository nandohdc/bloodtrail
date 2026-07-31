# ADR-SDK-003: Runtime schema validation

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

Use pinned AJV 8 with its Draft 2020-12 entry point, strict mode, all-errors mode, and pinned `ajv-formats` during generation. AJV standalone ESM output is generated into the package and tested on every supported Node runtime, keeping the release package free of runtime dependencies. The SDK maps AJV diagnostics into bounded safe codes and paths and never includes rejected values.

If standalone output cannot preserve strict conformance, deterministic packaging, or supported-runtime behavior, correctness takes precedence and a separately documented pinned runtime AJV dependency may replace it after this ADR is amended and reviewed.

## Alternatives

A handwritten schema validator was rejected as incomplete. Schema validation alone is rejected; semantic validation remains a separate mandatory layer.
