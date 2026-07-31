# ADR-SDK-009: Package and contract compatibility

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

SDK package versions declare the exact supported contract version. Initial SDK releases implement only contract `1.0.0` and reject other versions. Package patch releases may fix behavior without changing canonical interpretation; additive optional API/error additions use minor versions; removals, support-baseline changes, or public/generated API incompatibility require a major version. Any authority, privacy, lifecycle, outcome, requiredness, registry, or canonical semantic change first requires a separate versioned `security-audit-event-contract` governance change.

SDK migration documentation remains distinct from contract/schema migration. Compatibility fixtures pin version 1.0.0 interpretation.
