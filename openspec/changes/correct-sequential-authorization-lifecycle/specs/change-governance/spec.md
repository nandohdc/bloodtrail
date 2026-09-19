# Change Governance Delta Specification

## ADDED Requirements

### Requirement: Sequential operation authorization is immutable and interval-scoped

Every schema-backed operation authorization SHALL remain byte-immutable after its dedicated signed
introducing commit. Governance SHALL validate the schema, first-recording history, dedicated commit,
signature, principal, role, exact object bindings, and scope of every authorization record in an
operation chain, including predecessors that are no longer effective. An embedded lifecycle status
SHALL NOT exempt a signed record from provenance validation or retroactively change its authority.
Legacy-index status SHALL classify only the legacy records that the index binds and SHALL NOT
override a schema-backed authorization record.

A root authorization SHALL have no predecessor. A proposed successor authorization SHALL be a new
dedicated signed record for the same change and operation, SHALL name exactly one predecessor, and
SHALL carry a closed `supersession` binding for the predecessor's exact identifier, path, recorded
blob SHA-256, and introducing commit SHA-1. The successor's own dedicated signed introducing commit
SHALL bind the successor's exact path and blob. Its boundary parent anchor `boundary_parent` SHALL
equal that introducing commit's sole parent commit. These predecessor and parent bindings, together
with the successor's independently verified dedicated commit, SHALL constitute the exact transition
evidence. Neither authorization record SHALL be edited.

The graph of authorizations for each change and operation SHALL be evaluated topologically in memory.
The validated successor graph SHALL be acyclic, SHALL contain no self-supersession, cycles, or forks,
and SHALL resolve to exactly one effective leaf at the repository identity being evaluated. Missing,
unsigned, stale, mismatched, ambiguous, cyclic, or conflicting supersession evidence SHALL fail closed.
Selection SHALL NOT fall back to filename order, embedded `CURRENT` count, or documentary claims.

#### Scenario: Valid immutable predecessor-to-successor transition
- **WHEN** the predecessor and successor are independently valid immutable signed records, the successor
  binds the predecessor and its own boundary parent exactly, the graph has one leaf, and each changed
  path is within the scope effective at its commit
- **THEN** governance preserves the predecessor as verified historical evidence and selects only the
  successor as effective authority for commits in the successor interval

#### Scenario: Multiple effective leaves fail closed
- **WHEN** two roots or transition branches create multiple un-superseded leaves for the same change
  and operation
- **THEN** governance fails closed with `authorization-multiple-leaves` and selects no authority

#### Scenario: Successor lacks valid supersession binding
- **WHEN** a subsequent authorization record exists but omits required `supersession` fields or carries
  a null binding
- **THEN** governance rejects the successor with `missing-supersession-binding` and does not apply its scope

#### Scenario: Successor is unsigned or signature is invalid
- **WHEN** a successor authorization is unsigned, committed without an SSH signature, or fails
  cryptographic verification
- **THEN** governance rejects the successor with `invalid-signature`

#### Scenario: Predecessor attribute mismatch
- **WHEN** a successor's declared predecessor identifier, path, blob SHA-256, or introducing commit
  differs from the actual predecessor record in repository history
- **THEN** governance rejects the successor with `predecessor-binding-mismatch`

#### Scenario: Cross-change or cross-operation supersession
- **WHEN** a successor references a predecessor belonging to a different change or different operation
- **THEN** governance rejects the binding with `predecessor-binding-mismatch`

#### Scenario: Boundary anchor mismatch
- **WHEN** a successor's declared `boundary_parent` differs from the sole parent commit of its dedicated
  introducing commit
- **THEN** governance rejects the successor with `boundary-anchor-mismatch`

#### Scenario: Historical signed authorization bytes edited
- **WHEN** any predecessor authorization's recorded bytes differ from its first-recorded git blob
- **THEN** governance fails closed with `historical-record-tampered` even though a valid successor exists

#### Scenario: Historical status mutated
- **WHEN** a historical predecessor's embedded status is edited from `CURRENT` to `SUPERSEDED`
- **THEN** governance rejects the history mutation with `historical-status-mutation`

#### Scenario: Self-supersession attempt
- **WHEN** an authorization names its own identifier or path as its predecessor
- **THEN** governance rejects the cyclic binding with `self-supersession`

#### Scenario: Cyclic supersession chain
- **WHEN** traversing predecessor-to-successor links encounters an authorization already visited in the chain
- **THEN** governance rejects the chain with `cyclic-supersession`

#### Scenario: Historical inactive predecessor fails cryptographic verification
- **WHEN** a historical predecessor lacks a valid cryptographic signature
- **THEN** governance fails closed with `historical-signature-invalid` regardless of its superseded status

### Requirement: Discrete commit sets and dedicated introducing commits

Governance SHALL partition the evaluation of changed paths into discrete half-open commit intervals:
$(C_A, P_B]$ for the predecessor, and $(C_B, \text{HEAD}]$ for the successor, where $C_A$ is the
predecessor introducing commit, $C_B$ is the successor introducing commit, and $P_B$ is the boundary
parent commit of $C_B$.

The introducing commits $C_A$ and $C_B$ SHALL each be dedicated single-path commits that modify strictly
their own authorization record. Dedicated introducing commits SHALL be verified for cryptographic signature
validity and single-path modification, and SHALL be exempt from implementation `scope_paths` checks.
Commits in $(C_A, P_B]$ SHALL be checked strictly against the predecessor's `scope_paths`.
Commits in $(C_B, \text{HEAD}]$ SHALL be checked strictly against the successor's `scope_paths`.

#### Scenario: Successor scope applied retroactively
- **WHEN** a commit in the predecessor interval $(C_A, P_B]$ touches a path that is only declared in the
  successor's `scope_paths`
- **THEN** governance rejects the commit with `retroactive-scope-violation`

#### Scenario: Predecessor scope applied after successor boundary
- **WHEN** a commit in the successor interval $(C_B, \text{HEAD}]$ touches a path that was declared in the
  predecessor's `scope_paths` but omitted from the successor's `scope_paths`
- **THEN** governance rejects the commit with `successor-scope-violation`

#### Scenario: Dedicated introducing commit touches multiple paths
- **WHEN** an authorization introducing commit modifies any path other than its own authorization file
- **THEN** governance rejects the introducing commit with `non-dedicated-introducing-commit`

#### Scenario: Discrete intervals validate independently
- **WHEN** commits in $(C_A, P_B]$ adhere strictly to predecessor scope and commits in $(C_B, \text{HEAD}]$
  adhere strictly to successor scope
- **THEN** governance validates both intervals successfully

### Requirement: Operation-aware commit attribution and debt immunity

Governance SHALL attribute commits within the governed range to specific operations according to a closed
seven-operation taxonomy: `PROPOSE`, `IMPLEMENT`, `VERIFY`, `RESOLVE_DEBT`, `FOLD`, `ACTIVATE`, and `RELEASE`.
Scope checking for an `IMPLEMENT` authorization SHALL evaluate only commits attributed to `IMPLEMENT`.
Commits that modify normative precedence pins (`openspec/governance/normative-precedence-pins/**`) SHALL be
attributed to `RESOLVE_DEBT` and SHALL be immune from `IMPLEMENT` scope checking.

#### Scenario: Pre-fold debt retirement commit immune from implementation scope check
- **WHEN** a commit within the revision range modifies only normative precedence pins under operation `RESOLVE_DEBT`
- **THEN** governance attributes the commit to `RESOLVE_DEBT` and does not fail the `IMPLEMENT` scope check
