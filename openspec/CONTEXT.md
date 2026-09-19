# OpenSpec Governance Context

This context defines the evidence-bearing concepts used to govern repository changes. It distinguishes an author’s architectural reasoning from technical review, project-owner decisions, and implementation authorization.

## Normative Authority and Lifecycle

**Current canonical capability**:
An activated capability specification under `openspec/specs/` that owns current semantic intent for
its declared domain and applicability. Two applicable current capabilities that contradict one
another have no automatic winner.
_Avoid_: newest prose wins, implementation-defined meaning

**Active candidate delta**:
An in-scope delta under an active OpenSpec change with bounded apply authorization. It may define
proposed semantic intent for candidate construction and validation, but is not activated production
semantics and cannot override current semantics outside its declared scope.
_Avoid_: current capability, archived change record

**Archived change record**:
Immutable historical rationale and evidence for a completed, rejected, withdrawn, or superseded
change. Its semantics are current only to the extent they were folded into a current capability and
activated; the archive does not independently override current state.
_Avoid_: active candidate delta, current capability

**Authoritative authored contract**:
The complete concrete machine-readable representation and sole contract-generation input. It owns
only representational details or concrete parameters explicitly delegated by applicable semantic
authority; an unclassified dimension defaults to a semantic requirement and may not originate here.
_Avoid_: universal semantic authority, generated schema

**Semantic requirement**:
A behavioral, security, authorization, privacy, retention, delivery, compatibility,
interoperability, lifecycle, trust, validation, requiredness, or other conformance obligation.
Ambiguous source content is classified as semantic unless governance explicitly delegates it.
_Avoid_: serialization detail, source implementation choice

**Representation detail**:
An encoding, serialization, identifier spelling, machine-readable structure, or other concrete form
whose allowable freedom is explicitly delegated by the owning semantic capability. It cannot alter
accepted behavior or conformance obligations.
_Avoid_: requiredness, validation behavior, trust classification

**Binding derived conformance surface**:
A generated contract or SDK artifact consumers may rely on for conformance, while its semantic
authority remains upstream. Divergence makes the derived surface invalid; it does not create a new
source of truth.
_Avoid_: authored authority, advisory output

**Change-record lifecycle**:
The state machine governing proposal, validation, apply authorization, implementation,
verification, folding, and archival of one governed change record. It does not activate or
supersede a contract version by implication.
_Avoid_: contract-candidate lifecycle

**Contract-candidate lifecycle**:
The independent state machine governing authored and generated candidates, exact technical freeze,
review, merge readiness, merge, activation, release, and supersession of contract content.
_Avoid_: OpenSpec archive status, change-record lifecycle

**Activating authority**:
The independently authorized project-owner decision that grants activation for an exact reviewed
candidate identity and scope. It is not created by the activation record it authorizes.
_Avoid_: activation evidence, merge commit

**Activation evidence**:
The dedicated, content-addressed direct-child record that records an already authorized activation
decision for an exact merged candidate. Its existence cannot authorize itself.
_Avoid_: activating authority, release tag

**Trusted governance checker**:
An activated checker in the protected governance baseline. It enforces governance rules but cannot
define contract semantics.
_Avoid_: semantic authority, candidate governance checker

**Candidate governance checker**:
A proposed checker under an active change. It supplies evidence only until the trusted baseline,
independent adversarial tests, exact owner review, and activation establish it as trusted.
_Avoid_: self-validating checker, trusted baseline

## Contract Reuse Assessment

**Contract Reuse Assessment (CRA)**:
A distinct author-written record of whether a qualifying change reuses, extends, or introduces a contract. A CRA is evidence and never approval or implementation authorization.
_Avoid_: design-pattern assessment, pull-request rationale

**CRA execution frontier**:
The earliest incomplete ordered CRA phase eligible for work. It advances from schema to checker to CI only after the preceding phase has its required evidence.
_Avoid_: Kanban frontier, current task

**CRA evaluation**:
One determination of CRA applicability for a selected OpenSpec change and its material change range.
_Avoid_: repository-wide CRA scan

**CRA disposition**:
One of the closed contract-reuse outcomes: `reuse`, `extend`, or `new_contract`. An exemption is not a disposition.
_Avoid_: not applicable, exemption outcome

**CRA record mode**:
The explicit `mode` field with exactly two mutually exclusive values: `assessment`, carrying a disposition, or `exemption`, carrying exception evidence. A record does not combine the two forms.
_Avoid_: optional exemption fields, combined assessment and exemption

**CRA exemption**:
A change-bound exception established by separate signed governance evidence for an otherwise qualifying change. It is not a successful disposition or authorization.
_Avoid_: self-attested exemption, fourth disposition

**CRA exemption locator**:
A symbolic reference from an exemption-form CRA to the existing canonical governance-record source for the same change. It becomes valid only after that source contains the direct-child signed record that binds the technical candidate.
_Avoid_: caller-selected record path, pre-sign exemption proof

**CRA exemption binding**:
The exact relation in which signed record S names the same change, names technical candidate T, binds T's root and selected change-root tree, has `signed: true` with `reviewer.name` exactly `Fernando Homem da Costa (nandohdc)`, and grants the narrowly named CRA exemption.
_Avoid_: change-name-only match, implied owner approval

**Mechanism reference set**:
A collection of 1–8 safe dotted ASCII canonical contract paths when an assessment disposition requires identified mechanisms.
_Avoid_: free-form mechanism names, contract list

**CRA compatibility classification**:
One of `patch`, `minor`, or `major`, recorded only for an `extend` assessment. It classifies the proposed contract extension rather than an unsupported-version condition.
_Avoid_: unsupported, reuse compatibility

**CRA reasoning evidence**:
Bounded authored explanation of rationale, trust boundaries, transformation ownership, alternatives, and assurance limitations. It supports a CRA but is not a controlled contract vocabulary or approval.
_Avoid_: copied contract registry, approval evidence

**CRA author evidence**:
A bounded author identity and repository-relative supporting references in an assessment-form CRA. It is an author assertion and never a signature or owner decision.
_Avoid_: approval record, reviewer evidence

**CRA structural-rule adapter**:
The CRA-local layer that dispatches the explicit record mode to a named closed record shape and applies declared cross-field structural rules after the shared generic interpreter validates field constraints. It performs no canonical-contract, Git, or governance-record I/O.
_Avoid_: second schema interpreter, CRA checker

**CRA schema compatibility**:
The version policy for the closed CRA record dialect. Every initial record uses `schema_version: "1.0"`; a minor version may add only optional evidence, while removing, weakening, or changing existing evidence requires a major version, explicit migration, and CRA governance review. Newer and older unsupported versions fail closed with `unknown-new-version` and `unsupported-old-version`, respectively.
_Avoid_: silent schema change, version fallback

**Structural acceptance**:
Conformance of a CRA record to its closed record shape without establishing that a contract mechanism reference resolves semantically.
_Avoid_: CRA-validated pass

**Approved skip**:
The distinguishable outcome that no CRA-triggering path exists in an evaluation. It is not a CRA-validated pass.
_Avoid_: passing CRA

## Verification Gates and Command Surface

**Runtime gates**:
The subset of checks that assert facts about a runtime rather than a repository state (behavioral tests, types, syntax, package exports, engine compatibility, scoped dependencies). Runtime gates execute per matrix leg and form the fast local development loop.
_Avoid_: repository-level gates, whole-chain checks

**Repository-level gates**:
The checks that assert facts about the repository rather than about a specific runtime (Git status, clean commits, package contents closure, cross-artifact coherence, contract immutability, publication paths, governance history, archive attestations, and fail-closed gate mutation verifications). Repository-level gates execute once per change rather than once per matrix leg.
_Avoid_: per-leg gates, runtime checks

**Product test loop**:
The fast, matrix-safe verification loop (~34s across all five declared workspaces) executed during active development (`npm run test:matrix` in sdk-core, `validate` in sdk-node, the collector and contracts, and `lint` + `test` in research).
_Avoid_: full governance-gate chain, slow validate

**Governance-gate chain**:
The complete validation chain (~291s across workspaces) that enforces fail-closed gate mutation testing (`test:verification`, ~254s dominant cost) and full contract/SDK validation, required before pushing to mainline or opening PRs.
_Avoid_: fast test loop, product loop

## Sequential Authorization Lifecycle

**Sequential authorization**:
An evidence-bearing lifecycle mechanism where a signed successor authorization supersedes an earlier authorization for the same operation without mutating historical bytes or cryptographic signatures.
_Avoid_: mutable authorization file, external mutable index, in-place status edit

**Successor authorization record**:
A dedicated, cryptographic-signature-bearing authorization record that explicitly binds an exact predecessor via Git blob SHA-256 and introducing commit SHA-1, superseding it within its own commit interval.
_Avoid_: replacement record, unsigned amendment

**Predecessor binding**:
The immutable relation in which a successor declares `predecessor_id`, `predecessor_path`, `predecessor_object` (Git blob SHA-256), and `predecessor_introducing_commit` (SHA-1). Any drift in these fields fails closed.
_Avoid_: loose identifier match, unverified parent

**Effective authority leaf**:
The unique topological leaf (out-degree zero) of the authorization directed acyclic graph (DAG) for a given `(change_id, operation)`. Only this leaf grants effective execution authority.
_Avoid_: multiple active authorizations, historical authority accumulation

**Discrete commit interval**:
The half-open commit range $(C_{\text{intro}}, P_{\text{successor}}]$ or $(C_{\text{intro}}, \text{HEAD}]$ within which a specific authorization's scope is strictly evaluated. A successor cannot retroactively authorize commits in a prior interval.
_Avoid_: open-ended scope, retroactive authorization

**Path-perimeter attribution immunity**:
The governance rule under which commits modifying strictly debt-resolution paths (`RESOLVE_DEBT`) are exempt from implementation scope checking under an `IMPLEMENT` or `APPLY` authorization.
_Avoid_: unowned implementation bypass, universal immunity

**Issuance-time status**:
The static JSON property `status: "CURRENT"` recorded at authorization creation time as the author's issuance assertion. Effective runtime status is derived dynamically from graph traversal, not read from this field.
_Avoid_: dynamic status mutation, authoritative static status
