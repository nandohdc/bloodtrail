# Revision 2 Apply Authorization — define-normative-precedence-lifecycle

This record authorizes only the bounded implementation and verification of the CB-001 Revision 2
planning content identified below. It does not approve the normative decision, grant merge or
activation authority, fold the change into current capabilities, authorize release, select Candidate
B, or authorize CB-002 or any dependent remediation.

## Authorized proposal baseline

| Field | Value |
| --- | --- |
| Authorized proposal commit | `e1ffc1a74a89ea42c555b3dedf9803d736a7153f` |
| Repository tree | `88c01237b71b462129a1548dbbae417f66a38fb7` |
| Change subtree object | `b5b07d2b30b272159c55d3caf6e58c55e89ddb5d` |
| Candidate A base | `b8122751342b0a2591a69a728ea58a99ca37dd0f` |
| Candidate A tree | `42a0eecff212ad642de8d515ce5fbeb6a6ed2b83` |
| Authorizing party | Fernando Homem da Costa (nandohdc), project owner |
| Authorized capabilities | `security-audit-event-contract`, `change-governance`, `software-design-pattern-governance` |
| Authorized semantic dimensions | `none` |
| Authorized source pointers | `none` |
| Granted | Implement and verify task groups 2 through 5 for CB-001 Revision 2 within the changed-path allowlist |
| Withheld | Normative approval, signed review decision, merge, canonical fold, activation, archive, release, Candidate B selection, CB-002, and every dependent remediation |

The authorized change defines governance semantics only. It does not authorize any change to the
security-audit contract's field, event, authority, trust, privacy, retention, compatibility,
interoperability, derivation, validation, or SDK projection semantics.

## Changed-path allowlist

```text
.github/workflows/ci.yml
openspec/CONTEXT.md
openspec/changes/define-normative-precedence-lifecycle/**
openspec/governance/design-pattern-policy.json
openspec/governance/normative-source-precedence.json
openspec/governance/schemas/normative-source-precedence.schema.json
openspec/scripts/check-normative-precedence.mjs
openspec/scripts/normative-precedence/**
openspec/tests/design-pattern-governance/normative-precedence-policy.test.mjs
openspec/tests/design-pattern-governance/normative-precedence-repository.test.mjs
openspec/tests/design-pattern-governance/fixtures/normative-precedence/**
```

## Stop conditions

Apply stops rather than expanding scope if implementation requires a security-audit contract
semantic choice, edits any authoritative or generated contract or SDK artifact, weakens the trusted
Candidate A governance baseline, requires project-owner normative approval, or begins dependent
remediation. Candidate-checker success cannot grant any withheld authority or make that checker
trusted.
