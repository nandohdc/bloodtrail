## Context

The reviewed proposal commit `a17eb79a2dd0172bb888278a39ad898280a2f59a` failed architectural review. This proposal-only correction replaces ambiguous activation, provenance, ordering, applicability, and self-enforcement assumptions with a Git-realizable model.

A second correction reconciles the landing lifecycle with the canonical `change-governance` capability, which became canonical after this proposal was first written. That capability requires technical review and the project-owner decision to be one signed governance record bound to a content object rather than separate governed task groups, and requires scope-exclusion confirmations to cite the gates that enforce them rather than restate them in prose. The three-commit T → R → G sequence and the prose exclusion tasks are replaced accordingly; identity-preserving merge and the dedicated activation record are kept, because the repository permits merge commits and does not require linear history.

The policy must be reproducible from a complete clone, independent of actor and wall clock, and unable to treat absent evidence as non-applicability. OpenSpec strict validation remains a structural gate; it is not owner authorization, architectural approval, branch-protection evidence, archive validation, or proof that a candidate checker did not weaken itself.

## Goals / Non-Goals

Goals:

- Make activation and bootstrap realizable through exact Git parentage and artifact identities.
- Cover every governed implementation path for every actor and delivery mechanism.
- Require an assessment commit before the earliest governed implementation commit.
- Compare candidate approaches without forcing a named pattern.
- Bind selected catalog patterns to versioned invariant IDs and behavioral evidence.
- Fail closed for missing, corrupt, incomplete, incompatible, or self-weakened governance evidence.
- Preserve technical review across closed governance-record-only commits while invalidating it for any later normative change.
- Define deterministic grandfathering, emergency classification, schema compatibility, Hermes execution, required-CI evidence, and archive validation.

Non-goals:

- Implement any checker, schema, catalog, policy file, fixture, CI job, branch protection, Hermes integration, canonical capability, activation record, or archive.
- Authorize apply, merge, deployment, publication, or production use.
- Modify SDK, remediation, contract, canonical, research, production, or archived evidence paths.
- Make a deterministic checker select an architecture or replace technical and owner judgment.

## Controlled Vocabulary

The initial policy has 29 unique controlled values across 30 family memberships in 10 families; `governance_record_only` is intentionally shared by the path-class and review-path-kind families. IDs are immutable within a major schema version and cannot be silently reused.

| Family | Values |
| --- | --- |
| assessment level | `full`, `abbreviated` |
| decision | `direct_implementation`, `named_pattern` |
| checker phase | `assessment`, `implementation`, `final`, `bootstrap`, `activation` |
| grandfathering class | `mainline_present`, `external_in_flight` |
| path class | `governed_implementation`, `governance_core`, `documentation_only`, `governance_record_only`, `unclassified` |
| review path kind | `normative`, `governance_record_only` |
| security declaration | `true`, `false` |
| lifecycle state | `proposal`, `apply_authorized`, `governance_signed`, `merged`, `active`, `archived`, `abandoned` |
| merge strategy | `merge_commit`, `fast_forward` |
| emergency disposition | `conservative_full_assessment` |

Defined terms:

- **Full-assessment change:** a change matching any full trigger: public API, integration, lifecycle/state, concurrency, persistence, security-sensitive behavior, governance-core path, or canonical capability requirement addition/modification/removal.
- **Abbreviated-eligible change:** a change satisfying the closed abbreviated criteria and proving that no full trigger applies.
- **Material capability modification:** a change that adds, modifies, or removes a normative capability requirement, or modifies a governed implementation path owned by that capability and matches a full trigger.
- **Applicable baseline:** the proposal baseline used to classify and compare a change. For post-activation work it must be the activation-record commit or a descendant; grandfathered work uses the recorded baseline and bounded scope.
- **Normative path:** governed implementation, tests proving invariants, assessment/design artifacts, schemas, checker, policy configuration, catalog, invariant definitions, compatibility claims, workflow, or CI enforcement.
- **Governance-record-only path:** a closed allowlist for the signed governance record, status record, merge-readiness record, and archive-readiness record.

## Design Pattern Assessment

### Governance metadata

This block is proposal review evidence for the future schema, not checker output.

```json
{
  "schema_version": "1.1",
  "assessment_level": "full",
  "decision": "direct_implementation",
  "security_sensitive": true,
  "candidate_approach_ids": [
    "approach-direct-functions",
    "approach-composed-specifications"
  ],
  "selected_pattern_ids": [],
  "implementation_invariant_ids": [
    "implementation-deterministic-relations",
    "implementation-exact-history-binding",
    "implementation-actor-neutral-perimeter",
    "implementation-fail-closed-evidence",
    "implementation-approval-separation"
  ],
  "rejected_alternative_ids": [
    "approach-composed-specifications"
  ],
  "verification_task_ids": [
    "8.1",
    "8.2",
    "8.3",
    "8.4",
    "8.5",
    "8.6"
  ],
  "signed_governance_record_task_id": "9.3"
}
```

### Problem

Create deterministic repository governance that verifies evidence and ordering without turning pattern names into an implementation quota or allowing its candidate version to waive its own controls.

### Architectural forces

- Repository policy must be actor-neutral and versioned.
- Git history and blob identity provide deterministic ordering and provenance.
- Subjective architecture selection remains technical-review work.
- Missing or incomplete evidence must never broaden permission.
- Governance must be able to evolve without letting a candidate checker be its sole judge.
- Activation and grandfathering must remain reproducible without clocks.

### Constraints

- No root package is introduced solely for governance.
- No production, SDK, contract, active-remediation, research, canonical, or archive artifact is modified by this proposal correction.
- Squash, rebase, and history rewriting cannot preserve reviewed commit identity for governed activation.
- Activation records cannot contain their own commit hash.
- Hermes frontmatter syntax must be inspected during apply rather than guessed now.

### Candidate approaches

- **`approach-direct-functions`:** dependency-free, phase-aware Node.js validation functions over closed schemas and Git objects.
- **`approach-composed-specifications`:** composable Specification objects representing policy predicates.

### Selected approach

Select `direct_implementation`. The policy has one repository-owned rule system and no independently variable rule-provider boundary. Small validation functions and explicit data relations provide simpler auditability and bootstrap behavior.

### Rejected alternatives

- **`approach-composed-specifications`:** rejected because there is no independently owned or runtime-selected family of predicates. It would add participant and lifecycle concepts without improving the forces of deterministic evidence, baseline trust, or exact Git binding.

### Simplicity check

The design uses one canonical checker interface with trusted-baseline and candidate executions, closed records, Git object checks, and stable diagnostics. It does not create a pattern-selection engine, plugin system, rule marketplace, runtime service, or agent-specific authority.

### Security and correctness implications

Governance inputs are untrusted repository data. Paths must be normalized and bounded, diagnostics bounded, object identity verified, complete ancestry required, and missing policy or activation evidence rejected. A positive security declaration overrides benign path classification. A negative declaration requires dimension-by-dimension justification.

### Pattern invariants

Because direct implementation is selected, these are implementation-specific invariants and do not claim catalog-pattern conformance:

- **`implementation-deterministic-relations`:** identical committed bytes, history, and arguments yield identical classification and diagnostics.
- **`implementation-exact-history-binding`:** activation, assessment order, reviews, and grandfathering bind exact commits, trees, blobs, parents, and ancestry.
- **`implementation-actor-neutral-perimeter`:** the same changed paths and evidence receive the same result regardless of author or tool.
- **`implementation-fail-closed-evidence`:** absent, malformed, incompatible, unavailable, or weakened evidence never yields success or non-applicability.
- **`implementation-approval-separation`:** technical checks and AI review cannot create apply authorization or owner governance.

### Verification strategy

Use positive controls plus one-relation mutations. Run complete-history controls, shallow-history negatives, policy corruption cases, path-evasion cases, ordering mutations, pattern-invariant mutations, review-staleness cases, schema compatibility rows, baseline/candidate checker weakening cases, Hermes permission regeneration tests, emergency records, Ambient Context behavior, and explicit archive checks.

### Re-evaluation triggers

Re-evaluate a named Specification or Strategy design if independently owned rule packs, a second governance representation, or multiple interchangeable checker implementations become real requirements.

## Decisions

### D1 — Realizable activation history

The protected mainline reference is configured explicitly, normally as `refs/heads/main`; branch naming is not proof of protection. Activation requires stored evidence that the governance CI job is a required status check for that reference.

The exact sequence is:

1. **Reviewed technical commit T:** checker, policy configuration, schemas, 24-entry catalog, actor-neutral documentation, workflow integrations, tests, and fixtures.
2. **Signed governance record commit S:** a later governance-record-only commit carrying one signed record that binds the reviewed content object, names T, and states the reviewer, assurance limitations, authorizations granted, and authorizations withheld — including publication/deployment restrictions and activation authorization. Review and decision are one record, not two.
3. **Protected-mainline merge commit M:** introduces T and S using a merge commit or fast-forward and preserves their identities. Squash, rebase, and history rewriting are prohibited.
4. **Activation-record commit A:** a dedicated commit immediately after M whose only parent is M. It contains only the activation record and specifically allowlisted activation evidence. Activation begins at A.

A binds the protected reference, M, M's tree, T, S and its reviewed content object, checker/configuration/schema/catalog/actor-neutral-policy blobs, required-check identity, supported schema versions, and grandfathered entries. It does not bind its own hash. A baseline before A is classified by grandfathering; A or descendants use normal enforcement.

Bootstrap is one-time validation before normal enforcement. It requires exact approved T/S/M, exact artifact blobs, required-check evidence, and no unrelated A changes. It ends permanently at A. Unknown or shallow activation history fails with a stable diagnostic.

The content-object binding, rather than a commit hash alone, is what the canonical `change-governance` capability requires: a commit cannot record its own identifier, and a commit can be orphaned. Naming T in addition is permitted and useful here, because the identity-preserving merge this design mandates keeps T reachable.

### D2 — Actor-neutral governance perimeter

Any post-activation change touching a governed implementation path must associate the modified capability with an applicable OpenSpec change and governance evidence. Range-level inspection prevents splitting a material change across commits. Classification examines tests, build files, scripts, and configuration for implementation behavior and rejects documentation-only, internal-only, and performance-only mislabels when behavior triggers contradict them.

The authoritative surfaces are the canonical capability, policy configuration, baseline checker, candidate checker where applicable, and required CI check. `CONTRIBUTING.md`, governance documentation, and a pull-request template communicate the same policy. Hermes is a convenience and early-feedback mechanism only.

### D3 — Grandfathering and rollout

Preferred rollout: merge the active SDK remediation first, activate governance second. That order has since been satisfied — `remediate-security-audit-sdk-adversarial-review` archived on 2026-08-11 — so it is classified from actual mainline tree state as `mainline_present`, and the `external_in_flight` path is retained for any change that is still only on a remote branch at activation.

`mainline_present` records change ID, proposal path/blob hash, proposal baseline commit, and membership in M's tree. `external_in_flight` records change ID, remote branch reference, exact branch head, proposal baseline, proposal blob, `.openspec.yaml` metadata hash, owner rationale, and bounded paths/scope. The classes are alternatives, not an impossible conjunction.

Grandfathering does not cover new public API, integration, persistence, lifecycle, concurrency, security boundary, governed capability, or out-of-record path. Opt-in is exact-commit evidence. It may be withdrawn before the first governed implementation commit only by explicit owner-governance evidence; afterward it is irrevocable.

### D4 — Assessment ancestry

The assessment commit contains a valid approved assessment, has no governed implementation-path diff from the proposal baseline, precedes and is an ancestor of the earliest commit after the proposal baseline that changes a governed implementation path, and is an ancestor of T. Assessment and implementation in one commit fails. Amending or adding assessment after implementation does not repair normal ordering.

A retrospective exception is available only for grandfathered or emergency work whose order cannot be reconstructed. It is explicitly human-owned and records owner identity, reason, commits, paths, residual risk, and reduced assurance. The checker never infers it. Missing ancestry and shallow clones fail closed.

### D5 — Catalog invariant binding

Every catalog entry has immutable versioned invariant IDs. A named-pattern assessment records pattern ID, catalog version, required, conditional, and non-applicable invariant IDs, force-based reasons, implementation task IDs, and verification evidence IDs. Every mandatory invariant must be accounted for. Non-applicability is permitted only for catalog-declared conditional invariants, a force-based reason, and explicit acknowledgement in the signed governance record.

Direct implementation uses implementation-specific invariant IDs and keeps selected-pattern IDs empty. It does not claim catalog conformance.

The 24 entries are:

1. Adapter
2. Strategy
3. State
4. Command
5. Factory
6. Builder
7. Facade
8. Decorator
9. Specification
10. Repository
11. Unit of Work
12. Domain Service
13. Immutable Value Object
14. Capability
15. Explicit Trust Boundary
16. Fail Closed
17. Authority Provenance
18. Idempotency Key
19. Atomic Reservation
20. Transactional Outbox
21. Circuit Breaker
22. Bulkhead
23. Bounded Retry
24. Ambient Context / Context Propagation

Ambient Context belongs to Runtime / Execution Context. Required invariants cover immutable frames, explicit run-scope ownership, no global authority fallback, concurrent isolation, no cross-request leakage, no retention after scope exit, no authority inferred solely from ambient presence, and explicit missing-context behavior. Security guidance covers hidden authority and confused-deputy risk. Tests cover concurrent runs, nested scopes, cleanup, and rejected-promise/exception leakage. Misuse distinguishes it from service locator, global mutable state, and implicit ambient authorization, and cross-links Capability, Explicit Trust Boundary, and immutable values.

### D6 — Fail closed and self-governance

After activation, absent, empty, truncated, invalid, unsupported, incompatible, or hash-mismatched policy/activation evidence fails with a stable distinct diagnostic. Missing classifications or protected roots also fail. Missing policy never means zero applicable changes or successful skip.

Governance-core includes checker, policy, activation record, schemas, catalog, invariant registry, actor-neutral documentation, repository-managed root and generated agent instruction surfaces, CI workflow, and path classifications. Every governance-core change requires a full assessment, security-sensitive analysis, explicit reviewer acknowledgement, baseline-checker validation, and candidate-checker validation. The trusted checker from the merge-base/protected-mainline baseline and the candidate checker both run; neither pass substitutes for the other.

### D7 — Candidate approaches

A full assessment evaluates direct implementation and at least one materially plausible alternative matching observed forces. The alternative may be composition, an existing abstraction, a language-native mechanism, a named catalog pattern, or another simpler design. A direct decision keeps selected-pattern IDs empty and rejects at least one alternative with a force-based reason. A named-pattern decision evaluates and rejects direct implementation and binds catalog invariants. “Best practice” and irrelevant pattern lists do not satisfy comparison.

### D8 — Applicability and security

The controlled terms `Full-assessment change`, `Abbreviated-eligible change`, and `Material capability modification` are the only applicability vocabulary; deprecated ambiguous materiality labels are invalid in normative evidence.

Security trigger dimensions are trust boundary, authority provenance, authentication/authorization, audit integrity, confidentiality, mutation ownership, fail posture, error disclosure, concurrency, lifecycle, retention, retry/redelivery, cryptography, privacy transformation, and external security integration. `security_sensitive: false` requires justification for applicable dimensions. Positive declaration always wins. Path classes are minimum trigger floors, not ceilings.

### D9 — Review freshness and merge identity

S binds T from a governance-record-only path without invalidating itself, and no reviewed path contains S — signing a record stored inside the reviewed content would change that content. Later governance-record-only commits remain valid. Any post-signing normative change invalidates S, including tests, assessment, checker, schema, catalog, compatibility, workflow, and CI. Archive relocation preserves S only when every governed blob is byte-identical. Governed merge permits only merge commit or fast-forward; no alternate-strategy escape hatch exists.

### D10 — Schema compatibility and ID lifecycle

The initial current schema version is `1.1`, and the initial explicit supported set is `1.0` and `1.1`. New changes use `1.1`. Version `1.0` remains accepted only for a pre-existing active change under its explicit final-review migration rule. Compatible minor additions may add optional evidence without weakening existing meaning. Breaking or evidence-weakening changes require a new major version. Any version outside the explicit supported set, including an unknown newer minor or major, fails with a distinct unknown-newer or unsupported-older diagnostic as applicable.

Pattern and invariant IDs cannot be reused. Deprecation preserves meaning; rename uses explicit alias/migration mapping; removal requires replacement/deactivation procedure and migration for every governed reference. Schema, checker, policy, and catalog changes run baseline plus candidate checkers.

### D11 — Executable repository-managed agent integration

Classify repository-managed root and generated agent instruction surfaces as governance-core and normative while keeping them non-authoritative. During apply, inspect actual generated skill frontmatter and repository-supported allowed-tools syntax. Authorize only the minimum expansion needed to run `node openspec/scripts/check-design-pattern-governance.mjs`. Do not assume `Bash(openspec:)` permits Node. Tests assert path classification, the governed sequence, and command permission; `openspec update` regeneration must fail CI if any generated property disappears. Canonical policy and required CI remain authoritative.

### D12 — Exact-change emergency classification

An emergency record is bound to exact change ID, proposal baseline, affected paths, conservative path class, reason, incident/operational reference, mandatory follow-up issue/task, and exact owner-governance commit. It applies only to that change and ends when merged or abandoned. It cannot downgrade public API, security, concurrency, persistence, or integration triggers and never exempts assessment. Missing fields fail; a valid record emits a distinct warning and proceeds with full assessment. No wall-clock expiry or time-based override is used.

### D13 — Lifecycle and archive separation

Activation boundary and lifecycle states are separate requirements. Proposal validation is not apply authorization. AI review, assignment, and informal messages are not owner approval. Signed governance, merge, activation, canonical materialization, and archive readiness remain distinct. Recording review and decision in one record collapses two records into one; it does not collapse that record's state into the states around it.

`openspec validate --all --strict` is not assumed to validate archived changes. Archive tasks explicitly verify task completeness, the T and S bindings, the signed record's authorizations granted and withheld, canonical capability materialization, publication/deployment restrictions, exact archive contents, and byte identity. Archive occurs only after active enforcement is verified and according to the governed lifecycle.

## Proposal Structural Counts

This corrected proposal contains exactly 24 normative requirements, 129 scenarios, 98 tasks, 24 planned catalog entries, and 29 unique controlled values across 30 family memberships in 10 families. These counts are calculated from the corrected artifacts and are verification assertions, not implementation progress.

## Compatibility Matrix

| Case | Result |
| --- | --- |
| current schema version | accepted when all evidence passes |
| supported older version | accepted only under recorded support and final-review migration rule |
| unsupported older version | fail closed with unsupported-old diagnostic |
| unknown newer version | fail closed with unknown-new diagnostic |
| compatible minor optional addition | baseline and candidate pass without weakening mandatory evidence |
| breaking major change | explicit migration and owner governance required |
| deprecated pattern ID | accepted only under deprecation policy; no reuse |
| renamed invariant | explicit alias/migration mapping required |
| removed invariant | rejected without replacement/deactivation and evidence migration |
| candidate makes mandatory evidence optional | rejected by baseline checker |
| mainline-present active change | bounded grandfathering from M tree evidence |
| external in-flight change | bounded grandfathering from branch and proposal evidence |
| scope expansion | normal full governance for expanded scope |

## Migration Plan

1. Record exact proposal apply authorization; no later task starts before it.
2. Finalize vocabulary, activation lifecycle, perimeter, path classes, schema compatibility, and rollout records.
3. Create schemas, catalog, invariant registry, actor-neutral documentation, and assessment/governance-record templates.
4. Implement the trusted-compatible checker behavior, then baseline-plus-candidate compatibility controls.
5. Add fixtures, mutations, Hermes executable integration, and CI.
6. Configure and verify the governance CI job as a required check for the protected mainline reference.
7. Run full technical verification and create T.
8. Create S, one signed governance record with closed governance-record-only scope.
9. Merge using an identity-preserving strategy to create or identify M.
10. Bootstrap and commit A as M's direct child; verify active enforcement.
11. Materialize the canonical capability and archive only through the governed lifecycle with explicit archive validation.

## Risks / Trade-offs

- Complete-history requirements may require CI checkout changes; accepting shallow uncertainty would weaken deterministic ancestry and is prohibited.
- Dual checker execution increases governance-core CI cost; it is necessary to prevent self-approval.
- Exact branch-protection evidence may require a platform API or signed repository record; activation remains incomplete until the chosen evidence is independently verifiable.
- Conservative unclassified-path treatment may block urgent work; the exact-change emergency classification enables progress without downgrading assessment.
- Twenty-four catalog entries increase documentation maintenance; immutable IDs, schema compatibility, and baseline/candidate checks contain drift.

## Open Questions

None. Apply-time discovery is limited to repository-supported Hermes frontmatter syntax, concrete required-check evidence mechanics, and environment-specific commands; those tasks may not weaken the normative outcomes above.
