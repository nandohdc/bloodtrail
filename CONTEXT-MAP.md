# Context Map

## Contexts

- [OpenSpec Governance](./openspec/CONTEXT.md): defines the repository's evidence-bearing change and governance concepts.
- [Security Audit SDK Core](./packages/security-audit-sdk-core/CONTEXT.md): defines the isolated TypeScript SDK's compatibility and authorization-boundary concepts.
- [Security Audit SDK Node Binding](./packages/security-audit-sdk-node/CONTEXT.md): defines the delivery vocabulary (occurrences, re-executions, redelivery, delivery attempts, and the HTTP audit sink versus the delivery handoff), the evaluation-kit vocabulary (evaluator, own service, facilitator, answer key, example receiver, evaluated path), and the kit-verification vocabulary (kit gate, verification summary, planted-defect control, distributable kit, verification kit, kit identity, kit digest, archive digest, and kit destination).
- [Security Audit Collector](./packages/security-audit-collector/CONTEXT.md): defines the synthetic collector ingress's identities and its duplicate and conflict outcomes.
- [Fraud-Evidence Consumer](./docs/fraud-evidence/CONTEXT.md): defines the vocabulary for supplying occurrences to an external fraud engine (fraud-evidence consumer, presented identifier, honest carrier, provenance ambiguity, post-authentication join identifier and session fingerprint), applied by the consumer integration profile.

## Relationships

- **OpenSpec Governance → Canonical Security Audit Contract**: governs changes that affect the authored contract and its declared semantics; the contract source remains authoritative.
- **OpenSpec Governance → Security Audit SDK Core**: governs changes that affect the SDK's generated projection of the canonical contract.
- **Security Audit SDK Core → Security Audit SDK Node Binding**: the core validates each occurrence, and the Node binding delivers it without changing a byte; a delivery attempt never enters the occurrence.
- **Security Audit SDK Node Binding → Security Audit Collector**: the Node binding sends copies of an occurrence over HTTP; the collector treats a canonically identical copy as a duplicate and any other reuse of an identity as a conflict.
- **Security Audit SDK Core → Fraud-Evidence Consumer**: a host relays the core's validated occurrences to an external fraud-evidence consumer, which is never an own service; the consumer reads trust from the published field policy, never treats SDK acceptance as attestation, and owns detection, scoring and fraud verdicts.
