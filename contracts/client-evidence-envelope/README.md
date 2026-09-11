# ClientEvidenceEnvelope v1 Contract

> GENERATED FROM contracts/client-evidence-envelope/source/envelope.source.json. DO NOT EDIT BY HAND.

This directory defines the independently versioned, closed ClientEvidenceEnvelope v1 contract.

## Canonical Boundary

ClientEvidenceEnvelope is canonical for low-assurance client evidence and intentionally decoupled from the security-audit event contract, SDK Core, and delivery adapters (PLAN-086).

- Source of truth: `source/envelope.source.json`.
- Schema: `schema/client-evidence-envelope.schema.json`.
- Validation: `node contracts/client-evidence-envelope/scripts/validate-envelope.mjs <file>`.
- Generation / Drift check: `node contracts/client-evidence-envelope/scripts/generate-artifacts.mjs --check`.
- Tests: `node --test contracts/client-evidence-envelope/tests/envelope.test.mjs`.

## Assurance Limitations

Envelope validity proves syntax and declared provenance only, not genuine browser/device origin or truthful host-page execution. All claims carry `client_claim` trust.
