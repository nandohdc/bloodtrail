# ADR-SDK-002: Canonical type generation

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

A deterministic repository-local generator reads `contract.source.json`, the generated Draft 2020-12 schema, event catalog, registries, policy metadata, and extension registry. It first proves version and catalog agreement. It emits generated headers without timestamps, canonical structural types from the schema, controlled constants/unions, catalog discriminants, event metadata, and registered extension boundaries. Generated output is committed and `generate --check` compares bytes. No handwritten canonical event model is permitted.

Event-specific named input metadata is generated from catalog `required_context`, phase, outcome, commit, producer, and delivery fields. TypeScript remains developer feedback; runtime validation is mandatory.

## Alternatives

Schema-only generic generation was rejected because catalog, authority, policy, and registry semantics exceed the schema. Handwritten types were rejected as a drift-prone duplicate model.
