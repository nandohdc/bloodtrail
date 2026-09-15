## Why

Candidate A's Slice 1 assurance found that Bloodtrail has no mechanically enforceable rule for resolving disagreements among current capability specifications, the authored contract source, active or archived deltas, generated artifacts, and lifecycle records. That ambiguity blocks safe remediation because downstream changes would otherwise choose their own authority model, and it permits review or activation evidence to float away from the exact content it purports to govern.

## What Changes

- Establish a domain-specific authority model that separates semantic intent, concrete representation, governance validity, compatibility classification, lifecycle authorization, provenance identity, and derived conformance surfaces.
- Default source-only dimensions to semantic requirements unless a current capability explicitly delegates them as representation details.
- Add machine-readable requirement ownership and capability applicability so source/capability overlap, missing ownership, and ambiguous ownership fail closed.
- Distinguish active candidate deltas from archived historical records and define when candidate intent may guide implementation without becoming operative semantics.
- Define independent change-record and contract-candidate/version lifecycles, exact freeze/review invalidation, and a dedicated post-merge activation mechanism whose record cannot authorize itself.
- Add a repository-aware precedence checker, policy-model tests, repository enforcement tests, and adversarial negative controls under the existing trusted-baseline/candidate-checker governance model.
- Integrate the checker into the required governance CI surface without changing any contract, generator, schema, validator, SDK projection, or downstream semantic decision.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-event-contract`: Define the boundary between capability-owned semantics and source-owned representation, including default-deny delegation and derived-artifact authority.
- `change-governance`: Define active-delta authority, independent change/contract lifecycles, exact freeze/review/activation bindings, and fail-closed lifecycle effects.
- `software-design-pattern-governance`: Define deterministic capability applicability, trusted/candidate precedence checker treatment, and repository-aware governance enforcement.

## Impact

- Adds governance policy and schema files under `openspec/governance/` and registers the new policy,
  checker, and module paths in the existing governance-core perimeter.
- Adds a dependency-free repository checker and focused tests under `openspec/scripts/` and `openspec/tests/design-pattern-governance/`.
- Adds one required governance-CI invocation and records the resolved authority/lifecycle vocabulary in `openspec/CONTEXT.md`.
- Creates no contract or SDK semantic change and does not select Candidate B.

Refs #533.
