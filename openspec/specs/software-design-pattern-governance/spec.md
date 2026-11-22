# software-design-pattern-governance Specification

## Purpose

Govern repository-wide software design-pattern decisions through actor-neutral, exact-history, fail-closed evidence while permitting direct implementation when no named catalog pattern is justified.

## Requirements

### Requirement: R1 — Applicability uses a closed vocabulary
A `Full-assessment change` SHALL be any change that modifies public API, integration, lifecycle/state, concurrency, persistence, security-sensitive behavior, a governance-core path, or a canonical capability requirement. An `Abbreviated-eligible change` SHALL satisfy the closed abbreviated criteria and prove that no full trigger applies. A `Material capability modification` SHALL add, modify, or remove a normative capability requirement, or modify a capability-owned governed implementation path while matching a full trigger. Undefined terms such as non-trivial, materially new, and materially modifies SHALL NOT determine enforcement.

#### Scenario: Full trigger requires full assessment
- **WHEN** a change matches any defined full-assessment trigger
- **THEN** governance verification SHALL require a full assessment

#### Scenario: Closed abbreviated criteria are satisfied
- **WHEN** one bounded correction proves that no full trigger applies and introduces no abstraction
- **THEN** governance verification MAY accept an abbreviated assessment with focused evidence

#### Scenario: Undefined materiality label is used
- **WHEN** applicability relies on an undefined materiality label instead of the controlled vocabulary
- **THEN** governance verification SHALL reject the classification

#### Scenario: Canonical requirement changes
- **WHEN** a change adds, modifies, or removes a normative canonical capability requirement
- **THEN** the change SHALL be classified as a Full-assessment change and Material capability modification

### Requirement: R2 — Full assessments compare candidate approaches
A full assessment SHALL evaluate direct implementation and at least one materially plausible alternative matching the identified architectural forces. Every rejected alternative SHALL have a force-based reason. The alternative MAY be composition, an existing repository abstraction, a language-native mechanism, a named catalog pattern, or a simpler competing design. Exhaustive catalog enumeration and a named pattern SHALL NOT be required.

#### Scenario: Direct implementation has plausible alternative analysis
- **WHEN** a full assessment selects direct implementation and evaluates a plausible force-matching alternative
- **THEN** assessment verification SHALL accept the candidate-approach relation when every rejection is force-based

#### Scenario: Direct implementation has no alternative
- **WHEN** a full assessment selects direct implementation without evaluating a materially plausible alternative
- **THEN** assessment verification SHALL reject the assessment

#### Scenario: Named pattern omits direct implementation
- **WHEN** a full assessment selects a named pattern without evaluating direct implementation
- **THEN** assessment verification SHALL reject the assessment

#### Scenario: Best practice is the only rejection reason
- **WHEN** an alternative is rejected only by a best-practice assertion
- **THEN** assessment verification SHALL reject the reason as non-force-based

#### Scenario: Irrelevant patterns are enumerated
- **WHEN** an assessment lists irrelevant catalog patterns as boilerplate instead of one plausible alternative
- **THEN** assessment verification SHALL reject the candidate analysis

### Requirement: R3 — Direct implementation is first-class
For `direct_implementation`, `selected_pattern_ids` SHALL be empty, at least one rejected alternative SHALL be recorded, and each rejection SHALL reference architectural forces. Direct implementation SHALL record implementation-specific invariants without claiming catalog-pattern conformance.

#### Scenario: Valid direct implementation
- **WHEN** a direct decision has no selected pattern IDs, has a force-based rejected alternative, and records implementation-specific invariants
- **THEN** governance verification SHALL accept the decision structure

#### Scenario: Direct decision claims catalog conformance
- **WHEN** a direct decision claims conformance to selected catalog-pattern invariants
- **THEN** governance verification SHALL reject the contradictory decision

#### Scenario: Direct decision carries selected pattern IDs
- **WHEN** a direct decision contains one or more selected pattern IDs
- **THEN** schema and relational verification SHALL reject it

### Requirement: R4 — Named-pattern selection is force-based
A named pattern SHALL be selected only when observable forces justify it, direct implementation is evaluated and rejected, and the selection records concrete correctness, ownership, lifecycle, concurrency, persistence, security, or boundary benefits. Popularity, speculative extensibility, pattern names, and best-practice claims SHALL NOT suffice.

#### Scenario: Strategy has observable variation
- **WHEN** multiple realistic algorithms must be interchangeable behind one stable contract
- **THEN** a Strategy assessment SHALL record the variation force and interchangeability evidence

#### Scenario: State has lifecycle forces
- **WHEN** behavior depends on explicit states and invalid transitions must be prevented
- **THEN** a State assessment SHALL record transition ownership and invalid-transition behavior

#### Scenario: Pattern name substitutes for forces
- **WHEN** a named pattern is justified only by its name, popularity, or speculative future use
- **THEN** assessment verification SHALL reject the selection

### Requirement: R5 — Selected patterns bind versioned catalog invariants
Every catalog pattern entry SHALL define versioned invariant IDs. A named-pattern assessment SHALL record pattern ID, catalog version, applicable required invariant IDs, conditional invariant IDs, non-applicable conditional IDs with force-based reasons, implementation task IDs, and verification evidence IDs. The checker SHALL load the referenced catalog version and account for every mandatory invariant. A mandatory invariant MAY be non-applicable only when catalog-declared conditional, force-justified, and explicitly acknowledged in the signed governance record.

#### Scenario: State omits transition invariants
- **WHEN** State is selected without all required transition invariant IDs and evidence
- **THEN** governance verification SHALL reject the assessment

#### Scenario: Capability lacks unforgeable authority
- **WHEN** Capability is selected without its unforgeable-runtime-authority invariant and evidence
- **THEN** governance verification SHALL reject the assessment

#### Scenario: Atomic Reservation occurs after await
- **WHEN** Atomic Reservation evidence permits reservation only after an await boundary
- **THEN** governance verification SHALL reject the invariant correspondence

#### Scenario: Adapter lacks boundary isolation
- **WHEN** Adapter is selected without required boundary-isolation invariants
- **THEN** governance verification SHALL reject the assessment

#### Scenario: Repository lacks persistence semantics
- **WHEN** Repository is selected without persistence ownership and semantics invariants
- **THEN** governance verification SHALL reject the assessment

#### Scenario: Unrelated invariant token is referenced
- **WHEN** a selected pattern references only an unrelated invariant token
- **THEN** catalog relation verification SHALL reject the assessment

#### Scenario: Unknown invariant ID is referenced
- **WHEN** evidence references an invariant ID absent from the selected catalog version
- **THEN** governance verification SHALL reject it with an unknown-invariant diagnostic

#### Scenario: Wrong catalog version supplies invariant
- **WHEN** an invariant exists only in a catalog version other than the recorded version
- **THEN** governance verification SHALL reject the version mismatch

#### Scenario: Required invariant lacks test evidence
- **WHEN** a required invariant has no implementation task or verification evidence ID
- **THEN** implementation verification SHALL reject the change

### Requirement: R6 — Repository guidance provides 24 catalog entries
The initial non-exhaustive catalog SHALL contain exactly 24 entries: Adapter, Strategy, State, Command, Factory, Builder, Facade, Decorator, Specification, Repository, Unit of Work, Domain Service, Immutable Value Object, Capability, Explicit Trust Boundary, Fail Closed, Authority Provenance, Idempotency Key, Atomic Reservation, Transactional Outbox, Circuit Breaker, Bulkhead, Bounded Retry, and Ambient Context / Context Propagation. Every entry SHALL define versioned invariant IDs, intent, use/avoid guidance, TypeScript/Node.js shape, security and concurrency implications, minimum verification, misuse, and related patterns.

#### Scenario: Initial catalog is complete
- **WHEN** initial catalog documentation is validated
- **THEN** exactly 24 unique governed entries with every required field SHALL exist

#### Scenario: Catalog is treated as exhaustive
- **WHEN** guidance claims only catalog entries may be considered
- **THEN** documentation verification SHALL reject the claim

#### Scenario: Catalog entry omits invariant IDs
- **WHEN** a catalog entry has prose invariants but no versioned invariant IDs
- **THEN** catalog verification SHALL reject the entry

### Requirement: R7 — Ambient Context has authority and isolation invariants
Ambient Context / Context Propagation SHALL be categorized under Runtime / Execution Context. Its required invariants SHALL include immutable context frame, explicit run-scope ownership, no implicit global authority fallback, isolation across concurrent execution contexts, no cross-request leakage, no retention after scope exit, authority not inferred solely from ambient presence, and explicit behavior when no context exists. Its guidance SHALL cover hidden authority, confused-deputy risk, nested scopes, exception and rejected-promise cleanup, and distinguish it from service locator, global mutable state, and implicit ambient authorization. It SHALL cross-link Capability, Explicit Trust Boundary, and immutable value guidance.

#### Scenario: Concurrent Ambient Context runs are isolated
- **WHEN** two concurrent run scopes carry distinct context frames
- **THEN** verification SHALL prove neither scope observes the other frame

#### Scenario: Nested Ambient Context scope exits
- **WHEN** a nested scope completes normally
- **THEN** verification SHALL restore the outer immutable frame and retain no nested frame

#### Scenario: Ambient Context promise rejects
- **WHEN** a scoped operation rejects or throws
- **THEN** verification SHALL prove cleanup and no later cross-request leakage

#### Scenario: Ambient presence is treated as authority
- **WHEN** authorization is granted solely because ambient context exists
- **THEN** security verification SHALL reject the hidden-authority design

#### Scenario: Missing context behavior is implicit
- **WHEN** Ambient Context has no explicit behavior for an absent context
- **THEN** catalog and invariant verification SHALL reject the entry or assessment

### Requirement: R8 — Security sensitivity uses behavioral dimensions
Security-sensitive triggers SHALL include trust boundary, authority provenance, authentication or authorization, audit integrity, data confidentiality, mutation ownership, fail-open/fail-closed behavior, error disclosure, concurrency, lifecycle behavior, resource retention, retry/redelivery, cryptography, privacy transformation, and external security integration. `security_sensitive: false` SHALL include justification addressing applicable dimensions. A positive declaration SHALL override a benign path class. Path classes SHALL be minimum trigger floors, not maximum ceilings.

#### Scenario: False has no justification
- **WHEN** evidence declares security sensitivity false without dimension-based justification
- **THEN** assessment verification SHALL reject the declaration

#### Scenario: Authority change contradicts false
- **WHEN** a change affects authority provenance while declaring security sensitivity false
- **THEN** governance verification SHALL require security-sensitive analysis

#### Scenario: Concurrency change contradicts false
- **WHEN** a change introduces concurrency while declaring security sensitivity false
- **THEN** governance verification SHALL require security-sensitive analysis

#### Scenario: Positive declaration on benign path
- **WHEN** evidence declares security sensitivity true on a benign-classified path
- **THEN** the positive declaration SHALL require security-sensitive analysis

#### Scenario: Resource retention changes
- **WHEN** a change modifies resource retention or cleanup ownership
- **THEN** security classification SHALL evaluate retention risk and fail posture

#### Scenario: Lifecycle behavior changes
- **WHEN** a change modifies lifecycle ownership or transitions
- **THEN** security classification SHALL evaluate lifecycle misuse and bypass risk

### Requirement: R9 — Governance schemas are compatible and IDs are stable
The policy SHALL record current schema version, supported range, major/minor compatibility rules, unknown-newer and unsupported-older behavior, active-change migrations, grandfathering rules, ID deprecation, prohibition on ID reuse, alias/migration maps, and deactivation/replacement procedures. New changes SHALL use the current version. Supported older active changes MAY remain until final review only under explicit migration rules. Unknown or unsupported versions SHALL fail closed with distinct diagnostics.

#### Scenario: Supported old schema is used
- **WHEN** a pre-existing active change uses an explicitly supported older schema
- **THEN** governance verification SHALL apply the recorded compatibility and final-review migration rule

#### Scenario: Unsupported old schema is used
- **WHEN** evidence uses an older version outside the supported range
- **THEN** governance verification SHALL fail with the unsupported-old-version diagnostic

#### Scenario: Unknown new schema is used
- **WHEN** evidence uses a newer version unknown to the trusted checker
- **THEN** governance verification SHALL fail with the unknown-new-version diagnostic

#### Scenario: Compatible minor field is added
- **WHEN** a minor version adds optional evidence without weakening existing meaning
- **THEN** baseline and candidate compatibility verification MAY accept it

#### Scenario: Breaking major change is proposed
- **WHEN** a schema change removes or weakens mandatory evidence
- **THEN** governance verification SHALL require a new major version, migration, and governance-core review

#### Scenario: Deprecated pattern ID remains referenced
- **WHEN** governed evidence references a deprecated pattern ID
- **THEN** verification SHALL preserve its meaning and apply the recorded deprecation or migration rule

#### Scenario: Invariant is renamed with mapping
- **WHEN** an invariant ID is renamed through an explicit alias and migration mapping
- **THEN** compatibility verification SHALL resolve it without reusing the old ID for new meaning

#### Scenario: Invariant is removed without migration
- **WHEN** a referenced invariant is removed without replacement or deactivation migration
- **THEN** baseline and candidate verification SHALL reject the catalog change

### Requirement: R10 — Assessment ordering is proven by Git ancestry
Assessment ordering SHALL be proven from Git ancestry, never from commits an assessment declares about itself. A change's assessment commit is the first commit that adds its `assessment.json`. It SHALL strictly precede every governed commit in the reviewed range that the change owns, so it SHALL NOT itself change a governed path the change owns, except that a commit several changes own SHALL be accepted when the assessment commit of at least one of them strictly precedes it. A change that owns a governed commit in the reviewed range but has no commit adding its assessment SHALL fail closed, whatever the other owners show. Ordering commits recorded in the assessment SHALL be optional, and SHALL be checked against history rather than trusted; a recorded assessment commit SHALL change no governed implementation path. Complete Git history SHALL be required. A retrospective exception SHALL never be inferred and SHALL be available only for grandfathered or emergency work with owner identity, reason, affected commits, paths, residual risk, and reduced-assurance confirmation. A generated assessment SHALL derive its proposal baseline only from an explicit value authored in `assessment.source.json`; it SHALL NOT derive that value from the checkout's current `HEAD`.

#### Scenario: Valid assessment precedes implementation
- **WHEN** the commit that first adds a change's assessment strictly precedes every governed commit in the reviewed range that the change owns
- **THEN** ordering verification SHALL accept the ancestry

#### Scenario: Assessment follows implementation
- **WHEN** a governed commit in the reviewed range that the change owns is not a descendant of the commit that first adds the change's assessment, and no other change that owns the commit has an assessment commit that strictly precedes it
- **THEN** ordering verification SHALL reject the sequence

#### Scenario: Assessment and implementation share a commit
- **WHEN** one commit first introduces both a change's assessment and governed implementation that the change owns, and no other change that owns that implementation has an assessment commit that strictly precedes it
- **THEN** ordering verification SHALL reject the sequence

#### Scenario: Assessment is unrelated
- **WHEN** a recorded assessment commit does not change the assessment, is neither the commit that first adds it nor a descendant of that commit, or does not precede the change's governed commits in the reviewed range
- **THEN** ordering verification SHALL reject the claim

#### Scenario: Assessment is amended after implementation
- **WHEN** a commit in the reviewed range changes the assessment's decision content after one of the change's own governed commits in that range
- **THEN** normal ordering verification SHALL reject it rather than backdate approval

#### Scenario: First implementation ancestry is missing
- **WHEN** complete ancestry is unavailable, or no commit adding the assessment can be found for a change that owns a governed commit in the reviewed range
- **THEN** governance verification SHALL fail closed with a bounded diagnostic

#### Scenario: Human retrospective exception is explicit
- **WHEN** eligible grandfathered or emergency work records every retrospective-exception field
- **THEN** verification MAY proceed while reporting that retrospective assessment is not equivalent assurance

#### Scenario: Generated assessment crosses a merge boundary
- **WHEN** a generated assessment is checked at a descendant merge commit without an authored source change
- **THEN** the generated assessment SHALL remain byte-identical and retain its original explicit proposal baseline

#### Scenario: Source omits a proposal baseline
- **WHEN** an assessment source requests generation without an explicit proposal baseline
- **THEN** generation SHALL fail with a bounded diagnostic rather than binding ordering evidence to the current checkout

#### Scenario: Ordering is derived when nothing is recorded
- **WHEN** an assessment records no assessment, earliest implementation or final technical commit
- **THEN** ordering verification SHALL still derive the assessment commit from history and check every governed commit in the reviewed range that the change owns

#### Scenario: Another change's commit does not count
- **WHEN** a governed commit outside a change's owned paths lands on the shared mainline after that change's proposal baseline and before its assessment
- **THEN** ordering verification SHALL NOT attribute that commit to the change

#### Scenario: Several changes own a commit
- **WHEN** a governed commit in the reviewed range touches paths owned by more than one change
- **THEN** ordering verification SHALL accept it if the assessment commit of at least one owning change strictly precedes it

#### Scenario: Recorded earliest implementation commit disagrees with history
- **WHEN** a recorded earliest governed implementation commit is not a governed commit the change owns, does not follow the change's assessment commit, or is preceded by another governed commit the change owns in the reviewed range
- **THEN** ordering verification SHALL reject the record

#### Scenario: Evidence is recorded after implementation
- **WHEN** a commit in the reviewed range changes only the assessment's ordering record, invariant evidence, verification task identifiers or owned paths after implementation begins
- **THEN** ordering verification SHALL accept the change as evidence and scope bookkeeping rather than an amended approval

#### Scenario: Contract-reuse record accompanies the assessment
- **WHEN** the commit that first adds a change's assessment also adds that change's contract-reuse record
- **THEN** ordering verification SHALL treat the record as a planning artifact rather than governed implementation

#### Scenario: Amendment in a later range is not tied back
- **WHEN** an assessment's decision content changes in a reviewed range that contains none of the change's own governed commits
- **THEN** ordering verification SHALL NOT report it as an amendment after implementation, and this limit SHALL be disclosed as a limit rather than presented as assurance

### Requirement: R11 — The governance perimeter is actor-neutral and capability-bound
After activation, any change touching a governed implementation path SHALL be associated with an applicable OpenSpec change for the modified capability and design-pattern governance evidence. The policy SHALL inspect the material commit range and behavior in tests, build files, scripts, and configuration. It SHALL apply equally to humans, Hermes, Claude Code, other agents, direct commits, pull requests, and scripts. A successful perimeter check whose explicitly supplied full-SHA baseline equals the resolved current `HEAD` SHALL report that baseline, zero inspected commits, and zero inspected paths; it SHALL NOT omit range-result fields merely because no material commit is present.

#### Scenario: Code changes without OpenSpec
- **WHEN** a governed implementation path changes without an applicable OpenSpec change
- **THEN** perimeter verification SHALL reject the change

#### Scenario: OpenSpec change is unrelated
- **WHEN** an OpenSpec change exists but does not own or describe the modified capability
- **THEN** perimeter verification SHALL reject the association

#### Scenario: Documentation-only claim changes implementation
- **WHEN** a change claims documentation-only scope while modifying governed implementation
- **THEN** perimeter verification SHALL reject the classification

#### Scenario: Implementation is hidden in supporting paths
- **WHEN** tests, build files, scripts, or configuration introduce material implementation behavior
- **THEN** perimeter verification SHALL classify and govern that behavior

#### Scenario: Material work is split across commits
- **WHEN** one material change is divided across commits to evade classification
- **THEN** range-level perimeter verification SHALL evaluate and reject the evasion

#### Scenario: Explicit full-SHA baseline is an empty range
- **WHEN** a perimeter check receives an explicit full-SHA baseline equal to the current resolved `HEAD`
- **THEN** it SHALL retain its successful verdict and report that baseline with exactly zero inspected commits and zero inspected paths

#### Scenario: Public API is called internal
- **WHEN** a public API change is labeled internal-only
- **THEN** behavioral trigger evidence SHALL override the label and require full assessment

#### Scenario: Concurrency is called performance-only
- **WHEN** concurrency is introduced under a performance-only label
- **THEN** behavioral trigger evidence SHALL require full and security-sensitive assessment

#### Scenario: Human direct commit is governed
- **WHEN** a human direct commit changes the same governed path as an agent change
- **THEN** the same perimeter and evidence requirements SHALL apply

### Requirement: R12 — Actor-neutral policy and required CI are authoritative
The canonical capability, policy configuration, trusted baseline checker, candidate checker where applicable, and required governance CI check SHALL be authoritative. Checked-in `CONTRIBUTING.md`, governance documentation, and a pull-request template SHALL describe the perimeter. `AGENTS.md`, `CLAUDE.md`, `.hermes.md`, and generated agent instructions SHALL NOT be sole policy sources. Activation SHALL be prohibited until required-check enforcement is verified for the configured protected mainline reference and stored as activation evidence.

#### Scenario: Actor-neutral documentation is absent
- **WHEN** the actor-neutral perimeter document or pull-request guidance is removed
- **THEN** governance-core verification SHALL reject the change

#### Scenario: Agent guidance conflicts with canonical policy
- **WHEN** repository-managed agent instructions conflict with the canonical capability or checker
- **THEN** canonical policy and required CI SHALL control and the conflict SHALL fail verification

#### Scenario: Required branch check is missing
- **WHEN** governance CI is not verified as a required check for the configured protected reference
- **THEN** activation SHALL remain incomplete

#### Scenario: Branch name is treated as protection evidence
- **WHEN** protection is inferred solely from a branch named main
- **THEN** activation verification SHALL reject the evidence

### Requirement: R13 — Missing or weakened governance evidence fails closed
After activation, absent, empty, truncated, invalid JSON, missing schema version, unsupported schema, activation hash mismatch, missing activation commit, missing protected-mainline evidence, missing governed path classifications, missing protected-history roots, and checker/configuration incompatibility SHALL fail closed with stable distinct diagnostics. Missing policy SHALL never mean no applicable changes, skip governance, or success.

#### Scenario: Policy file is removed
- **WHEN** the policy file is absent
- **THEN** verification SHALL fail with the policy-absent diagnostic

#### Scenario: Policy file is empty
- **WHEN** the policy file has zero meaningful content
- **THEN** verification SHALL fail with the policy-empty diagnostic

#### Scenario: Policy file is truncated
- **WHEN** the policy file ends before a complete valid record
- **THEN** verification SHALL fail with the policy-truncated or invalid-JSON diagnostic

#### Scenario: Policy JSON is invalid
- **WHEN** the policy file contains syntactically invalid JSON
- **THEN** verification SHALL fail with the invalid-JSON diagnostic

#### Scenario: Schema version is absent
- **WHEN** policy evidence lacks its schema-version field
- **THEN** verification SHALL fail with the schema-version-absent diagnostic

#### Scenario: Activation hash mismatches
- **WHEN** recorded activation evidence does not match committed objects
- **THEN** verification SHALL fail with the activation-hash-mismatch diagnostic

#### Scenario: Activation commit is missing
- **WHEN** normal enforcement cannot locate the bound activation-record commit in protected history
- **THEN** verification SHALL fail with the activation-commit-absent diagnostic

#### Scenario: Protected mainline evidence is missing
- **WHEN** policy or activation evidence lacks the configured protected reference, merge commit, merge tree, or required-check proof
- **THEN** verification SHALL fail with the protected-mainline-evidence-absent diagnostic

#### Scenario: Governed classifications are missing
- **WHEN** policy evidence lacks governed path classifications
- **THEN** verification SHALL fail with the path-classification-absent diagnostic

#### Scenario: Protected root is removed
- **WHEN** a required protected-history root is removed
- **THEN** baseline verification SHALL reject the weakening

#### Scenario: Checker and configuration are incompatible
- **WHEN** checker compatibility does not include the policy schema version
- **THEN** verification SHALL fail with the checker-policy-incompatible diagnostic

### Requirement: R14 — Governance-core changes run trusted and candidate checks
Governance-core artifacts SHALL include checker, policy configuration, activation record, schemas, catalog, invariant registry, actor-neutral policy documentation, repository-managed root and generated agent instruction surfaces, CI governance workflow, and governed path classifications. Each governance-core change SHALL require full assessment, security-sensitive analysis, explicit reviewer acknowledgement, trusted baseline-checker validation from the merge-base/protected-mainline baseline, and candidate-checker validation. A candidate checker SHALL NOT be its sole judge.

#### Scenario: Checker is changed to succeed unconditionally
- **WHEN** the candidate checker is changed to return success for invalid evidence
- **THEN** the trusted baseline checker SHALL reject the weakening

#### Scenario: Path classification is silently widened
- **WHEN** candidate policy broadens an exempt or benign path class without acknowledgement
- **THEN** baseline verification SHALL reject the change

#### Scenario: Schema makes invariants optional
- **WHEN** a candidate schema makes previously mandatory invariant evidence optional
- **THEN** baseline verification SHALL reject the weakening

#### Scenario: Governance CI job is removed
- **WHEN** the governance CI job is deleted or disabled
- **THEN** baseline verification and activation evidence checks SHALL fail

#### Scenario: Governance-core change passes both checkers
- **WHEN** an acknowledged governance-core change satisfies trusted baseline and candidate future-format checks
- **THEN** technical review MAY consider it without either checker implying owner approval

### Requirement: R15 — One signed governance record binds frozen technical content
Technical review and the project-owner decision SHALL be recorded as a single signed governance record S rather than as separate governance records or separate governed task groups. S SHALL bind a content object — a tree or subtree identifier — covering the reviewed technical content, and SHALL additionally name the technical commit T; a commit hash alone SHALL NOT satisfy the binding. A reviewed path SHALL NOT contain S. Normative paths SHALL include implementation, invariant tests, assessment/design artifacts, schemas, checker, policy, catalog, invariant definitions, compatibility claims, workflow, and CI. Governance-record-only paths SHALL use a closed allowlist for the signed governance record, status record, merge-readiness record, and archive-readiness record. Any post-signing normative change SHALL invalidate S. Governance-record-only commits SHALL NOT invalidate it.

#### Scenario: Review and decision are recorded separately
- **WHEN** technical review and the project-owner decision are recorded as two governance records or two governed task groups
- **THEN** governance verification SHALL reject the split record

#### Scenario: Record binds only a commit hash
- **WHEN** a signed record names a reviewed commit without binding a reviewed content object
- **THEN** binding verification SHALL reject the record

#### Scenario: Governance-only commit follows the signed record
- **WHEN** a closed governance-record-only commit follows S without changing normative blobs
- **THEN** the binding of S to T SHALL remain valid

#### Scenario: Normative commit follows the signed record
- **WHEN** any normative path changes after S
- **THEN** S SHALL become stale and require a new signed record for a new T

#### Scenario: Test evidence changes after signing
- **WHEN** a test proving an invariant changes after S
- **THEN** S SHALL become stale

#### Scenario: Assessment changes after signing
- **WHEN** assessment or design evidence changes after S
- **THEN** S SHALL become stale

#### Scenario: Checker changes after signing
- **WHEN** checker, schema, policy, catalog, workflow, or CI changes after S
- **THEN** S SHALL become stale

#### Scenario: Archive relocation is byte-identical
- **WHEN** archive relocation preserves every governed blob byte-for-byte
- **THEN** S MAY remain valid while the archive commit records the relocation

### Requirement: R16 — Governed merge preserves reviewed identities
The governed history SHALL use T, the signed governance record commit S binding T, M introducing T and S on the protected mainline, and A directly following M. M SHALL use a merge commit or fast-forward preserving identities. Squash merge, rebase merge, amendment, force-push, and other history rewriting SHALL be prohibited.

#### Scenario: Merge commit preserves identities
- **WHEN** M introduces T and S with their exact identities through a merge commit
- **THEN** merge identity verification SHALL accept the strategy

#### Scenario: Fast-forward preserves identities
- **WHEN** the protected mainline fast-forwards through T and S without rewriting them
- **THEN** merge identity verification SHALL accept the strategy

#### Scenario: Squash merge is attempted
- **WHEN** T and S would be replaced by a squash commit
- **THEN** governed merge verification SHALL reject activation

#### Scenario: Rebase merge is attempted
- **WHEN** T or S would receive a rewritten identity through rebase merge
- **THEN** governed merge verification SHALL reject activation

### Requirement: R17 — Activation uses a dedicated direct-child record
The protected mainline reference SHALL be configured explicitly. The activation-record commit A SHALL be a dedicated commit whose sole parent is exactly M and whose tree changes only the activation record and specifically allowlisted evidence. A SHALL bind the protected reference, M and its tree, T, the signed governance record S and its reviewed content object, checker blob, policy blob, schema blobs, catalog blob, actor-neutral policy-document blob, required-CI identity and enforcement evidence, supported schema versions, and grandfathered entries. A SHALL NOT reference its own hash. Activation SHALL begin at A.

#### Scenario: Valid technical governance merge activation sequence
- **WHEN** exact T then S are identity-preserved by M and A is M's dedicated direct child with all bound evidence
- **THEN** activation verification SHALL identify A as the activation boundary

#### Scenario: Activation record precedes mainline merge
- **WHEN** an activation record is committed before M
- **THEN** activation verification SHALL reject the sequence

#### Scenario: Activation parent mismatches merge
- **WHEN** A's parent is not exactly M
- **THEN** activation verification SHALL fail with the activation-parent diagnostic

#### Scenario: Activation contains implementation changes
- **WHEN** A includes unrelated implementation or non-allowlisted changes
- **THEN** bootstrap verification SHALL reject A

#### Scenario: Reviewed technical commit is missing
- **WHEN** A cannot prove exact T in the identity-preserved history
- **THEN** activation verification SHALL fail closed

#### Scenario: Checker blob is altered
- **WHEN** A's bound checker blob differs from T
- **THEN** activation verification SHALL fail with the checker-blob-mismatch diagnostic

#### Scenario: Policy blob is altered
- **WHEN** A's bound policy configuration blob differs from T
- **THEN** activation verification SHALL fail with the policy-blob-mismatch diagnostic

#### Scenario: Activation history is shallow
- **WHEN** the clone lacks history required to prove T/S/M/A ancestry
- **THEN** activation verification SHALL fail with the activation-history-unavailable diagnostic

### Requirement: R18 — Bootstrap is exact and one-time
Before normal enforcement exists, one-time bootstrap SHALL permit only creation of A after proving exact approved T, the exact signed governance record S and its reviewed content object, exact M parent, exact artifact blobs, required-check evidence, and no unrelated A changes. Bootstrap SHALL end permanently after A and SHALL NOT be re-entered.

#### Scenario: Exact bootstrap succeeds
- **WHEN** every approved identity and blob matches and A changes only allowlisted activation evidence
- **THEN** bootstrap MAY create A and terminate permanently

#### Scenario: Bootstrap lacks required CI evidence
- **WHEN** required-check enforcement evidence is absent or unverifiable
- **THEN** bootstrap SHALL fail and activation SHALL remain incomplete

#### Scenario: Bootstrap is attempted after activation
- **WHEN** A already exists in protected history and bootstrap mode is requested again
- **THEN** verification SHALL reject bootstrap re-entry

### Requirement: R19 — Grandfathering has two provenance classes
A `mainline_present` entry SHALL identify change ID, proposal path, proposal blob hash, proposal baseline commit, and M-tree membership. An `external_in_flight` entry SHALL identify change ID, remote branch reference, exact branch head, proposal baseline commit, proposal blob hash, OpenSpec metadata hash, owner rationale, and bounded continuing scope. A change SHALL use the class matching its actual provenance and SHALL NOT be required both to exist in M and only on an external branch.

#### Scenario: Mainline-present change is recorded
- **WHEN** an active change exists in M's tree with matching proposal evidence
- **THEN** a complete mainline-present entry MAY grandfather its recorded scope

#### Scenario: External branch is recorded
- **WHEN** an active change is absent from M but has complete owner-recorded remote-branch evidence
- **THEN** a complete external-in-flight entry MAY grandfather its recorded scope

#### Scenario: Preferred SDK rollout completes first
- **WHEN** the active SDK remediation merges before governance activation
- **THEN** activation SHALL classify it from actual M-tree state without asserting false proposal-baseline provenance

#### Scenario: Governance activates before SDK remediation
- **WHEN** governance activates while the SDK remediation remains only on its remote branch
- **THEN** it SHALL require a complete external-in-flight entry to continue under grandfathering

#### Scenario: Grandfathered scope expands
- **WHEN** a grandfathered change adds public API, integration, persistence, lifecycle, concurrency, security boundary, governed capability, or paths outside its record
- **THEN** the expanded scope SHALL require normal full governance

### Requirement: R20 — Opt-in and withdrawal are exact and bounded
A grandfathered change MAY opt in through evidence bound to an exact commit. Opt-in SHALL become irrevocable at the first governed implementation commit. Withdrawal before that commit SHALL require explicit project-owner governance evidence. Silent withdrawal SHALL be invalid.

#### Scenario: Opt-in is recorded before implementation
- **WHEN** exact-commit owner evidence opts a grandfathered change into governance before governed implementation
- **THEN** governance SHALL apply from the recorded opt-in scope

#### Scenario: Withdrawal occurs before implementation
- **WHEN** explicit owner-governance evidence withdraws opt-in before any governed implementation commit
- **THEN** verification MAY restore the recorded grandfathered scope

#### Scenario: Withdrawal occurs after implementation
- **WHEN** withdrawal is attempted after the first governed implementation commit
- **THEN** governance verification SHALL reject it as irrevocable

#### Scenario: Withdrawal is silent
- **WHEN** opt-in metadata disappears without explicit owner-governance evidence
- **THEN** governance verification SHALL reject the silent withdrawal

### Requirement: R21 — Emergency classification is exact-change and path-bounded
For an otherwise unclassified path, an emergency classification record SHALL bind exact change ID, exact proposal baseline, exact affected paths, a conservative path class, reason, incident or operational reference, mandatory follow-up task or issue, and exact owner-governance commit. It SHALL apply only to that change, end when merged or abandoned, emit a distinct warning, and require full assessment. It SHALL NOT use wall-clock expiry or downgrade public API, security, concurrency, persistence, or integration triggers.

#### Scenario: Complete emergency record proceeds conservatively
- **WHEN** every exact-change emergency field is valid for an otherwise unclassified path
- **THEN** the checker SHALL warn distinctly and proceed under conservative full assessment

#### Scenario: Emergency record lacks a field
- **WHEN** any required emergency classification field is absent
- **THEN** governance verification SHALL fail the record

#### Scenario: Emergency attempts trigger downgrade
- **WHEN** an emergency record attempts to downgrade public API, security, concurrency, persistence, or integration
- **THEN** governance verification SHALL reject the downgrade

#### Scenario: Emergency record is reused
- **WHEN** another change attempts to reuse an emergency record
- **THEN** exact-change binding verification SHALL reject it

#### Scenario: Emergency change ends
- **WHEN** the exact governed change is merged or abandoned
- **THEN** the emergency classification SHALL cease without consulting wall-clock time

### Requirement: R22 — Repository-managed agent integration is executable but non-authoritative
Repository-managed root and generated agent instruction surfaces SHALL be classified as governance-core and normative while remaining non-authoritative. During apply, the actual generated skill frontmatter and repository-supported allowed-tools syntax SHALL be inspected. The minimum valid permission expansion SHALL permit `node openspec/scripts/check-design-pattern-governance.mjs`; no assumption that `Bash(openspec:)` permits Node SHALL be accepted. Workflow tests SHALL assert path classification, governed sequence, and command permission, and regeneration through `openspec update` SHALL fail CI if any generated property is removed. Canonical policy and required CI SHALL remain authoritative.

#### Scenario: Generated allowed-tools permits checker
- **WHEN** the repository-managed Hermes skill is materialized
- **THEN** a workflow test SHALL prove the governed sequence exists and the exact checker command is permitted

#### Scenario: Existing Bash scope is assumed sufficient
- **WHEN** apply assumes `Bash(openspec:)` permits the Node checker without testing actual syntax
- **THEN** Hermes integration verification SHALL fail

#### Scenario: Skill regeneration removes governance
- **WHEN** `openspec update` removes the sequence or checker permission
- **THEN** CI SHALL fail the workflow drift test

#### Scenario: Agent instruction surface changes
- **WHEN** a repository-managed root or generated agent instruction changes regardless of the actor
- **THEN** the perimeter SHALL govern its surface as normative governance-core content while canonical CI remains authoritative

### Requirement: R23 — Governance lifecycle states remain distinct
Proposal validation, apply authorization, technical verification, signed governance review and decision, merge readiness, activation, production/publication authorization, canonical materialization, and archive readiness SHALL remain distinct states. Recording review and decision in one signed record SHALL NOT merge the states that record establishes with the states that precede or follow it. AI review, PR assignment, authorship, and informal messages SHALL NOT create owner approval or apply authorization.

#### Scenario: Proposal validation is mistaken for authorization
- **WHEN** proposal artifacts validate but no explicit project-owner apply authorization exists
- **THEN** implementation SHALL remain unauthorized and every apply task SHALL remain unchecked

#### Scenario: AI review is presented as owner approval
- **WHEN** AI review, PR assignment, or an informal message exists without a signed governance record bound to reviewed content
- **THEN** signed-governance, merge, activation, and archive states SHALL remain incomplete

#### Scenario: Technical checks pass without production approval
- **WHEN** all technical checks pass but publication or deployment authorization is absent
- **THEN** production and publication SHALL remain prohibited

### Requirement: R24 — Archive evidence is validated explicitly
Archive validation SHALL NOT assume that `openspec validate --all --strict` validates archived changes. The governed archive step SHALL explicitly verify task completeness, the T and S bindings, the signed record's authorizations granted and withheld, canonical capability materialization, production/publication restrictions, immutable archive contents, exact changed paths, and byte identity of governed evidence. Archive SHALL occur only after active enforcement is verified.

#### Scenario: Repository-wide strict validation passes alone
- **WHEN** `openspec validate --all --strict` passes without explicit archive-evidence checks
- **THEN** archive readiness SHALL remain incomplete

#### Scenario: Explicit archive validation passes
- **WHEN** every archive evidence check, binding, restriction, materialization, path, and byte-identity assertion passes
- **THEN** archive readiness MAY be reported after the governed archive commit

#### Scenario: Archived governed blob changes
- **WHEN** archive relocation changes any governed blob bytes
- **THEN** archive verification SHALL reject the archive and invalidate the signed governance record

#### Scenario: Canonical capability is missing
- **WHEN** archive does not materialize the approved canonical capability
- **THEN** archive verification SHALL fail

### Requirement: R25 — Archive relocation is complete in the commit
A range that introduces a recognised archive relocation of a change SHALL NOT leave that change's active directory present at HEAD. Completeness SHALL be judged from the commit tree, not from the working tree, and SHALL be verified for every relocation the range introduces.

#### Scenario: Relocation adds the archive without removing the active directory
- **WHEN** a range introduces `openspec/changes/archive/<dated>-<id>/` and `openspec/changes/<id>/` still exists at HEAD
- **THEN** governance verification SHALL fail closed

#### Scenario: Relocation is complete
- **WHEN** a range introduces the dated archive directory and the active directory is absent at HEAD
- **THEN** governance verification SHALL accept the relocation

#### Scenario: An existing archive directory is edited later
- **WHEN** a range touches a dated archive directory whose relocation it did not introduce
- **THEN** the completeness check SHALL NOT fire on that directory

### Requirement: R26 — Path classification is complete over the tracked repository

The declared path classification SHALL cover every tracked repository path. Governance verification SHALL fail closed with a distinct diagnostic naming each tracked path that matches no declared classification, independently of whether the change under verification touches that path. Completeness SHALL be evaluated over tracked paths only, so untracked and ignored files impose no obligation. Completeness SHALL NOT be satisfied by an exact-change emergency classification record: an emergency record under R21 is bounded to one change and ends when that change merges or is abandoned, whereas a tracked path requires a classification that outlives any single change. Removing or narrowing a declared pattern SHALL fail whenever the result leaves a tracked path unclassified, so coverage cannot be withdrawn by deletion.

#### Scenario: A tracked path matches no declared classification

- **WHEN** the repository tracks a path that matches no pattern in any declared path class
- **THEN** governance verification SHALL fail with a distinct completeness diagnostic naming that path

#### Scenario: Completeness holds

- **WHEN** every tracked repository path matches at least one declared classification pattern
- **THEN** completeness verification SHALL pass and report the number of tracked paths it classified

#### Scenario: A new unclassified path is introduced

- **WHEN** a change adds a tracked path that matches no declared classification pattern
- **THEN** verification SHALL fail on that change rather than deferring the failure to a later change that happens to touch the path

#### Scenario: Coverage is withdrawn by deletion

- **WHEN** a change removes or narrows a declared pattern and a tracked path is left matching no classification
- **THEN** verification SHALL fail and name the paths the change left uncovered

#### Scenario: An emergency record is offered as completeness evidence

- **WHEN** an exact-change emergency classification record is the only classification covering a tracked path
- **THEN** completeness verification SHALL still fail for that path, because the record ends with its change

#### Scenario: Ignored files impose no obligation

- **WHEN** the working tree contains untracked or ignored files that match no declared classification pattern
- **THEN** completeness verification SHALL disregard them and SHALL NOT fail
