# change-governance Specification

## Purpose
Defines how OpenSpec changes in this repository are verified, attested, and archived, and how that
governance weight scales with the authorization state of the workspace a change affects, so that
verification effort is spent on executable checks rather than on prose restating them.
## Requirements
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

### Requirement: Publication capability is excluded across tracked repository content

The gate that establishes the unpublished condition SHALL scan tracked repository content, not
workflow files alone. It SHALL reject a package publication command, package-registry publication
configuration, or publication credential wherever it appears in a tracked package manifest's script
bodies, in any non-documentation file under the repository automation directory, and in any local
path a workflow references as an action or a script. A tracked package manifest SHALL declare itself
private; a tracked manifest that does not is a publishable workspace and SHALL be rejected.

A local reference SHALL be resolved as the workflow runner resolves it — a file, or a directory
carrying an action definition — and SHALL NOT be read as an instruction to scan every file beneath an
arbitrary path. Expanding the surface that way would draw documentation, lockfiles, and build output
into it and make the gate fail on prose describing the exclusion.

The gate SHALL NOT claim to analyse reachability through shell indirection. Its boundary SHALL be
the absence of publication capability anywhere in the scanned surface — a stronger and decidable
property than reachability from a workflow step — and that boundary SHALL be stated where the gate
is documented. Content a workflow references that the gate cannot read SHALL fail closed, because an
exclusion cannot be established over content that was not scanned.

Scanning SHALL NOT execute a publication command; it SHALL inspect repository content only.
Verification SHALL report the size of the scanned surface, and a scan that covered nothing SHALL
fail rather than pass vacuously. Documentation and dependency lockfiles that legitimately name a
registry or describe publication SHALL NOT be treated as publication paths.

#### Scenario: Publication command is held in a manifest script
- **WHEN** a tracked package manifest declares a script whose body is a package publication command
- **THEN** the gate fails and names the manifest and the script

#### Scenario: Workflow invokes a publishing script indirectly
- **WHEN** a workflow step runs a manifest script that publishes, rather than naming the publication
  command itself
- **THEN** the gate fails, because the capability exists in tracked content regardless of how it is
  invoked

#### Scenario: Tracked manifest is publishable
- **WHEN** a tracked package manifest does not declare itself private
- **THEN** the gate fails and names the manifest

#### Scenario: Local automation carries a publication command
- **WHEN** a local action or repository automation file carries a publication command, registry
  publication configuration, or publication credential
- **THEN** the gate fails and names the file and line

#### Scenario: Referenced automation cannot be read
- **WHEN** a workflow references a local action or script the gate cannot read
- **THEN** the gate fails closed rather than reporting an exclusion it did not establish

#### Scenario: Documentation and lockfiles name publication
- **WHEN** documentation describes package publication, or a dependency lockfile names a package
  registry, including documentation held under the automation directory such as a pull-request
  template
- **THEN** the gate passes, because neither is a publication path

#### Scenario: Local reference does not resolve to automation
- **WHEN** a workflow references a local path that is neither a file nor a directory carrying an
  action definition, such as the repository root
- **THEN** the gate fails closed on that reference, and does not scan the paths beneath it

#### Scenario: Nothing is scanned
- **WHEN** no workflow file and no tracked package manifest is scanned
- **THEN** the gate fails rather than passing vacuously

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

### Requirement: Declared archive movements are anchored in version-control history

Every declared archive-movement attestation SHALL be verified. Enforcement SHALL NOT be limited to
the attestation for a change the verification tooling happens to name, and an attestation that no
check reads SHALL be a failure rather than a record.

The comparison anchor SHALL be derived from version-control history — the commit reachable from the
branch head that introduced the archived path — and SHALL NOT be derived from any value the
attestation declares. Verification SHALL reject an archive whose content differs from that anchor,
and SHALL reject an attestation whose recorded inventory differs from that anchor. Rewriting an
archived file together with its recorded object SHALL therefore fail even after the attested source
revision has become unavailable, because the archive and the attestation are both compared against
evidence neither of them can restate.

Verification SHALL derive the anchor from history whatever the attestation declares. An attestation
MAY additionally declare its anchoring commit, and where it does, verification SHALL reject one that
is not an ancestor of the branch head, and one that is not the commit history shows introduced the
archive. Declaring it SHALL NOT be a precondition of the movement commit itself, because the commit
that introduces an archive cannot be named by the commit that creates it; enforcement therefore rests
on the derived anchor and never on the declaration.

Where an archived path is not yet present in history — the state while its movement commit is being
prepared — verification SHALL report the anchor as pending and SHALL still require the archive to
match the declared inventory exactly.

Declared archives, inventories, modes, and objects SHALL be coherent and unambiguous: a well-formed
archive path inside the archive root, exactly one attestation per archive, a non-empty inventory,
and well-formed file modes and object identifiers.

An existing attestation SHALL migrate by declaring its anchoring commit. No archived artifact SHALL
be rewritten to satisfy this requirement.

Verification SHALL report which anchor it used, and SHALL NOT represent a history-derived anchor as
resistant to rewriting the history it derives from. That residual is bounded by protection of the
mainline branch and by the recorded commit identifiers such a rewrite would invalidate.

#### Scenario: Attestation is declared but read by no check
- **WHEN** an attestation records an archive that verification does not compare
- **THEN** verification fails until every declared attestation is verified

#### Scenario: Archived file and its recorded object are rewritten together
- **WHEN** an archived file is altered, its recorded object is updated to match, and the attested
  source revision is unavailable
- **THEN** verification fails, because both differ from the history-derived anchor

#### Scenario: Recorded inventory drifts from history
- **WHEN** an attestation's recorded mode, object, or path set differs from the anchor while the
  archive itself is unchanged
- **THEN** verification fails and names the differing path

#### Scenario: Declared anchoring commit is wrong
- **WHEN** an attestation declares an anchoring commit that history does not show introduced the
  archive, or that is not an ancestor of the branch head
- **THEN** verification fails

#### Scenario: Anchoring commit is not declared
- **WHEN** an attestation records an archive that is in history but declares no anchoring commit
- **THEN** verification anchors it against the commit derived from history and reports that the
  anchor was derived rather than declared

#### Scenario: Archive is not yet committed
- **WHEN** an attestation records an archive that is present in the working tree but not yet in
  history
- **THEN** verification reports the anchor as pending and still requires the archive to match the
  declared inventory exactly

#### Scenario: Two attestations record one archive
- **WHEN** more than one attestation records the same archived path
- **THEN** verification fails as ambiguous rather than choosing one

#### Scenario: Historical attestation is migrated
- **WHEN** an attestation written before anchoring existed declares its anchoring commit
- **THEN** verification passes without any archived artifact being rewritten

### Requirement: Review and authorization are one signed record bound to a content object

Technical review and the project-owner decision SHALL be recorded as a single signed governance
record rather than as separate governed task groups. The record SHALL identify the reviewer, the
reviewed content, the review's assurance limitations, the authorizations granted, and the
authorizations withheld.

The record SHALL bind to a **content object** — a tree or subtree identifier — and MAY additionally
name a commit. It SHALL NOT rely on a commit hash alone, because a commit cannot record its own
identifier and a commit may later become unreachable through squash merging.

The binding SHALL be mechanically resolved rather than merely well formed. For every reviewed path
the record declares, verification SHALL resolve that path within the bound candidate content and
SHALL reject a declared object that is not the object the path resolves to. Verification SHALL
reject a path it cannot resolve within the bound candidate content, a path that is not a well-formed
repository-relative path, and an object whose type is not the declared kind. A binding that is only
syntactically valid SHALL NOT be accepted.

A reviewed path SHALL NOT contain the record that binds it. Signing a record stored inside the
reviewed path would change the reviewed content, which is the self-reference content-object binding
exists to remove.

Every reviewed object SHALL remain resolvable from the branch head's own history, so that the
binding survives the squash merge that orphans the commit which carried it. Where the bound
candidate content object is itself no longer present — the state a squash merge leaves behind —
verification SHALL report its absence and SHALL still enforce every declared path-to-object binding
against history.

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

#### Scenario: Declared object belongs to a different path
- **WHEN** a signed record declares one reviewed path but supplies the content object of an
  unrelated path
- **THEN** the binding is rejected, and the diagnostic names the path, the object the path resolves
  to, and the object that was declared

#### Scenario: Reviewed path is absent from the bound candidate content
- **WHEN** a signed record declares a reviewed path that does not resolve within the bound candidate
  content
- **THEN** the binding is rejected rather than accepted on the strength of a resolvable object alone

#### Scenario: Reviewed path is malformed
- **WHEN** a reviewed path is absolute, contains path traversal, is not repository-relative, or
  names a blob where a tree is required
- **THEN** the binding is rejected

#### Scenario: Reviewed path contains the record
- **WHEN** a reviewed path contains the governance record that binds it
- **THEN** the binding is rejected, because signing would alter the reviewed content

#### Scenario: Candidate content is orphaned by a squash merge
- **WHEN** the bound candidate content object is no longer present, but every reviewed object is
  still carried at its declared path by history reachable from the branch head
- **THEN** verification reports the candidate object's absence and the path-to-object bindings
  remain enforced

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
