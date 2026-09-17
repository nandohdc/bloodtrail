# Apply Authorization — define-normative-precedence-lifecycle

This record authorizes only the bounded implementation and verification work in task groups 2
through 5. It is not normative approval, technical review, merge readiness, activation, folding,
archival, release, Candidate B selection, or authorization to begin CB-002.

## Authorized proposal baseline

| Field | Value |
| --- | --- |
| Authorized proposal commit | `6fabafddcb1d7825562ba36eb8d26bad28d284aa` |
| Repository tree | `f11af0b5ac691c06bd4dc74e4156f1ed82eae6c3` |
| Change subtree object | `b885e54d08b336915c5043071e312f4b79e70cd6` |
| Candidate A base | `b8122751342b0a2591a69a728ea58a99ca37dd0f` |
| Candidate A tree | `42a0eecff212ad642de8d515ce5fbeb6a6ed2b83` |

## Authorization

| Field | Value |
| --- | --- |
| Authorizing party | Fernando Homem da Costa (`nandohdc`), project owner |
| Granted | Implement and verify task groups 2 through 5 within the allowlist below |
| Withheld | Project-owner normative approval, signed review decision, merge, activation, canonical fold, archive, release, Candidate B selection, CB-002 and every dependent remediation |
| Basis | Direct project-owner instruction to materialize CB-001 Revision 2 as an exact bounded PR-B01 review candidate |

The candidate checker, an AI-authored analysis, a pull request, passing tests, or this apply record
cannot grant any withheld authority.

## Changed-path allowlist

Apply may create or modify only:

```text
openspec/changes/define-normative-precedence-lifecycle/**
openspec/governance/normative-source-precedence.json
openspec/governance/schemas/normative-source-precedence.schema.json
openspec/scripts/check-normative-precedence.mjs
openspec/scripts/normative-precedence/**
openspec/tests/design-pattern-governance/normative-precedence-policy.test.mjs
openspec/tests/design-pattern-governance/normative-precedence-repository.test.mjs
openspec/tests/design-pattern-governance/fixtures/normative-precedence/**
openspec/CONTEXT.md
.github/workflows/ci.yml
```

Current canonical capabilities remain unchanged during apply; their deltas remain inside this active
change until exact review, merge, activation, fold, and archive are separately authorized.

## Stop conditions

Apply stops rather than expanding scope if any task requires a contract semantic choice, edits an
authoritative or generated contract/SDK artifact, weakens the current trusted governance baseline,
requires owner approval, or begins dependent remediation. A failed unrelated required gate is
reported and is not repaired under this authorization.
