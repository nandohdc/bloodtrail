## Purpose

Govern repository-wide software design-pattern decisions so non-trivial implementations use explicit, evidence-based architectural judgment while preferring direct code when no named pattern provides a concrete benefit.

## ADDED Requirements

### Requirement: Pattern-governance applicability is classified before implementation
Before implementation work begins, every OpenSpec change that modifies implementation code SHALL classify its design-pattern assessment as `full` or `abbreviated`. A `full` assessment SHALL be required when the change introduces an abstraction; changes lifecycle or state management; changes concurrency; introduces an external integration boundary; introduces persistence or a transactional boundary; modifies a public API; or changes security-sensitive behavior. An `abbreviated` assessment SHALL be permitted only for a trivial correction with one bounded behavior, no new abstraction, and none of the full-assessment triggers.

#### Scenario: Non-trivial implementation is gated
- **WHEN** an implementation change meets one or more full-assessment triggers and has no validated full assessment
- **THEN** the governed workflow SHALL reject implementation start

#### Scenario: Trivial correction uses abbreviated assessment
- **WHEN** a correction changes one bounded implementation behavior, introduces no abstraction, and meets no full-assessment trigger
- **THEN** the governed workflow SHALL accept an abbreviated assessment that records the problem, direct-implementation decision, simplicity reason, and focused verification

#### Scenario: Abbreviated assessment hides an abstraction
- **WHEN** a change classified as `abbreviated` introduces a new abstraction or meets another full-assessment trigger
- **THEN** deterministic verification SHALL reject the classification and require a full assessment

#### Scenario: Assessment is completed before implementation
- **WHEN** implementation evidence predates completion of the required pattern assessment
- **THEN** final governance verification SHALL reject the sequencing as non-conformant

### Requirement: Full assessments record the decision basis
A full Design Pattern Assessment SHALL identify the problem, architectural forces, constraints, expected variation points, candidate patterns, rejected patterns, selected named pattern or `direct_implementation` decision, simplicity assessment, testing implications, security and correctness implications, pattern invariants, verification strategy, and re-evaluation triggers.

#### Scenario: Complete assessment is accepted
- **WHEN** a full assessment contains every required element and its machine-readable references resolve to the corresponding human-readable evidence
- **THEN** assessment-phase verification SHALL accept its structure for substantive review

#### Scenario: Required decision basis is missing
- **WHEN** a full assessment omits any required element or contains an unresolved machine-readable reference
- **THEN** assessment-phase verification SHALL reject it with a bounded diagnostic identifying the missing element or reference

#### Scenario: Pattern name replaces analysis
- **WHEN** an assessment records a pattern name but does not record the problem forces, invariants, and verification implications associated with the selection
- **THEN** assessment-phase verification SHALL reject the assessment

### Requirement: Direct implementation is a valid and preferred decision
The implementation agent SHALL prefer `direct_implementation` when no named pattern produces a concrete improvement in correctness, maintainability, security, testability, lifecycle clarity, concurrency safety, or integration isolation. The absence of a named pattern SHALL NOT be treated as a design failure.

#### Scenario: Simple bug fix selects no pattern
- **WHEN** a bug fix changes one stable behavior and no meaningful variation, lifecycle, integration, persistence, security, or concurrency force exists
- **THEN** the assessment SHALL select `direct_implementation` and explain why an additional abstraction would be less simple

#### Scenario: Single implementation rejects unnecessary Strategy
- **WHEN** there is one realistic stable algorithm and no observable interchangeability requirement
- **THEN** the assessment SHALL reject Strategy rather than create a ceremonial strategy contract

#### Scenario: Simple construction rejects unnecessary Builder
- **WHEN** object construction has no staged process, optional combination complexity, or invariant-bearing assembly
- **THEN** the assessment SHALL reject Builder or Factory in favor of direct construction

#### Scenario: Persistence-free code rejects Repository
- **WHEN** the affected behavior has no persistence boundary
- **THEN** the assessment SHALL reject Repository and SHALL NOT introduce persistence terminology or interfaces

#### Scenario: Speculative extensibility is the only benefit
- **WHEN** a candidate pattern is justified only by a possible future variation
- **THEN** the assessment SHALL choose the simpler current approach and record the observable event that would trigger re-evaluation

### Requirement: Pattern selection is tied to observable architectural forces
Every selected named pattern SHALL reference one or more observable architectural forces and SHALL explain the concrete problem each force creates. “Best practice,” “may be needed later,” “more extensible,” popularity, and the pattern name itself SHALL NOT constitute sufficient selection evidence.

#### Scenario: Multiple algorithms select Strategy
- **WHEN** two or more realistic algorithms must be interchangeable through one stable client contract
- **THEN** a Strategy selection SHALL identify algorithm variation, stable contract behavior, and interchangeability tests

#### Scenario: Lifecycle transitions select State
- **WHEN** behavior depends on explicit lifecycle states and invalid transitions must be prevented
- **THEN** a State selection SHALL identify transition ownership, allowed transitions, invalid-transition behavior, and lifecycle tests

#### Scenario: External vendor boundary selects Adapter
- **WHEN** an external vendor interface must be translated without leaking vendor semantics into the internal model
- **THEN** an Adapter selection SHALL identify both semantic boundaries, translation ownership, failure mapping, and isolation tests

#### Scenario: Vague best-practice justification is rejected
- **WHEN** the only stated selection evidence is that a pattern is common, extensible, or a best practice
- **THEN** substantive assessment SHALL reject the selection pending a concrete force

### Requirement: Material alternatives and simplicity are evaluated
A full assessment SHALL identify material alternatives and explain why each rejected alternative does not satisfy the observed forces as effectively or simply as the selected approach. The alternatives SHALL normally include applicable choices among direct implementation, composition, an existing repository abstraction, a language-native mechanism, the proposed pattern, and a simpler competing pattern.

#### Scenario: Existing abstraction is considered
- **WHEN** the repository already contains an abstraction that could address the same force
- **THEN** the assessment SHALL evaluate reuse or extension of that abstraction before introducing a new one

#### Scenario: Rejected alternative lacks a reason
- **WHEN** a material alternative is listed without a force-based rejection reason
- **THEN** assessment-phase verification SHALL reject the alternative record as incomplete

#### Scenario: Simpler language mechanism is sufficient
- **WHEN** a TypeScript or Node.js language-native mechanism satisfies the forces and invariants without an additional pattern structure
- **THEN** the assessment SHALL prefer that mechanism or explain the concrete deficiency that justifies the larger structure

### Requirement: Repository guidance defines practical pattern evidence
The governed repository SHALL provide a required Design Pattern Assessment template, an ADR template for pattern decisions that warrant an ADR, and a practical non-exhaustive TypeScript/Node.js pattern catalog. The assessment template SHALL contain Problem, Architectural forces, Constraints, Candidate patterns, Selected approach, Rejected alternatives, Simplicity check, Security and correctness implications, Pattern invariants, Verification strategy, and Re-evaluation triggers. Every catalog entry SHALL contain intent, use-when guidance, avoid-when guidance, required invariants, TypeScript/Node.js considerations, security implications, concurrency implications, minimum verification, common misuse, and related patterns.

#### Scenario: Initial catalog coverage is complete
- **WHEN** the catalog is validated for initial adoption
- **THEN** it SHALL contain exactly one governed entry for Adapter, Strategy, State, Command, Factory, Builder, Facade, Decorator, Specification, Repository, Unit of Work, Domain Service, Immutable Value Object, Capability, Explicit Trust Boundary, Fail Closed, Authority Provenance, Idempotency Key, Atomic Reservation, Transactional Outbox, Circuit Breaker, Bulkhead, and Bounded Retry

#### Scenario: Catalog entry omits required guidance
- **WHEN** an initial catalog entry omits one or more required fields
- **THEN** deterministic documentation verification SHALL reject the catalog

#### Scenario: Catalog is treated as exhaustive
- **WHEN** repository guidance claims that only cataloged patterns may be considered
- **THEN** governance verification SHALL reject the claim because observed forces may justify another documented pattern

### Requirement: Selected patterns have documented and verified invariants
When a named pattern is selected, the assessment and implementation SHALL document participant responsibilities, state ownership, trust and mutation boundaries, lifecycle behavior, concurrency behavior where applicable, failure semantics, and pattern-specific invariants. Behavioral tests SHALL prove the intended invariants and prevent bypass of the abstraction where bypass is possible.

#### Scenario: Capability protects authority provenance
- **WHEN** Capability is selected for an authority token
- **THEN** verification SHALL prove that authority is issued and owned by the trusted component and cannot be reconstructed from copied or structurally similar caller data

#### Scenario: Atomic Reservation protects completion rights
- **WHEN** Atomic Reservation is selected for concurrent completion
- **THEN** verification SHALL prove that concurrent callers cannot both acquire the same completion right and SHALL cover reservation release or retention for each failure outcome

#### Scenario: Command makes retry and side effects explicit
- **WHEN** Command is selected for an operation with identity, retries, audit behavior, or side effects
- **THEN** verification SHALL prove the documented execution identity, retry semantics, side-effect boundary, and failure behavior

#### Scenario: Selected invariant has no behavioral test
- **WHEN** a selected pattern invariant has no referenced behavioral verification
- **THEN** implementation-phase verification SHALL reject the change

#### Scenario: Abstraction bypass is possible but untested
- **WHEN** callers can attempt to bypass a security, lifecycle, persistence, or concurrency abstraction
- **THEN** verification SHALL require a negative bypass test in addition to the positive behavior test

### Requirement: Assessments evaluate over-engineering and known anti-patterns
Every full assessment SHALL evaluate whether the proposed implementation introduces speculative abstraction, unnecessary factories, a service locator, global mutable state, excessive inheritance, a god object, misleading or excessively fragmented interfaces, Repository without persistence, Strategy without a genuine variation point, wrapper layers that obscure control flow, or pattern terminology without the pattern invariants.

#### Scenario: Service locator is proposed
- **WHEN** dependencies would be resolved through ambient lookup rather than explicit ownership or injection
- **THEN** the assessment SHALL identify the service-locator risk and reject it unless a concrete constraint and mitigation are documented

#### Scenario: Wrapper chain obscures control flow
- **WHEN** proposed Decorator or Facade layers make mutation, authority, lifecycle, or failure ownership unclear
- **THEN** the assessment SHALL reject or simplify the wrapper structure before implementation

#### Scenario: Pattern terminology lacks behavior
- **WHEN** documentation labels code with a pattern but the implementation lacks the pattern's stated invariants
- **THEN** final correspondence verification SHALL reject the claim

### Requirement: Security-sensitive changes receive misuse-oriented analysis
A security-sensitive assessment SHALL identify trust boundaries, authority ownership and provenance, mutation boundaries, failure modes, fail-open or fail-closed behavior, concurrency implications, misuse cases, and bypass tests. Generic pattern guidance SHALL NOT weaken domain-specific security or privacy requirements.

#### Scenario: Security-sensitive change lacks misuse tests
- **WHEN** a security-sensitive pattern selection has positive tests but no misuse or bypass test references
- **THEN** deterministic verification SHALL reject the assessment or implementation evidence

#### Scenario: Fail posture is unspecified
- **WHEN** a security-sensitive boundary can fail and the assessment does not define fail-open, fail-closed, or a bounded domain-specific outcome
- **THEN** assessment-phase verification SHALL reject the decision as incomplete

#### Scenario: Pattern guidance conflicts with a domain requirement
- **WHEN** generic pattern guidance conflicts with a canonical security, privacy, lifecycle, concurrency, or correctness requirement
- **THEN** the domain-specific requirement SHALL control and the conflict SHALL be reported

### Requirement: Governance evidence is deterministic and relational
Applicable changes SHALL include versioned machine-readable assessment metadata that identifies assessment level, decision type, force IDs, candidate and rejected alternative IDs, selected pattern IDs, invariant IDs, security sensitivity, introduced abstraction IDs, verification task IDs, and re-evaluation trigger IDs. A deterministic checker SHALL validate schema and referential coherence without choosing a pattern, scoring prose, or treating pattern keywords as evidence.

#### Scenario: Candidate or direct decision is recorded
- **WHEN** assessment-phase verification runs
- **THEN** the checker SHALL require at least one candidate pattern or an explicit `direct_implementation` decision, together with architectural-force references

#### Scenario: Selected pattern lacks force or invariant references
- **WHEN** metadata selects a named pattern without resolving at least one force ID and one invariant ID
- **THEN** the checker SHALL reject the assessment with a bounded relational error

#### Scenario: Rejected alternatives lack reasons
- **WHEN** metadata references a rejected alternative without a corresponding human-readable reason
- **THEN** the checker SHALL reject the assessment

#### Scenario: Keyword substitution attempts to satisfy governance
- **WHEN** pattern names appear in prose but required metadata relationships or evidence sections are absent
- **THEN** the checker SHALL reject the change rather than infer compliance from keywords

#### Scenario: Checker is asked to choose a pattern
- **WHEN** two structurally valid assessments select different approaches for explicitly stated forces
- **THEN** the checker SHALL validate each assessment's required evidence without declaring either architecture objectively correct

### Requirement: Implementation tasks preserve assessment and verification traceability
For an applicable code-changing change, tasks SHALL include implementation work corresponding to the selected approach, behavioral verification for every selected invariant, misuse or bypass verification for security-sensitive behavior, verification for each introduced abstraction, deterministic governance checks, and a final implementation-correspondence review.

#### Scenario: Invariant test task is missing
- **WHEN** a selected invariant has no referenced implementation or verification task
- **THEN** task-format or governance verification SHALL reject the task plan

#### Scenario: New abstraction lacks behavioral verification
- **WHEN** an implementation introduces a new abstraction not linked to a behavioral test task
- **THEN** implementation-phase verification SHALL reject the change

#### Scenario: Final correspondence task is missing
- **WHEN** an applicable task plan has no final review comparing implementation to the approved assessment
- **THEN** task-format or governance verification SHALL reject the task plan

### Requirement: Final review verifies implementation correspondence
Final technical verification SHALL compare the exact implementation under review with the approved assessment and SHALL identify a selected pattern not implemented, material structural divergence, a new unassessed abstraction, a removed invariant, or documentation that claims behavior the implementation does not exhibit.

#### Scenario: Implementation diverges from approved pattern
- **WHEN** the implementation materially changes participant responsibilities, ownership, boundaries, lifecycle, concurrency, or failure behavior from the approved assessment
- **THEN** final verification SHALL fail until the assessment is updated and revalidated or the implementation is restored

#### Scenario: Unassessed new abstraction is introduced
- **WHEN** final review discovers an abstraction that is not identified in the approved assessment metadata
- **THEN** final verification SHALL reject the change and require assessment before acceptance

#### Scenario: Final review confirms selected invariants
- **WHEN** the exact reviewed implementation corresponds to the approved participants and boundaries and every invariant has passing behavioral evidence
- **THEN** the final correspondence record SHALL identify the reviewed commit, implementation mapping, and invariant-test evidence

#### Scenario: Documented pattern behavior is absent
- **WHEN** documentation claims a pattern but exact-commit review finds that its required behavior is absent
- **THEN** final verification SHALL reject the pattern claim and implementation correspondence

### Requirement: Pattern decisions define re-evaluation triggers
Every full assessment SHALL define observable events that require the decision to be reconsidered. Applicable triggers SHALL include a second algorithm implementation, materially increased branching complexity, explicit lifecycle state, concurrency, a new external integration, persistence, transactional boundaries, repeated invariant-bearing construction, or tests that require excessive mocking or internal access.

#### Scenario: Future variation appears
- **WHEN** a second realistic algorithm implementation appears after a direct or single-strategy decision
- **THEN** the next material change SHALL re-evaluate Strategy against the now-observable variation force

#### Scenario: Persistence is introduced
- **WHEN** persistence or a transactional boundary is added to previously persistence-free behavior
- **THEN** the next assessment SHALL reconsider Repository, Unit of Work, or a simpler persistence boundary without presuming either pattern is required

#### Scenario: Test friction exposes a boundary problem
- **WHEN** verification begins requiring materially excessive mocking or internal access
- **THEN** the pattern decision SHALL be re-evaluated for an observable ownership or isolation boundary

### Requirement: Repository-managed Hermes apply workflow enforces the sequence
The repository-managed Hermes apply workflow SHALL read the canonical design-pattern-governance capability, inspect the requested change and repository architecture, complete the required assessment, select a named pattern or `direct_implementation`, validate the assessment before implementation, implement the approved approach, add invariant tests, run final implementation-correspondence review, and report the decision and residual risks. Hermes SHALL NOT introduce a new abstraction without evaluating it and SHALL NOT treat a pattern name as proof of correctness.

#### Scenario: Hermes begins implementation without capability context
- **WHEN** Hermes is asked to apply an applicable OpenSpec change without reading the canonical governance capability and the change assessment
- **THEN** the repository-managed workflow SHALL block implementation until both inputs are read and validated

#### Scenario: Hermes introduces an unassessed abstraction
- **WHEN** implementation work would introduce a new abstraction not present in the validated assessment
- **THEN** Hermes SHALL pause implementation and update or request update of the assessment before continuing

#### Scenario: Hermes completes the governed sequence
- **WHEN** implementation and invariant tests are complete
- **THEN** Hermes SHALL perform exact-scope correspondence review before reporting technical completion

### Requirement: Implementation reports expose pattern decisions and risks
Every non-trivial implementation report SHALL state the selected named pattern or `direct_implementation`, architectural forces, reasons, rejected alternatives, abstractions introduced, implementation correspondence, tests proving pattern invariants, unresolved architectural risks, and potential over-engineering concerns.

#### Scenario: No-pattern implementation is reported
- **WHEN** the selected approach is `direct_implementation`
- **THEN** the report SHALL state the no-pattern decision, simplicity reasons, rejected abstractions, focused tests, and re-evaluation triggers

#### Scenario: Patterned implementation is reported
- **WHEN** one or more named patterns are selected
- **THEN** the report SHALL map each pattern to its forces, implementation participants, invariant tests, rejected alternatives, and residual risks

#### Scenario: Required risk disclosure is omitted
- **WHEN** a non-trivial implementation report omits unresolved architectural risks or potential over-engineering concerns
- **THEN** final reporting verification SHALL treat the report as incomplete

### Requirement: Adoption has a deterministic, non-bypassable activation boundary
Governance activation SHALL be identified only from committed repository evidence: the unique protected-mainline commit that first introduces both the canonical `software-design-pattern-governance` capability and its activation-baseline record. That record SHALL bind the activation parent tree and provenance-bearing proposal commit, tree, and blob fingerprints for qualifying active changes. A non-trivial change absent from that baseline SHALL comply, including a materially new OpenSpec change that modifies a capability predating activation. An active change present in the baseline SHALL remain valid without rewriting approved planning evidence, MAY opt in explicitly, and SHALL require retroactive conformance only through an explicit recorded migration decision; new design decisions in a grandfathered change SHOULD follow the policy where practical. Archived changes SHALL remain immutable and SHALL NOT acquire retroactive assessment artifacts. Classification SHALL use Git object identity, ancestry, and content lineage rather than wall-clock time, file modification time, Git author date alone, local environment variables, directory name, optional metadata, or an exemption list without repository provenance. Technical verification, exact-commit review, project-owner approval, implementation authorization, merge readiness, and archive readiness SHALL remain distinct states.

#### Scenario: New non-trivial change after activation is required to comply
- **WHEN** a non-trivial OpenSpec change is absent from the provenance-backed active-change set recorded at activation
- **THEN** governance verification SHALL require the applicable design-pattern assessment before implementation

#### Scenario: Existing active change before activation remains valid
- **WHEN** an active change has a proposal commit, tree, and blob fingerprint recorded in the activation baseline
- **THEN** governance verification SHALL preserve its approved pre-activation planning evidence without requiring rewrite or rejecting the change

#### Scenario: Existing active change explicitly opts in
- **WHEN** a grandfathered active change records an explicit opt-in decision with repository provenance
- **THEN** governance verification SHALL apply the design-pattern assessment policy according to that recorded opt-in scope

#### Scenario: Existing canonical capability receives a new material change after activation
- **WHEN** a materially new post-activation OpenSpec change modifies a canonical capability that existed before activation
- **THEN** governance verification SHALL require the new change to comply without requiring unrelated historical refactoring

#### Scenario: Archived historical change is not rewritten
- **WHEN** governance activates while archived OpenSpec evidence already exists
- **THEN** protected-history verification SHALL preserve its Git objects and SHALL NOT require new assessment artifacts in the archive

#### Scenario: Renaming a post-activation change does not bypass enforcement
- **WHEN** a post-activation change is renamed, moved, or recreated under another identifier
- **THEN** governance verification SHALL classify it from provenance and content lineage and SHALL continue to require compliance

#### Scenario: False trivial-change claim involving a public API is rejected
- **WHEN** a change claims abbreviated treatment while introducing or modifying a public API
- **THEN** governance verification SHALL reject the claim and require a full assessment

#### Scenario: False trivial-change claim involving concurrency is rejected
- **WHEN** a change claims abbreviated treatment while introducing or modifying concurrency behavior
- **THEN** governance verification SHALL reject the claim and require a full assessment

#### Scenario: Activation can be reproduced from a clean clone
- **WHEN** verification runs from a clean clone containing the protected history and activation-baseline record
- **THEN** it SHALL derive the same activation commit, grandfathered proposal set, and applicability decisions from repository evidence

#### Scenario: Activation behavior does not depend on wall-clock time
- **WHEN** wall-clock time, file modification times, Git author dates, or local environment variables differ while committed repository evidence is identical
- **THEN** activation and grandfathering classifications SHALL remain identical

#### Scenario: Current SDK remediation follows grandfathering policy
- **WHEN** the proposal baseline for `remediate-security-audit-sdk-adversarial-review` predates activation and its provenance is recorded in the activation baseline
- **THEN** governance verification SHALL treat it as grandfathered without modifying or retroactively rejecting its approved artifacts

#### Scenario: Proposal validation is mistaken for apply authorization
- **WHEN** proposal artifacts and strict validation are complete but no explicit project-owner apply authorization is recorded
- **THEN** implementation SHALL remain unauthorized and all apply tasks SHALL remain incomplete

#### Scenario: AI review is presented as owner approval
- **WHEN** an AI assessment, PR assignment, or informal message exists without an explicit project-owner decision bound to the reviewed commit
- **THEN** governance status SHALL remain unapproved for merge and archive
