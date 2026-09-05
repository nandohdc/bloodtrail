## Why

`assessment.json` is the single largest artifact in every OpenSpec change, hand-written every time at 113–136 lines and 17–18 top-level keys across all changes regardless of size. Much of that volume is mechanical boilerplate (such as the fifteen security dimension justifications required for `security_sensitive: false`, proposal baseline commit lookups, and schema version tags). Following the repository's established code-generation idiom (seen in `contracts/security-audit` and `packages/security-audit-sdk-core`), derivable scaffolding must be emitted deterministically and verified against drift, preserving human judgment for genuine design decisions.

## What Changes

- Introduce assessment scaffolding and code-generation tooling in `openspec/scripts/generate-assessment.mjs`.
- Support `--scaffold` to create an authored input file (`assessment.source.json`) containing only fields requiring genuine judgment (`decision`, `forces`, `candidate_approaches`, `selected_approach_id`, `rejected_alternative_ids`, `rejection_reasons`, `implementation_invariant_ids`, `invariant_evidence`).
- Generate deterministic `assessment.json` from `assessment.source.json` and change metadata (`proposal.md`, `tasks.md`, git baseline commit), populating mechanical fields (`schema_version`, `change_id`, `applicability`, `ordering`, `verification_task_ids`, and the 15 standard negative justifications for `security_sensitive: false`).
- Support `--check` to assert that emitted `assessment.json` is byte-identical to generator output whenever `assessment.source.json` is present, rejecting unregenerated drift.
- Verify generated assessments against `assessment.schema.json` and existing governance rules without weakening any assertion.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `software-design-pattern-governance`: Adds requirement and scenarios governing derivable assessment scaffolding and deterministic byte-for-byte drift verification.

## Impact

- Touches `openspec/scripts/` (`generate-assessment.mjs`), `openspec/tests/design-pattern-governance/`, and `openspec/specs/software-design-pattern-governance/`.
- Classified as `governance_core` under `openspec/governance/design-pattern-policy.json`.
- Does not affect shipping SDK runtime code, frozen contract artifacts, or public APIs.
