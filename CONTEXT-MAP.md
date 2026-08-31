# Context Map

## Contexts

- [OpenSpec Governance](./openspec/CONTEXT.md): defines the repository's evidence-bearing change and governance concepts.
- [Security Audit SDK Core](./packages/security-audit-sdk-core/CONTEXT.md): defines the isolated TypeScript SDK's compatibility and authorization-boundary concepts.

## Relationships

- **OpenSpec Governance → Canonical Security Audit Contract**: governs changes that affect the authored contract and its declared semantics; the contract source remains authoritative.
- **OpenSpec Governance → Security Audit SDK Core**: governs changes that affect the SDK's generated projection of the canonical contract.
