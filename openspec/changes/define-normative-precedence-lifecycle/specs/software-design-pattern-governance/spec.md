## ADDED Requirements

### Requirement: Contract capability applicability and ownership are machine-resolvable

The governance policy SHALL enumerate the contract authority domains, semantic dimensions,
applicable current capabilities, authored-source sections, and representation delegations without
duplicating individual requirement prose. Each ownership entry SHALL identify a stable domain ID,
current capability path, exact requirement heading, source JSON-pointer scope, delegated concrete
representation freedom, and conflict rule.

Applicability SHALL be resolved from declared artifact or source scope, contract version range,
lifecycle state, and exact active-change capability path. Missing ownership, overlapping owners
without an explicit compatible-overlap rule, an absent capability or requirement, an unresolved
source pointer, or ambiguous applicability SHALL fail closed. Two applicable current capabilities
that contradict each other SHALL have no automatic winner and SHALL require governed reconciliation.

#### Scenario: Capability applicability is complete
- **WHEN** every contract source section resolves to one declared authority domain and every owning
  capability and requirement exists at its governed path
- **THEN** the checker reports complete applicability and permits further candidate validation

#### Scenario: Applicability is missing or ambiguous
- **WHEN** a source section has no owner or resolves to multiple owners without an explicit
  compatible-overlap relation
- **THEN** governance verification rejects the repository state rather than inferring ownership

#### Scenario: Applicable current capabilities conflict
- **WHEN** two current capabilities impose contradictory requirements on the same semantic dimension
  and scope
- **THEN** neither capability wins automatically and merge, activation, and release remain blocked
  until one governed reconciliation makes them consistent

### Requirement: Precedence enforcement is repository-aware and stage-aware

The precedence checker SHALL inspect the repository's current capability specifications, active
candidate deltas, archived change records, authored contract source, ownership policy, changed
contract semantics, compatibility-transition evidence, freeze/review bindings, activation evidence,
and Git object identities. It SHALL classify no-overlap, compatible overlap, duplicate consistent
requirements, contradictory requirements, and ambiguous overlap distinctly.

Policy-model tests SHALL prove the authority table's internal rules independently from repository
enforcement tests. Repository enforcement tests SHALL use disposable Git repositories and prove
actual path discovery, applicability, source-pointer resolution, transition legality, exact object
binding, compatibility-classification presence, and activation authority. A passing policy-model
test SHALL NOT substitute for repository enforcement.

#### Scenario: Abstract model passes but repository binding is wrong
- **WHEN** conflict-table rows are internally consistent but an actual capability, source pointer,
  reviewed object, or activation authority cannot be resolved
- **THEN** repository enforcement fails despite the policy-model pass

#### Scenario: Material compatibility transition is unclassified
- **WHEN** the material range changes a governed semantic source dimension and carries no applicable
  compatibility-transition classification
- **THEN** governance verification blocks merge and names the changed semantic scope

### Requirement: Precedence checkers use a trusted-baseline transition

A `TRUSTED_GOVERNANCE_CHECKER` SHALL enforce activated governance rules without defining contract
semantics. A `CANDIDATE_GOVERNANCE_CHECKER` MAY implement proposed policy but SHALL NOT become trusted
or validate its own trust merely by passing. Governance-core changes SHALL be evaluated separately by
the trusted baseline checker and candidate checker, carry failure-sensitive policy and repository
tests, receive exact-content project-owner review, and become trusted only at activation.

Where a new rule cannot be understood by the baseline checker, the baseline SHALL still enforce the
existing governance perimeter, assessment, review, and anti-weakening rules, while the new rule's
candidate implementation is proven by independent negative controls and exact review. A candidate
checker result SHALL never erase a baseline failure without the existing exact governed disagreement
mechanism.

#### Scenario: Candidate checker approves itself
- **WHEN** the only evidence for a checker or policy change is the changed checker reporting success
- **THEN** governance rejects the self-authorizing evidence

#### Scenario: Trusted and candidate checks are recorded separately
- **WHEN** a governance-core candidate reaches exact review
- **THEN** its record distinguishes baseline source and result from candidate source and result, and
  neither result is represented as project-owner approval

