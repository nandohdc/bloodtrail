## Purpose

Defines how OpenSpec changes in this repository are verified, attested, and archived, and how that
governance weight scales with the authorization state of the workspace a change affects, so that
verification effort is spent on executable checks rather than on prose restating them.

## ADDED Requirements

### Requirement: Governance weight is proportionate to authorization state

Governance weight SHALL scale with what a change can actually affect. While every workspace a
change touches is unpublished, undeployed, and processing no real-user data, the change SHALL
require only a single signed governance record, the repository's executable gates, and archive
validation. Full attestation — including independent technical assurance by a party other than the
project owner — SHALL be required before any publication or deployment authorization is granted,
and SHALL NOT be required merely to land or archive a change.

The unpublished and undeployed condition SHALL be determined mechanically by the repository's own
gates, not by assertion in a governance document. A change SHALL NOT claim lightweight governance
on the basis of a condition that no gate enforces.

#### Scenario: Change touches only unpublished workspaces
- **WHEN** a change affects only workspaces that gates confirm are private, unpublished, and
  carrying no deployment path
- **THEN** the change requires one signed governance record, passing gates, and archive validation,
  and no separate review, decision, restriction-restatement, or revalidation task group is required

#### Scenario: Change seeks publication or deployment authorization
- **WHEN** a change requests authorization to publish a package or deploy to production
- **THEN** independent technical assurance by a party other than the project owner is required
  before that authorization may be granted, and the lightweight path does not apply

#### Scenario: Authorization state is asserted but not enforced
- **WHEN** a governance record claims a workspace is unpublished but no gate enforces that claim
- **THEN** the claim is not accepted as a basis for lightweight governance until a gate enforces it

### Requirement: Repository-state claims are gate-enforced rather than narrated

A governance record SHALL NOT restate in prose any claim about repository state that an executable
gate already enforces. It SHALL cite the enforcing gate instead. Where a change depends on a
repository-state claim that no gate enforces, the change SHALL add a gate rather than assert the
claim in prose.

Confirmations that scope exclusions remain in force SHALL be discharged by citing the gates that
enforce them, and SHALL NOT require a separate governance task.

#### Scenario: Exclusion confirmation is required
- **WHEN** a change must confirm that production deployment, package publication, framework
  integration, or delivery infrastructure remains unauthorized
- **THEN** the confirmation cites the gates that enforce each exclusion, and no prose restatement
  of the exclusions is required

#### Scenario: Claim has no enforcing gate
- **WHEN** a change relies on a repository-state claim that no executable gate checks
- **THEN** the change adds a gate for that claim rather than recording it as prose attestation

### Requirement: Merge and history integrity are gate-enforced

An executable gate SHALL verify merge and history integrity rather than leaving it to prose
review. The gate SHALL verify that a commit recorded as a merge commit has the expected parent
count, that every commit a governance record binds remains an ancestor of the current branch head,
and that no recorded governed commit has become unreachable. A failure SHALL block, and the
diagnostic SHALL name the specific property that failed.

#### Scenario: Recorded merge commit was squashed
- **WHEN** a governance record describes a commit as a merge commit but that commit has a single
  parent
- **THEN** the gate fails and reports the actual parent count

#### Scenario: Bound commit is not reachable
- **WHEN** a governance record binds a commit that is not an ancestor of the current branch head
- **THEN** the gate fails and reports that the bound commit is unreachable

#### Scenario: Compliant merge and intact history
- **WHEN** every recorded merge commit has its expected parents and every bound commit remains an
  ancestor of the branch head
- **THEN** the gate passes and reports the verified commits

### Requirement: Review and authorization are one signed record bound to a content object

Technical review and the project-owner decision SHALL be recorded as a single signed governance
record rather than as separate governed task groups. The record SHALL identify the reviewer, the
reviewed content, the review's assurance limitations, the authorizations granted, and the
authorizations withheld.

The record SHALL bind to a **content object** — a tree or subtree identifier — and MAY additionally
name a commit. It SHALL NOT rely on a commit hash alone, because a commit cannot record its own
identifier and a commit may later become unreachable through squash merging.

AI-produced analysis MAY inform the record but SHALL NOT constitute review, approval, or
assurance, and approval SHALL NOT be inferred from passing tests, checked tasks, issue state,
pull-request state, or merged state.

#### Scenario: Record binds a content object
- **WHEN** a signed governance record names the reviewed subtree identifier alongside the reviewer,
  limitations, and withheld authorizations
- **THEN** the record remains valid even if the commit that carried it is later squash-merged or
  becomes unreachable

#### Scenario: Record binds only an unreachable commit
- **WHEN** a governance record binds only a commit hash and that commit is not an ancestor of the
  branch head
- **THEN** the binding is rejected and renewed binding to a content object is required

#### Scenario: AI analysis is offered as review
- **WHEN** AI-produced analysis, passing gates, or merged state is offered in place of a signed
  record
- **THEN** none of them satisfies the requirement and the signed record is still required

### Requirement: Superseded governance records supersede in version control

A governance record SHALL NOT retain superseded revisions of itself inside the document. When a
record is superseded, the superseding revision SHALL replace the prior content, and the prior
revision SHALL remain available through version control history.

A record MAY retain a short, dated correction note where a prior statement was factually wrong and
a reader would otherwise propagate the error.

#### Scenario: Governance record is superseded
- **WHEN** a governance record is revised and the prior revision is no longer operative
- **THEN** the superseding revision replaces the prior content and version control retains the
  prior revision

#### Scenario: Prior revision is needed
- **WHEN** a reader needs a superseded governance revision
- **THEN** it is retrieved from version control history rather than from within the current
  document

#### Scenario: Prior statement was factually wrong
- **WHEN** a superseded statement asserted something untrue that a reader could otherwise carry
  forward
- **THEN** the record may retain a short dated correction note identifying the error
