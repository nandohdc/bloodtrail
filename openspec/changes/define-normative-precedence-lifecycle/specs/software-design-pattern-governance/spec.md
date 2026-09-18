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

### Requirement: Fold-time applicability, overlap, and debt are recomputed from exact objects

Before a canonical fold can be accepted, repository enforcement SHALL materialize the proposed
canonical objects in an isolated preview and recompute applicable current capabilities for every
governed source section from exact repository-derived inputs. Active candidate deltas SHALL remain a
separate candidate-intent class and SHALL NOT masquerade as current canonical capabilities.

Every domain with multiple applicable current owners SHALL have exactly one overlap classification
bound to the exact new owner-object set. Any owner-object change SHALL make a prior classification
stale. Every semantic assertion SHALL be re-evaluated against the folded graph. Persisting debt SHALL
be rebound to the new exact objects and deterministically derived affected scope with historical
lineage; resolved debt SHALL be absent from the new current pin set but preserved in history; new or
broadened debt SHALL block and SHALL NOT receive an inherited-debt exception.

Missing, surplus, ambiguous, conflicting, stale, silently carried, or silently dropped evidence
SHALL fail closed.

#### Scenario: Applicability is copied from pre-fold state
- **WHEN** a fold changes a current capability object but presents only the pre-fold applicability
  result
- **THEN** repository enforcement rejects the stale evidence and requires recomputation from the
  folded preview

#### Scenario: Overlap owner object changes
- **WHEN** an overlap classification names the same capability paths but one bound capability blob
  differs from the folded object
- **THEN** repository enforcement rejects the old classification as stale

#### Scenario: Existing semantic debt persists after fold
- **WHEN** independent re-evaluation finds the same semantic contradiction against a newly folded
  canonical object
- **THEN** a new current debt entry binds the new objects, preserves historical lineage, and retains
  every applicable activation and release block

### Requirement: Governed path association uses the most-specific classification

Every governance association decision SHALL consume the same most-specific governed path
classification used by the repository path classifier. Association SHALL NOT flatten broader
`governance_core` or `governed_implementation` patterns with narrower
`governance_record_only` patterns into an unordered include set.

A path classified most-specifically as `governance_record_only` MAY be excluded from active-change
implementation ownership only when its dedicated closed-schema, exact-binding, history, authority,
and hidden-implementation validation passes. This rule SHALL NOT exempt the broader
`openspec/governance/` tree or waive association for implementation or governance-core paths in a
mixed commit. Duplicate helpers SHALL NOT define path specificity independently.

#### Scenario: Narrow record classification wins
- **WHEN** a path matches both a broad governance-core prefix and a narrower record-only prefix
- **THEN** association uses the most-specific record-only classification and still runs every
  dedicated record validation

#### Scenario: Nearby governance implementation path is treated as a record
- **WHEN** a checker attempts to exempt a governance policy, schema, script, or mixed commit by using
  the broader record-directory match
- **THEN** governance rejects the exemption and requires ordinary change association

### Requirement: Mutation assurance fails before kill-rate interpretation when coverage is incomplete

Governance mutation assurance SHALL use a closed manifest of exactly 22 planned Revision 3 mutants.
Static anchor preflight SHALL run before mutation execution and SHALL resolve exactly one live target
for every enabled mutant. The assurance gate SHALL require `EXPECTED_MUTANTS=22`,
`APPLIED_MUTANTS=22`, `KILLED_MUTANTS=22`, `NOT_APPLIED=0`, `SURVIVED=0`, clean null controls, and
byte-identical restoration.

Each mutant SHALL execute in isolation, change its intended object, and be killed by its declared
control. Any missing or ambiguous anchor, not-applied mutant, survivor, contaminated null control, or
non-identical restoration SHALL fail assurance before a mutation percentage is reported.

#### Scenario: Mutant anchor no longer applies
- **WHEN** one planned mutant matches zero or multiple live targets
- **THEN** anchor preflight fails and governance reports no passing kill rate

#### Scenario: All mutants apply and are killed
- **WHEN** all 22 anchors resolve uniquely, all mutants apply in isolation, every declared control
  kills its mutant, null controls remain clean, and restoration is byte-identical
- **THEN** mutation assurance passes with expected, applied, and killed counts all equal to 22
