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

## Migration Plan

1. Land the OpenSpec proposal/assessment commit from Candidate A.
2. Record bounded apply authorization for governance implementation only.
3. Add policy, schema, checker, tests, glossary terms, and minimal CI invocation.
4. Freeze the exact technical commit and request project-owner review; do not mark it approved.
5. After approval, follow the existing identity-preserving signed-record and merge sequence, fold
   every affected delta into the current capabilities, freeze and review the exact folded content,
   and only then create the separately authorized direct-child activation record and archive the
   byte-identical change record.
6. Keep all Candidate A semantic debts activation/release-blocking until their dependent CB changes
   remove them and a later exact Candidate B is intentionally frozen.

Rollback before activation is branch abandonment. After activation, rollback requires a new governed
candidate; history and existing activation evidence are not rewritten.
