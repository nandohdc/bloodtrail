## ADDED Requirements

### Requirement: Candidate deltas and archived records have distinct authority roles

An `ACTIVE_CANDIDATE_DELTA` SHALL be a delta under an active OpenSpec change whose capability,
scope, lifecycle state, and apply authorization are mechanically discoverable. Before apply
authorization it is proposed evidence only. After apply authorization it MAY direct candidate work
within its exact scope, but it SHALL NOT override activated semantics outside that scope or become
operative merely because code is implemented, merged, folded, archived, tagged, or tested.

An active delta SHALL cease to supply candidate intent when it is folded, rejected, superseded, or
withdrawn. An `ARCHIVED_CHANGE_RECORD` SHALL be historical rationale and evidence only. Archive
material SHALL NOT regain candidate or current authority, and an operative delta SHALL be folded
into every affected current capability and the authored contract representation before activation.

#### Scenario: Apply-authorized active delta guides candidate work
- **WHEN** an active delta has exact scoped apply authorization and does not claim current activation
- **THEN** implementation may follow it only within that candidate scope

#### Scenario: Active delta is treated as activated semantics
- **WHEN** implementation, merge, fold, archive, tag, or passing tests are offered as proof that an
  active delta is operative
- **THEN** governance rejects the claim until exact review and activation requirements are met

#### Scenario: Archived delta is cited as current authority
- **WHEN** an archived change differs from its folded current capability or authored source
- **THEN** current aligned material controls and the archive remains historical evidence only

### Requirement: Change records and contract candidates have orthogonal lifecycles

The change-record lifecycle SHALL use the states `PROPOSED`, `VALIDATED`, `APPLY_AUTHORIZED`,
`IMPLEMENTED`, `VERIFIED`, `FOLDED`, and `ARCHIVED`, with `REJECTED`, `WITHDRAWN`, and `SUPERSEDED`
as explicit terminal outcomes where applicable. The contract-candidate/version lifecycle SHALL use
the states `AUTHORED_CANDIDATE`, `GENERATED_CANDIDATE`, `TECHNICALLY_VERIFIED_FROZEN`,
`REVIEWED_DECIDED`, `MERGE_READY`, `MERGED`, `ACTIVATED`, `RELEASED`, and `SUPERSEDED`, with
`ABANDONED` as a pre-activation terminal outcome.

Each transition SHALL declare its entering authority, exact required evidence, allowed predecessor,
allowed successor, permitted operations, semantic claims, and invalidation or reversal behavior.
Folding and archiving a completed change record SHALL NOT supersede the contract version it helped
produce. Contract activation SHALL NOT archive a change automatically.

#### Scenario: Completed change is archived while its contract version remains active
- **WHEN** a verified change has been folded and its archive validation passes while the resulting
  contract version remains activated
- **THEN** the change record may enter `ARCHIVED` and the contract version remains `ACTIVATED`

#### Scenario: Lifecycle edge is not declared
- **WHEN** evidence claims a transition that is absent from the governed transition table
- **THEN** lifecycle verification rejects the transition with a stable diagnostic

### Requirement: Frozen candidates and review decisions bind exact immutable content

`TECHNICALLY_VERIFIED_FROZEN` SHALL bind the candidate commit, root tree, contract version, decision
scope, complete governed path-to-object set, and the object identity of every normative, generated,
compatibility-relevant, checker, test, and other governed semantic artifact in scope. No bound source,
derived output, policy, compatibility evidence, checker, or test may change within that candidate
identity. Any such change creates a new candidate identity and invalidates affected freeze and review
evidence.

A `REVIEWED_DECIDED` record SHALL bind the frozen candidate identity, exact reviewed technical
commit and tree, complete governed path-to-object bindings, contract version, decision scope,
reviewer identity, reviewer authority, authorizations granted, authorizations withheld, and decision
event. Post-review changes SHALL preserve that decision only when every changed path is in the closed
governance-record-only allowlist and no changed object is in the reviewed binding. Any other change
invalidates the decision; subjective materiality labels SHALL NOT be used.

#### Scenario: Bound object changes after review
- **WHEN** a normative, generated, compatibility-relevant, checker, test, or other bound governed
  object changes after review
- **THEN** the review becomes stale and a new frozen candidate and review decision are required

#### Scenario: Review binds only part of the governed path set
- **WHEN** a review record omits any governed path required by the candidate scope
- **THEN** binding verification rejects the partial review

#### Scenario: Governance-record-only child follows review
- **WHEN** a post-review commit changes only a closed allowlisted governance record outside the
  reviewed content and leaves every reviewed object unchanged
- **THEN** the exact review binding remains valid without broadening its authorizations

### Requirement: Activation authority is separate from dedicated activation evidence

Bloodtrail contract activation SHALL use a dedicated post-merge activation record. The activating
authority SHALL be an exact signed project-owner governance decision bound to the frozen candidate
and explicitly granting activation for the named contract version and scope. The activation record
SHALL evidence that decision; it SHALL NOT authorize itself.

The activation-record commit SHALL be the dedicated direct child of the identity-preserving merge
commit, change only the closed activation-evidence allowlist, and bind the protected reference,
merge commit and tree, reviewed technical commit and tree, complete governed path-to-object set,
contract version, scope, signed decision, required-check enforcement, effective event, granted
authorizations, and withheld authorizations. A branch name, tag, version literal, merge, archive,
implementation, passing test, or activation record without the prior grant SHALL NOT activate the
contract.

#### Scenario: Activation record has no prior activating authority
- **WHEN** a structurally valid activation record names a candidate but no exact signed project-owner
  decision grants activation for that candidate, version, and scope
- **THEN** activation verification rejects self-authorization

#### Scenario: Activation record floats on branch and version
- **WHEN** an activation record binds only a protected branch name and version literal
- **THEN** activation verification rejects the record because exact reviewed content is unbound

#### Scenario: Dedicated post-merge activation is valid
- **WHEN** the signed decision grants activation for exact frozen content, the identity-preserving
  merge carries that content, and the direct-child activation record binds all required identities
- **THEN** the named scope and version become activated at that activation commit

### Requirement: Unresolved authority and lifecycle contradictions fail at explicit stages

Governance SHALL classify each contradiction as a merge, activation, and release effect. A new or
worsened source/current-capability conflict, conflicting applicable current capabilities, an
undelegated source-only semantic addition, generated divergence introduced by the candidate,
implementation selection of an unresolved normative side, missing compatibility classification for
a changed semantic dimension, stale or partial review binding, unauthorized activation, illegal
lifecycle transition, or authorization claim outside recorded scope SHALL block merge.

An exact pre-existing contradiction MAY remain merge-visible only when it is bound to the reviewed
baseline objects, the candidate does not change either side, and the current change is a scoped
governance or remediation step that cannot resolve it. Such debt SHALL still block activation and
release. No unbound, new, changed, or broadened contradiction receives that exception.

#### Scenario: Candidate introduces a contradiction
- **WHEN** a candidate creates or changes a conflict between applicable normative sources
- **THEN** merge, activation, and release are blocked

#### Scenario: Exact pre-existing contradiction is unchanged by bounded governance work
- **WHEN** a recorded contradiction binds exact baseline objects, the candidate changes neither
  side, and its scope cannot resolve that semantic conflict
- **THEN** merge may proceed while activation and release remain blocked and the debt remains visible

### Requirement: Historical governance bindings are immutable and folded states receive new pins

Existing applicability, overlap, debt, authorization, freeze, review, activation, and provenance
bindings SHALL remain immutable historical evidence. A fold SHALL NOT edit, delete, reinterpret, or
reuse an existing binding to describe a new canonical object graph. Every folded capability state
SHALL receive a new immutable pin set bound to the exact authored source, current capability objects,
ownership and selector inputs, recomputed applicability, recomputed overlap classifications,
recomputed debt, and lineage to the historical evidence it supersedes or rebinds.

Exactly one current pin set SHALL match a governed repository state. A missing, duplicate, floating,
self-referential, object-mismatched, or stale pin set SHALL block fold, review, activation, and
release. The exact-content review SHALL bind the pin-set object and every other governed fold object.

#### Scenario: Fold attempts to mutate a historical pin
- **WHEN** a fold edits or relabels an existing applicability, overlap, or debt binding so it names a
  newly materialized canonical object
- **THEN** governance rejects the fold and preserves the old binding as historical evidence

#### Scenario: Folded state has one new exact pin set
- **WHEN** a fold materializes new canonical capability objects and recomputes every required binding
- **THEN** governance accepts the new pin set only when it uniquely matches the complete exact object
  graph and preserves lineage to prior evidence

### Requirement: Operation authorization is discovered per change and cannot self-authorize

Governance SHALL discover operation-specific authorization records through a governed schema and
repository convention rather than a change-specific filename, identifier, or grant literal. Each
record SHALL bind its change, requested operation, exact base and proposal objects, governed scope,
paths, principal and role, grant, withheld authorities, introducing event, and predecessor,
amendment, revocation, or supersession relation.

Zero applicable valid current records SHALL mean unauthorized. Multiple consistent records MAY be
evaluated only through an explicit coherent-chain rule. Conflicting current records SHALL fail
closed. Revoked, superseded, withdrawn, archive-only, and archived-change records SHALL NOT authorize
current work. Authority verification SHALL use a protected-baseline authority registry; a candidate
SHALL NOT enroll or modify the principal or signing key used to authorize itself.

Merge, fold, activation, release, and archive authority SHALL remain independent. No grant for one
operation SHALL imply another.

#### Scenario: Change has no valid current fold authorization
- **WHEN** a verified change requests fold and discovery finds no applicable valid current `FOLD`
  authorization
- **THEN** the change remains unfolded and governance reports it unauthorized

#### Scenario: Authorization chains conflict
- **WHEN** two otherwise valid current records grant conflicting scope or authority for the same
  change and operation
- **THEN** governance blocks the operation rather than choosing a record by filename or order

#### Scenario: Candidate enrolls its own authorizer
- **WHEN** a candidate modifies the registry entry used to validate that candidate's authorization
- **THEN** governance rejects the circular trust transition

### Requirement: Verified revisions and folds use distinct exact transitions

A verified, active, not-yet-folded change MAY enter a bounded revision only through
`VERIFIED → APPLY_AUTHORIZED → IMPLEMENTED → VERIFIED` with fresh exact apply authorization. Entry
SHALL make the prior verification historical and SHALL NOT grant fold.

`VERIFIED → FOLDED` SHALL require a distinct independently verifiable fold authorization, exact
verified delta inputs, a deterministic canonical fold preview, strict OpenSpec validation, immutable
historical pins, a newly recomputed current pin set, exact lifecycle evidence, and a new technical
commit/tree with complete governed path-to-object bindings. Changed canonical capabilities,
lifecycle evidence, the new pin-set object, and exact delta inputs SHALL receive a fresh exact-content
review. A lifecycle field naming `FOLDED`, merge authority, or successful tests SHALL NOT prove fold.

#### Scenario: Merge authority is offered as fold authority
- **WHEN** a merged verified change has no distinct current exact fold authorization
- **THEN** governance keeps the change in `VERIFIED` and rejects fold

#### Scenario: Fold uses pins bound to verified objects
- **WHEN** lifecycle evidence claims `FOLDED` but selects a pin set bound to the pre-fold canonical
  objects
- **THEN** governance rejects the stale fold evidence

#### Scenario: Exact fold receives fresh review
- **WHEN** all authorized deltas are materialized, strict validation passes, and recomputed evidence
  binds the new object graph
- **THEN** the fold creates a new technical identity that requires a fresh exact-content review and
  grants no activation authority
