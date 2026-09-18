## Context

See `proposal.md` for motivation. Candidate A already has exact-content review, trusted/candidate
design-governance checks, and a dedicated direct-child activation record, but it has no contract-
specific ownership map joining current capabilities to `contract.source.json`. The assurance-side
CB-001 policy model proved a partial-order concept but was repository-blind, conflated two
lifecycles, omitted active deltas, and could not be reviewed as repository content.

The change is governance-core and security-sensitive. It must be dependency-free, deterministic,
read-only, compatible with the existing trusted-baseline checker, and narrow enough to land before
any contract semantic remediation.

## Goals / Non-Goals

**Goals:**

- Make contract authority, semantic delegation, applicability, lifecycle, review, and activation
  rules machine-readable and repository-verifiable.
- Preserve exact Candidate A semantic defects as visible, activation-blocking debt rather than
  redefining or repairing them in this change.
- Provide a trusted transition path for a new checker without allowing it to approve itself.
- Give every downstream CB issue one deterministic answer for where semantic and derived changes
  belong.

**Non-Goals:**

- Decide client evidence, trust order, derivation, field, catalog, compatibility, or SDK semantics.
- Change the authored contract, generated contract tree, validator, or SDK projection.
- Rewrite historical review, activation, compatibility, or provenance records.
- Activate this policy, select Candidate B, or authorize production/publication.

## Decisions

### 1. Use a domain-specific authority graph, not a global document rank

The policy assigns roles per authority domain: current capabilities own activated semantic intent;
the authored JSON owns the concrete contract representation within explicit delegation; governance
owns process validity; compatibility policy classifies transitions; exact records bind identity and
authorization; generated and SDK surfaces are derived; implementations and tests are evidence.

A flat `contract.source.json always wins` rule was rejected because it would let an authored edit
bypass current capabilities. A flat `OpenSpec always wins` rule was rejected because abstract prose
cannot serve as the sole deterministic generation input. The graph requires both layers to agree.

### 2. Default every unclassified source dimension to semantic

The policy carries a closed semantic-dimension vocabulary and requirement-ownership entries. Each
entry names an existing capability requirement, a source JSON-pointer scope, and one of three
delegations:

- `NONE`: the source may only reproduce an exact capability-controlled value;
- `CONCRETE_PARAMETER`: the capability delegates concrete bounded values or structure to the source;
- `REPRESENTATION_DETAIL`: only semantics-preserving formatting or encoding may vary.

Any source scope without exactly one ownership relation, or any unclassified property introduced
under a governed source scope, is treated as semantic and rejected. The checker does not decide
semantic truth from prose; it proves ownership, delegation, explicit machine assertions where a
capability exposes one, and changed-scope classification. Later CB issues must update the owning
capability/delta and the source together.

### 3. Use structured assertion adapters only for mechanically extractable semantics

The checker supports named adapters, initially `source-value-present-in-requirement`, for exact
values that can be extracted without interpreting prose. An assertion names one source pointer and
one exact requirement heading; the checker reads the current requirement block and verifies that it
contains the source value as an exact code literal. Unknown adapters fail closed.

This detects Candidate A's current-version drift without making the policy file a second semantic
source. Exact pre-existing conflicts may be recorded only with Candidate A commit and both baseline
blob IDs. They remain visible and block activation/release; merge tolerance applies only while a
candidate changes neither side.

### 4. Discover applicability from repository paths and exact declarations

Current capabilities are directories under `openspec/specs/` with `spec.md`. Active candidate deltas
are capability deltas under non-archive directories in `openspec/changes/`; archived records are
under `openspec/changes/archive/`. The policy maps contract domains to exact current capability paths,
requirement headings, source pointer prefixes, and contract-version ranges. The checker rejects a
missing capability, missing or duplicate requirement heading, unresolved source pointer, uncovered
source section, and overlapping ownership without an explicit compatible-overlap declaration.

An active delta supplies candidate intent only when its change lifecycle evidence records
`APPLY_AUTHORIZED` or a later active state and binds its scope. This PR records apply authorization
separately from review/activation. Archive location always makes a delta historical.

### 5. Model two state machines connected by evidence, not one sequence

The change-record machine is:

`PROPOSED → VALIDATED → APPLY_AUTHORIZED → IMPLEMENTED → VERIFIED → FOLDED → ARCHIVED`,

with governed transitions to `REJECTED`, `WITHDRAWN`, or `SUPERSEDED` where declared.

The contract candidate/version machine is:

`AUTHORED_CANDIDATE → GENERATED_CANDIDATE → TECHNICALLY_VERIFIED_FROZEN → REVIEWED_DECIDED → MERGE_READY → MERGED → ACTIVATED → RELEASED → SUPERSEDED`,

with `ABANDONED` available only before activation. A change may be folded and archived while its
contract version remains activated. A contract version may aggregate multiple change records.

### 6. Freeze and review bind a complete content set

The policy defines a governed path set as a non-overlapping prefix partition of every path in the
candidate scope that is classified normative, generated, compatibility-relevant, checker/test, or
other governed semantic content. Freeze binds commit, root tree, version, scope, and every partition
path's Git object. Review binds that freeze plus reviewer identity/authority, granted and withheld
authorizations, and the decision event.

Only the existing closed governance-record-only paths may change after review without invalidation,
and none may contain or alter a reviewed object. Every other bound-object change creates a new
candidate identity. `substantive` and `material enough` are deliberately not used.

### 7. Activation uses the existing dedicated direct-child mechanism

Activation mechanism A is chosen. The activating authority is the signed project-owner governance
decision for the exact frozen candidate with `activation_authorized: true` and an explicit version/
scope grant. The activation record is evidence only. Its commit is the dedicated direct child of the
identity-preserving merge and binds the reviewed objects, required-check evidence, protected
reference, effective event, and granted/withheld authorization. It cannot authorize itself.

A combined review-and-activation record was rejected because it would either precede the mainline
merge it must bind or float over post-review content. Automatic activation on merge/tag/archive was
rejected because those events carry no activating authority.

### 8. Keep the candidate checker subordinate to the existing trusted baseline

`check-normative-precedence.mjs` is a candidate governance checker. The existing merge-base version
of `check-design-pattern-governance.mjs` remains the trusted baseline for this governance-core change
and evaluates the candidate policy, paths, assessment ordering, and anti-weakening requirements.
The candidate checker runs separately and becomes trusted only after exact review, identity-
preserving merge, and activation under the existing R14-R18 transition.

Policy-model tests retain the 26 original conflict cases. Repository enforcement tests use
disposable repositories and distinct diagnostics. Negative controls mutate policy or evidence and
must be caught by the independent test expectations, not by the mutated checker declaring itself
healthy.

### 9. Stage effects allow remediation without hiding baseline debt

New, changed, broadened, or unbound contradictions block merge. An exact Candidate A conflict may be
declared as baseline debt only by binding Candidate A commit and both conflicting blob IDs. If a
candidate changes neither object, the checker reports the debt but permits a governance/remediation
merge; activation and release still fail. This avoids freezing the repository in the broken state
while preventing an unrelated edit from laundering the defect.

### 10. Preserve old evidence and select one exact pin set per repository state

Revision 3 moves applicability, overlap, and debt bindings out of mutable inline policy arrays and
into immutable pin sets. Existing Revision 2 evidence is not rewritten. A legacy snapshot binds the
old arrays to policy blob `6f4bf3a955f377499af5487ff5945baacbecac47`; new folded states receive new pin-set objects.

The checker computes a deterministic state digest from the exact authored source, current capability
registry, capability blobs, ownership mapping, version selectors, and governed path selectors. It
requires exactly one current pin set for that digest. Missing, duplicate, floating, or stale pin sets
fail closed. The pin set does not self-reference; the exact-content review binds the pin-set object
alongside the remaining governed path-to-object set.

Mutating old pins in place was rejected because it would make historical review evidence describe
objects that did not exist when the review occurred. Reusing old pins based on matching capability
names was rejected because names do not prove byte identity.

### 11. Recompute applicability, overlap, and debt after canonical materialization

A fold preview first materializes the proposed current capability blobs in a disposable tree. The
checker then recomputes, rather than copies:

1. capability applicability for every governed source section;
2. every multi-owner overlap set and its exact-object classification; and
3. every semantic assertion, bounded inherited-debt entry, and affected scope.

Any owner-object change makes earlier overlap evidence stale. Persisting debt is rebound to the new
objects with explicit lineage; resolved debt is omitted from the new current pin set but remains in
history; new or broadened debt is a blocking conflict and cannot receive an inherited-debt exception.

The existing `schema.version=2.1.0` source/current-capability conflict is expected to persist. The
fold mechanism must re-establish that debt against the eventual folded event-capability blob and keep
its activation/release block. CB-018 owns the semantic correction. CB-019 owns the later exact JSON
Schema identity projection. Revision 3 is forbidden from changing, resolving, or weakening either
side of the conflict.

### 12. Discover operation authorization per change under a protected trust root

Authorization files are discovered through a governed directory/schema convention rather than one
CB-001 filename. Records bind the change, operation (`APPLY`, `FOLD`, `ACTIVATE`, `RELEASE`, or
`ARCHIVE`), exact base/proposal objects, scope, paths, principal and role, grant, withheld authority,
introducing event, and predecessor/supersession relation.

The checker builds one coherent current chain per requested operation:

- zero valid current records means unauthorized;
- multiple consistent records are evaluated only under the explicit chain policy;
- conflicting current records fail closed; and
- revoked, superseded, withdrawn, archive-only, or archived-change records grant no current power.

Existing Markdown authorizations remain byte-identical and are indexed by exact path, blob,
introducing commit, grant type, and historical status. The trusted owner identity and signing key
come from a protected-baseline authority registry. A candidate cannot add the signer that validates
its own authorization, and a candidate checker cannot make the registry trusted by accepting it.

### 13. Separate bounded revision, fold, and later activation operations

A verified, active, not-yet-folded change may enter the bounded revision cycle
`VERIFIED → APPLY_AUTHORIZED → IMPLEMENTED → VERIFIED` only under fresh exact apply authorization.
The earlier verification remains historical. This Revision 3 proposal prepares such a revision but
does not itself grant apply authority.

`VERIFIED → FOLDED` requires a separate current fold authorization, exact verified delta inputs, a
deterministic fold preview, strict OpenSpec validation, newly recomputed pins, immutable old pins,
exact lifecycle evidence, and a new technical identity. The changed canonical capability blobs,
lifecycle evidence, new pin set, and exact delta inputs are all review-bound. Any subsequent bound
change creates another identity and requires another review.

Merge, fold, activation, release, and archive authority remain pairwise distinct. Revision 3
implementation will establish the mechanism only. It will not fold the active deltas, create
activation evidence, grant activation, begin CB-002, or create Candidate B.

### 14. Resolve CR-F16 through one most-specific path classification

Association selection must consume the same most-specific classification used by the governed path
classifier. Flattening `governance_core` and `governed_implementation` patterns into one unordered
include set is forbidden because a narrower `governance_record_only` path otherwise loses its role.

A most-specifically classified `governance_record_only` path is excluded from active-change
implementation ownership only after its dedicated closed-schema, exact-binding, history, authority,
and hidden-implementation checks pass. This is not a blanket exemption for `openspec/governance/`,
and mixed commits still require association for every implementation or governance-core path. The
existing duplicate record-only helper must either consume the shared classification result or be
removed; a second independent definition is forbidden.

### 15. Make mutation assurance countable before interpreting kill rate

The Revision 3 mutation manifest contains exactly 22 planned mutants. Anchor preflight runs before
execution and requires exactly one live target for each enabled mutant. The gate succeeds only with:

```text
EXPECTED_MUTANTS=22
APPLIED_MUTANTS=22
KILLED_MUTANTS=22
NOT_APPLIED=0
SURVIVED=0
ANCHOR_PREFLIGHT=PASS
NULL_CONTROLS=CLEAN
RESTORATION=BYTE_IDENTICAL
```

Every mutant runs in isolation and must be killed by its declared control. A not-applied mutant fails
assurance before any kill percentage is calculated. Unmodified and apply/restore null controls must
stay clean and source hashes must restore byte-identically.

### 16. Bind this planning revision without making it operative

This planning revision is based on merge commit `49ab0c255a41cc99328ff2cd5d442ffbc80b1bb1`
and tree `d608182899cb981403201c746ac7a18ddbc1d8c9`. Its approved package set is
`071d5433d950c5c602e8706d86ce8fc8c2be2b39f3b78823131313b0e2922b43`; its manifest is
`117b6a59a1fa8ceab9ee84837548b340b238591ac52bf7bb3256e6af800766fd`.

The proposal commit/tree and exact change-subtree object will be frozen after strict validation. A
separate project-owner apply authorization must bind those objects before any implementation path is
edited. Planning freeze does not change trusted policy, checker behavior, lifecycle state, canonical
capabilities, the three active delta statuses, or any contract/SDK artifact.

## Risks / Trade-offs

- **[Ownership mappings can become another inventory to maintain]** → The checker verifies every
  current source section is covered exactly once and every mapping resolves to real repository
  objects and requirement headings.
- **[Prose conflict detection is inherently incomplete]** → The checker interprets only named,
  reviewable assertion adapters; all other semantic decisions require explicit changed-scope
  ownership and independent review rather than heuristic natural-language comparison.
- **[Baseline debt exceptions could become waivers]** → Each binds Candidate A and exact conflicting
  blobs, permits only unchanged-object merge progression, and always blocks activation/release.
- **[Two lifecycles add vocabulary]** → Each state has one subject and machine transition table; the
  separation removes the false dependency between change archive and contract supersession.
- **[Candidate checker cannot be fully validated by old code]** → Existing trusted governance still
  enforces R14 assessment/review/anti-weakening boundaries; independent repository tests and negative
  controls plus exact owner review supply the new-rule evidence until activation.
- **[Append-only pin and authorization evidence increases governed object count]** → Closed schemas,
  deterministic selection, explicit lineage, and exact review bindings prevent the records from
  becoming floating or mutable authority.
- **[Fold preview and recomputation can expose more debt than Revision 2 recorded]** → New or widened
  debt blocks instead of being inherited silently; Revision 3 never weakens a semantic conflict to
  make a fold pass.
- **[Most-specific record classification could hide implementation under a record path]** → The
  record-only exception applies only after dedicated schema, history, authority, and hidden-code
  checks, and mixed commits retain ordinary association requirements.
- **[A closed mutation count can become stale after refactoring]** → Anchor preflight must locate
  exactly one target for all 22 approved mutants; a missing or ambiguous target fails before runs.

## Migration Plan

1. Freeze this planning-only proposal commit/tree/change subtree against the reviewed package hashes.
2. Obtain a separately signed project-owner apply authorization granting only Revision 3
   implementation and explicitly withholding fold, activation, release, archive, CB-002, CB-018,
   CB-019, contract/SDK changes, and Candidate B creation.
3. Under that exact grant, add the policy schemas, immutable legacy snapshot, authorization index,
   authority registry, checker modules, CR-F16 correction, tests, 22-mutant assurance gate, and only
   the minimal CI/perimeter registration needed for them.
4. Preserve every merged Revision 2 object, keep all three active deltas unfolded, and update
   lifecycle evidence only through the authorized bounded revision cycle.
5. Run strict OpenSpec validation, trusted-baseline and candidate checks separately, repository and
   policy tests, all 22 negative controls, and the exact 22/22 mutation proof. Freeze the technical
   identity and obtain fresh exact-content review before merge.
6. After a later separate fold authorization, recompute the three-delta fold preview, applicability,
   overlaps, debt, pin set, and exact fold identity. Freeze and freshly review that content.
7. Keep the contract-version debt activation/release-blocking until CB-018 resolves it. Do not create
   activation evidence or attempt activation merely because the fold mechanism exists.

Rollback before Revision 3 activation is branch abandonment or a new governed revision; merged
Revision 2 evidence is never rewritten. After any future activation, rollback requires a new
governed candidate.
