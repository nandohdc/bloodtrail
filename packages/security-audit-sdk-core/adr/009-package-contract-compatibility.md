# ADR-SDK-009: Package and contract compatibility

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

SDK package versions declare the exact supported contract version in `compatibility.json`; the human migration policy is `MIGRATION.md`. Candidate `0.1.0` implements only contract `1.0.0`, bound to normative target `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993`, and rejects every other version during initialization. Package patch releases may fix behavior without changing canonical interpretation; additive optional API/error additions use minor versions; removals, error-meaning changes, support-baseline changes, export changes, or public/generated API incompatibility require a major version. Deprecation is documented in a minor and removal normally waits for a major. Any authority, privacy, lifecycle, outcome, requiredness, registry, or canonical semantic change first requires a separate versioned `security-audit-event-contract` governance change.

SDK migration documentation remains distinct from contract/schema migration. Generated drift is a failure rather than a migration path. Compatibility fixtures pin version `1.0.0` interpretation. Consumers must check the exact manifest for each future SDK version rather than infer compatibility from package version alone. This ADR grants no package release, application integration, or production authorization.
