# Proposal: Exercise Abbreviated Assessment Path

## Motivation

`openspec/governance/design-pattern-policy.json` establishes an abbreviated assessment path for changes satisfying five criteria:
1. One bounded correction
2. Introduces no new abstraction
3. Adds no new module, class, or interface
4. Changes no public API surface
5. Proves that no full_assessment_trigger applies

Despite being ratified policy, every recorded assessment in this repository has used `assessment_level: full` (~113–136 lines). An unexercised governance path carries latent risk: if it works, changes are paying unnecessary governance overhead; if it fails, the policy overstates what it offers.

This change exercises the abbreviated assessment path end-to-end on a bounded test assertion hardening in `packages/security-audit-sdk-core/tests/pass1.test.ts`, verifying that the checker and required CI gates accept an abbreviated assessment.

## Capabilities

- `security-audit-sdk-core`

## User Impact

No changes to public API, runtime behavior, or canonical capability requirements. Developers and agents gain an empirically validated abbreviated assessment path that reduces governance artifact size on bounded changes.
