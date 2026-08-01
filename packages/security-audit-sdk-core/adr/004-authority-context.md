# ADR-SDK-004: Authority and context propagation

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

Configured server-side authority providers mint immutable runtime-provenance values and opaque TypeScript-branded types. Request/client parsers produce claims only. Runtime checks enforce provenance/value combinations and tenant/resource conflicts even when TypeScript is bypassed. `AsyncLocalStorage` carries immutable explicit frames with field-specific inheritance and override rules; nested and concurrent scopes are tested.

The SDK cannot prove producer truthfulness. Documentation identifies configured authority providers as trust boundaries and forbids adapters from merely relabeling request data.

## Alternatives

A flat context object was rejected because it conflates claims with authority. Global mutable context was rejected because it leaks across asynchronous work.
