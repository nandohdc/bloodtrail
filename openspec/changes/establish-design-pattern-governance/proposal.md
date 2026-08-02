## Why

Bloodtrail needs repository-wide, actor-neutral design-pattern governance that is deterministic, reviewable, and enforceable from committed Git evidence. The reviewed proposal at `a17eb79a2dd0172bb888278a39ad898280a2f59a` did not make activation, enforcement scope, provenance, ordering, invariant binding, schema evolution, or fail-closed behavior sufficiently realizable. This correction resolves architectural-review findings G-01 through G-17 before any apply authorization or implementation.

The policy must require substantive assessment without forcing catalog patterns. A full assessment compares direct implementation with at least one materially plausible alternative, then binds any selected catalog pattern to versioned catalog invariants. The policy must apply equally to humans, agents, pull requests, direct commits, and scripts.

## What Changes

- Define a realizable identity-preserving activation history: reviewed technical commit, later governance records, protected-mainline merge commit, and a dedicated child activation-record commit.
- Require verified evidence that the governance CI job is a required check for a configured protected mainline reference; activation fails closed when that evidence or history is unavailable.
- Close the governance perimeter for every governed implementation path, including implementation hidden in tests, build files, scripts, or configuration and work split across commits.
- Define separate `mainline_present` and `external_in_flight` grandfathering classes, bounded scope expansion rules, and exact-commit opt-in and withdrawal behavior.
- Make assessment-before-implementation verifiable through an `assessment_commit` and the earliest governed implementation commit.
- Require full assessments to compare direct implementation with at least one materially plausible candidate approach without requiring a named pattern.
- Bind selected catalog patterns to versioned invariant IDs and test evidence; direct implementations record implementation-specific invariants without claiming catalog conformance.
- Define full-assessment, abbreviated-eligible, and material-capability-modification vocabulary and comprehensive security-sensitive trigger dimensions.
- Define normative paths, governance-record-only paths, stale-review invalidation, identity-preserving merge behavior, schema compatibility, and baseline-plus-candidate checking for governance-core changes.
- Define deterministic fail-closed behavior for absent, corrupt, truncated, incompatible, or weakened governance evidence.
- Plan actor-neutral documentation in `CONTRIBUTING.md`, governance documentation, and a pull-request template; Hermes remains an early-feedback convenience rather than an authority.
- Plan executable Hermes allowed-tools verification using the actual generated frontmatter syntax discovered during apply.
- Define an exact-change, path-bounded emergency classification record with conservative classification and no clock-based expiry.
- Expand the planned catalog to 24 entries by adding Ambient Context / Context Propagation and its authority, concurrency, lifecycle, and cleanup invariants.
- Separate deterministic activation from governance lifecycle-state separation.
- Replace indeterminate modal wording and correct task-plan authorization and proposal-baseline checks.
- Require explicit archive-evidence validation rather than assuming repository-wide strict validation covers archived changes.

## Scope

This proposal governs the future apply plan for:

- the canonical `software-design-pattern-governance` capability;
- versioned assessment and correspondence schemas;
- a 24-entry catalog and invariant registry;
- actor-neutral policy documentation;
- baseline and candidate checker behavior;
- fixtures, mutation tests, Hermes convenience integration, and the required CI job;
- exact-commit review, governance, activation, enforcement, and archive evidence.

Only proposal artifacts under `openspec/changes/establish-design-pattern-governance/` are changed by this corrective commit.

## Non-Goals and Authorization Boundary

This corrective commit does not authorize apply and does not implement the governance capability. It does not create or modify:

- checker code, schemas, policy configuration, catalog documents, invariant registry, fixtures, tests, or CI workflows;
- Hermes skills or generated Hermes configuration;
- branch protection or required-check configuration;
- activation, correspondence, owner-decision, merge-readiness, or archive records;
- canonical capabilities or archived changes;
- SDK code, the active SDK-remediation change, canonical contracts, research artifacts, production code, or publication/deployment behavior.

Every task remains unchecked. Task 1.1 is the explicit project-owner apply-authorization gate for every later task through final archive. Proposal validation, AI review, pull-request assignment, authorship, and informal messages are not authorization or owner approval.

## Compatibility and Rollout

The preferred rollout is to finish and merge `remediate-security-audit-sdk-adversarial-review` before activating design-pattern governance. If activation occurs first, that change must be represented by a complete `external_in_flight` grandfathering record bound to its remote branch and exact proposal evidence. The proposal does not assert that this change exists in the reviewed `origin/main` proposal-baseline tree.

Grandfathering preserves only recorded scope. New public API, integration, persistence, lifecycle, concurrency, security boundary, governed capability, or paths outside the record require normal full governance. Explicit opt-in is bound to an exact commit, may be withdrawn only before the first governed implementation commit through explicit project-owner governance evidence, and is irrevocable afterward.

Governed activation requires a configured protected mainline reference, normally `refs/heads/main`, and verified evidence that the governance CI job is a required status check for that reference. A branch name alone is not proof of protection. Missing or unverifiable required-check enforcement blocks activation.

## Enforcement Strategy

- The canonical capability, policy configuration, trusted baseline checker, candidate checker, and required CI check are authoritative.
- Actor-neutral checked-in documentation explains the perimeter to every contributor and tool.
- Complete Git ancestry is required for activation, assessment ordering, review binding, merge identity, and grandfathering; shallow or missing history fails closed.
- A full assessment evaluates direct implementation and at least one materially plausible alternative. Rejected alternatives require force-based reasons.
- Selected catalog patterns bind catalog version, required and conditional invariant IDs, implementation tasks, and verification evidence.
- Governance-core changes run both the trusted baseline checker and candidate checker; a candidate checker cannot be the sole judge of its own weakening.
- Stable diagnostics distinguish absent policy, malformed policy, unsupported versions, missing activation history, perimeter violations, ancestry failures, invariant failures, and invalid emergency records.
- Hermes executes the canonical checker only when its repository-supported generated frontmatter actually permits the command; CI tests both sequence and permission preservation.

## Risks

- **Bootstrap circularity:** resolved by a one-time bootstrap that validates exact pre-existing approved objects and creates a dedicated activation record whose parent is exactly the protected-mainline merge commit; the record does not bind its own commit hash.
- **Perimeter evasion:** resolved by capability/path association, commit-range inspection, behavior triggers, actor neutrality, and fail-closed unclassified paths.
- **Grandfathering overreach:** resolved by two provenance classes, exact scope, and normal full governance for any recorded-scope expansion matching a full trigger.
- **Retrospective evidence laundering:** resolved by Git ancestry checks and explicit human-owned retrospective exceptions that state their reduced assurance.
- **Pattern cargo culting:** resolved by candidate approaches rather than mandatory pattern enumeration and by direct implementation as a first-class option.
- **Self-weakening governance:** resolved by baseline-plus-candidate checking and mandatory reviewer acknowledgement.
- **Clock-dependent emergency behavior:** avoided by exact-change, path-bounded records that terminate only when the change is merged or abandoned.

## Success Criteria

- G-01 through G-17 each map to corrected normative requirements, scenarios, design decisions, tasks, and validation evidence.
- Activation can be produced by the planned Git sequence and rejects squash, rebase, missing ancestry, altered artifacts, and absent required-check evidence.
- Governed implementation cannot evade association with an applicable OpenSpec change.
- Assessment ordering, catalog invariants, review freshness, schema compatibility, security classification, and self-governance fail closed.
- The planned catalog contains exactly 24 entries including Ambient Context / Context Propagation.
- Actor-neutral policy and required CI remain authoritative; Hermes is convenience-only and executable when integrated.
- Explicit archive checks validate immutable archive evidence and lifecycle records.
- All proposal tasks are unchecked and implementation remains unauthorized.

## Capabilities

### New Capabilities

- `software-design-pattern-governance`: Defines actor-neutral design-pattern assessment, deterministic activation and provenance, governance perimeter, candidate-approach comparison, catalog-invariant binding, security classification, exact-commit ordering and review, schema compatibility, fail-closed enforcement, deterministic emergency classification, and lifecycle/archive evidence.

### Modified Capabilities

None.

## Impact

If later authorized, apply may materialize only the artifacts and integrations explicitly planned by this change and must use the separated technical, correspondence, owner-governance, merge, activation, canonicalization, and archive lifecycle. This corrective proposal itself has no implementation, runtime, production, publication, branch-protection, merge, or archive effect.
