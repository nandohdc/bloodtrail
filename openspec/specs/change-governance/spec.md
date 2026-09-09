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

### Requirement: Routine governance-core documentation edits are decoupled and batched

Routine documentation updates to governance_core paths (including `CLAUDE.md`, `AGENTS.md`, `.hermes.md`, and `CONTRIBUTING.md`) SHALL NOT ride along with unrelated bounded implementation, verification, or bugfix changes. A bounded change that does not intend to alter governance rules, policy, or architecture SHALL NOT modify `governance_core` files merely to record incidental notes, instructions, or progress. Such documentation updates SHALL be deferred and batched into periodic documentation-only governance changes, preserving the abbreviated assessment eligibility of bounded changes.

#### Scenario: Bounded change needs documentation note
- **WHEN** a bounded change satisfies the criteria for an abbreviated assessment and an incidental documentation note is identified for a `governance_core` file
- **THEN** the documentation edit is deferred to a separate batched documentation change rather than touching the `governance_core` path, allowing the bounded change to proceed without triggering `governance_core_path`

#### Scenario: Dedicated batched documentation change lands
- **WHEN** deferred routine documentation notes are consolidated into a dedicated documentation update touching `governance_core` paths
- **THEN** the batched change completes a full assessment as a planned governance update, without bundling unrelated implementation changes

#### Scenario: Governance core path is the substance of the change
- **WHEN** a change modifies governance policies, checker scripts, or core repository workflows intentionally
- **THEN** the full assessment trigger `governance_core_path` is enforced and full assessment requirements are satisfied

### Requirement: The sanctioned merge path is versioned and its decisions are executable

The path by which a pull request is merged into the protected branch SHALL be versioned in this
repository under a classified path, and its merge decision SHALL be expressed as functions over
supplied evidence that reach no network and spawn no process. Collection of that evidence and
judgment of it SHALL be separable, so that judgment can be exercised against fixed inputs.

Every arm of the merge decision SHALL be exercised by a test that runs behind a required check, and
each arm SHALL be proven both to refuse a defective input and to allow the corresponding healthy
input. A merge decision that no check exercises SHALL NOT be treated as gated.

Test discovery for repository scripts SHALL enumerate the tests present rather than name a subset:
a hand-maintained list of test files fails by omission, and an omitted test is indistinguishable
from a passing one.

#### Scenario: Merge decision is exercised by a required check
- **WHEN** the required governance check runs
- **THEN** every test file beside a repository script is executed, including the merge gate's arms

#### Scenario: Gate arm has a null control
- **WHEN** a merge gate arm is asserted to refuse a defective input
- **THEN** the corresponding healthy input is asserted to be allowed by the same arm

#### Scenario: Test file added beside a repository script is discovered
- **WHEN** a test file is added beside a repository script without any check being edited
- **THEN** the required governance check executes it

### Requirement: Required-context presence is judged against branch protection

The merge gate SHALL determine the set of contexts that must pass by reading the protected branch's
required status checks, and SHALL require every such context to be both present in the reported
checks and passing. A required context that never reported SHALL fail the gate and SHALL be named,
distinctly from a context that reported a failure.

The gate SHALL fail closed when the branch protection response cannot be read or reports no required
contexts, and SHALL fail closed when no check has reported at all. Absence of evidence SHALL NOT be
evidence that a merge is permitted.

#### Scenario: Required context never started
- **WHEN** every reported check is passing but a context the protected branch requires never reported
- **THEN** the gate refuses the merge and names the absent context

#### Scenario: Every required context reported and passing
- **WHEN** every context the protected branch requires has reported and is passing
- **THEN** the gate allows the merge

#### Scenario: Branch protection cannot be read
- **WHEN** the protected branch's required-context list cannot be read or is empty
- **THEN** the gate refuses the merge rather than proceeding on the reported checks alone

#### Scenario: Reported check is failing
- **WHEN** a context the protected branch requires has reported a non-passing result
- **THEN** the gate refuses the merge and reports it distinctly from a context that never reported

### Requirement: Every merged pull request preserves the commits a record may bind

Every pull request SHALL land as a merge commit. The merge method SHALL NOT be selected by
inspecting the pull request's contents, so that misclassifying a pull request cannot select a
method that orphans a commit.

An archive pull request SHALL additionally record that a merge commit keeps the pre-archive state
reachable for archive-movement re-derivation, without that classification determining the method.
A pull request reporting no changed paths SHALL fail the gate.

#### Scenario: Non-archive pull request
- **WHEN** a pull request changes no path under the archive root
- **THEN** the gate selects a merge commit and states that it keeps the commit reachable for any
  governance record that binds it

#### Scenario: Archive pull request
- **WHEN** a pull request relocates a change under the archive root
- **THEN** the gate selects a merge commit and states the movement re-derivation reason

#### Scenario: Pull request reports no changed paths
- **WHEN** a pull request reports no changed paths
- **THEN** the gate refuses the merge rather than selecting a method

### Requirement: Every declared workspace is exercised by the repository's own command surface

Each `make` target that claims to run the repository's workspaces SHALL invoke every declared
package, and that coverage SHALL be asserted by an executable gate rather than by the recipe's own
success message.

A workspace count reported to the operator SHALL NOT be a hand-maintained literal that can disagree
with the set actually run. Adding a package without adding it to a covering target SHALL fail a
check rather than passing quietly.

#### Scenario: A covering target skips a declared workspace
- **WHEN** a `make` target that claims repository-wide coverage does not invoke a declared package
- **THEN** the package-discovery gate fails and names the target and the uncovered package

#### Scenario: A covering target is absent
- **WHEN** a target the gate expects to provide coverage is not declared in the Makefile at all
- **THEN** the gate fails rather than treating the absent target as vacuously covering

#### Scenario: A newly declared package is uncovered until the recipe runs it
- **WHEN** a package is added to the declared list and no covering target invokes it
- **THEN** the gate fails, so the omission cannot reach a green local loop

### Requirement: Agent-facing documentation states the tracker that carries execution state

Documentation that directs an agent to a tracker SHALL name the tracker in which execution state is
actually recorded, and SHALL state plainly which trackers are not authoritative for that state.

Where a tracker is retained without being authoritative, the documentation SHALL say what it may
still be used for and SHALL forbid inferring completion from it.

A statement of this kind that is withdrawn SHALL record the evidence that withdrew it and the
reversal path, so that restoring the previous arrangement is an edit rather than a rediscovery.

#### Scenario: A retained tracker is not authoritative
- **WHEN** documentation names a tracker that is retained but does not carry execution state
- **THEN** it states that completion may not be inferred from it, and names where completion is
  recorded instead

#### Scenario: A withdrawn statement carries its evidence
- **WHEN** an agent-facing tracker statement is withdrawn
- **THEN** the documentation records the measurements that withdrew it and the steps that would
  restore it

### Requirement: A documented triage vocabulary resolves against the tracker actually in use

Where documentation maps canonical triage roles onto a concrete mechanism, that mapping SHALL resolve
against the tracker that carries execution state, and SHALL NOT instruct an agent to avoid creating a
label that already exists and is in use.

Each canonical role SHALL remain distinguishable from every other role under the mapping, so that no
two roles collapse into one indistinguishable state.

#### Scenario: The mapping targets the tracker in use
- **WHEN** a skill applies a canonical triage role
- **THEN** the mapping resolves to a state in the tracker that carries execution state

#### Scenario: Roles stay distinguishable
- **WHEN** two canonical roles both express waiting on a human
- **THEN** the mapping keeps them distinguishable rather than collapsing them into one state
