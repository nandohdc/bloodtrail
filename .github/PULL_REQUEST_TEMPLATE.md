<!--
This template applies to every pull request, from every contributor and every tool: humans, Hermes,
Claude Code, other agents, and scripts. Delete nothing; answer everything that applies and say
"not applicable" with a reason where it does not.

Governance reference: docs/design-pattern-governance.md
-->

## What this changes

<!-- One paragraph. What is different afterwards, and why. -->

## OpenSpec change

- **Change:** `<change-id>` <!-- the OpenSpec change that owns the modified capability -->
- **Capability:** `<capability>`
- **Task groups covered:** <!-- e.g. 1-4 -->

A change touching a governed implementation path must name an OpenSpec change that **owns** the
modified capability. An unrelated change does not satisfy the association.

## Design-pattern governance

- **Assessment level:** full | abbreviated
- **Decision:** `direct_implementation` | `named_pattern`
- **Selected pattern IDs:** <!-- none for direct implementation -->
- **Alternative compared:** <!-- required for a full assessment; direct implementation counts as one side -->
- **Rejection reasons cite forces:** yes | no
- **Invariants bound and their evidence:** <!-- invariant ID → test or fixture -->
- **Assessment precedes the earliest governed implementation commit:** yes | no | retrospective exception

Naming a catalog pattern is never required. `direct_implementation` is a first-class decision. What
is required is a comparison against at least one materially plausible alternative, with force-based
reasons — not "best practice", popularity, or a list of patterns that do not match the forces.

## Security classification

- **`security_sensitive`:** true | false
- **If false, the dimension-by-dimension justification:**

<!--
Dimensions: trust_boundary, authority_provenance, authentication_or_authorization, audit_integrity,
confidentiality, mutation_ownership, fail_posture, error_disclosure, concurrency, lifecycle,
resource_retention, retry_or_redelivery, cryptography, privacy_transformation,
external_security_integration.

A positive declaration always wins and needs no justification. A `false` that contradicts the
change's own triggers is rejected.
-->

## Behavioural classification

Confirm each, or explain:

- [ ] No implementation behaviour is hidden in tests, build files, scripts, or configuration
- [ ] No public API change is labelled internal-only
- [ ] No concurrency is introduced under a performance-only label
- [ ] No material change is split across commits to lower its classification
- [ ] No path in this change is unclassified

## Governance-core changes

If this touches the checker, policy, activation record, schemas, catalog, invariant registry, the
actor-neutral documents, Hermes integration, the CI workflow, or path classifications:

- [ ] Full assessment
- [ ] Security-sensitive analysis
- [ ] Explicit reviewer acknowledgement
- [ ] **Trusted baseline** checker result recorded
- [ ] **Candidate** checker result recorded separately

A candidate checker is never the sole judge of whether it weakened itself.

## Authorization

- [ ] This PR does not authorize package publication, production deployment, production collection,
      real-user processing, framework integration, or delivery infrastructure
- [ ] Scope exclusions are discharged by citing the gates that enforce them, not restated in prose

AI-produced analysis may inform this change. It is not review, approval, or assurance, and approval
is not inferred from passing tests, checked tasks, PR state, or merged state.

## Verification

<!-- Paste the commands you ran and their outcome. -->

```
npm run check:generated --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
node --test openspec/tests/design-pattern-governance/*.test.mjs
node openspec/scripts/check-design-pattern-governance.mjs --phase final
```
