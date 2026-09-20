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
  redefining or repairing them in Revisions 2 and 3.
- CB-018: materialize the already-operative `2.1.0` contract decisions into the canonical capability
  and retire the contract-version debt only through an authorized, substantiated, pinned transition.
- Provide a trusted transition path for a new checker without allowing it to approve itself.
- Give every downstream CB issue one deterministic answer for where semantic and derived changes
  belong.

**Non-Goals:**

- Decide client evidence, trust order, derivation, field, catalog, compatibility, or SDK semantics.
  CB-018 decides none of these; it materializes semantics already decided and archived under
  `2026-09-11-add-client-evidence-capability`.
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

The Revision 3 mutation manifest contains exactly 22 planned mutants; CB-018 raises the closed
manifest to 33 (decision 24). Anchor preflight runs before execution and requires exactly one live
target for each enabled mutant. The gate succeeds only with:

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

### 17. CB-018 is a bounded revision of this change

CB-018 must change objects bound by the merged Revision 3 exact-content review: `pin-sets.mjs`,
`mutation-assurance.test.mjs`, both Revision 3 mutation fixtures, and the precedence policy. Review
freshness treats any such change as `review-binding-post-review-change` at merge stage, and the
review record is change-scoped (`binding.change_id === policy.change_id`). A standalone change could
not clear that diagnostic, so CB-018 is a new bounded revision of `define-normative-precedence-lifecycle`
and follows the Revision 3 cycle: `VERIFIED` to `APPLY_AUTHORIZED` to `IMPLEMENTED` to `VERIFIED`.

Sharing the change identifier does not merge identities. Every CB-018 authorization, pin, evidence
record, and review carries these keys, and the Revision 3 review remains immutable historical
evidence:

```text
PROGRAM_ISSUE=CB-018
CHANGE_ID=define-normative-precedence-lifecycle
REVISION_PURPOSE=fold-operative-decisions-into-coherent-current-2.1-plus-specifications
```

Until a fresh exact-content record binds the CB-018 technical identity, merge-stage
`review-binding-post-review-change` diagnostics are expected and are neither suppressed, waived,
nor exempted.

### 18. Materialize OD-1 through OD-4 as exact canonical text

The canonical `openspec/specs/security-audit-event-contract/spec.md` (blob
`d33b916244279c348b9cda83f55b3b5d160590cf`) changes in exactly two places:

1. OD-1: one paragraph is inserted after the first paragraph of the requirement "Schema governance
   is explicit and compatibility-tested", separated by one blank line on each side, as a single
   line (SHA-256 of the line plus its newline:
   `9dae51f4e76e148227b5a72938d3b5a40051e985c126972be548e8f22be33b3a`):

   ```text
   The current canonical schema version SHALL be `2.1.0`. It was reached from `2.0.0` by the governed additive minor move that introduced the optional closed client-evidence reference, whose exact-version compatibility obligations are stated in the requirement "Client-evidence contract compatibility is exact and generated".
   ```

2. OD-2 to OD-4: after the final canonical requirement, one blank line followed by lines 3 through
   end of file of the archived delta
   `openspec/changes/archive/2026-09-11-add-client-evidence-capability/specs/security-audit-event-contract/spec.md`
   (blob `cbceb6ab7a521751aad2d971bef3c4326fec5881`), byte-for-byte. Those lines are the three
   requirements "Audit records carry an optional closed client-evidence reference", "Client-evidence
   provenance is fixed at client claim trust", and "Client-evidence contract compatibility is exact
   and generated", with all of their scenarios.

The result is the resolving canonical object `487a4f066afa74696411ee782b0008673fd6ca14`, with 27
requirements instead of 24. Re-evaluating `contract-version-is-current-capability-literal` with the
checker's own `extractRequirement` gives `conflict=true` for the current object and `conflict=false`
for the resolving object, with source value `2.1.0` unchanged. Any other canonical text is out of
scope. A materialization that does not produce exactly this blob requires scope review.

This is semantic remediation of a historical materialization defect, not a contract-version
transition. The contract-reuse assessment stays `disposition: reuse`, `contract:
security-audit@2.1.0`, with `compatibility_classification` absent, which the closed CRA schema
requires for `reuse`. No `extend`, `minor`, `major`, or `2.1.0` to `2.2.0` claim is made. No precedence
`compatibility-decision.json` is created, because `inspectCompatibilityDecision` runs only when the
authored source changes. If implementation ever changes `contract.source.json`, implementation
stops.

The existing requirement "Derived provenance version moves follow the exact-version compatibility
policy" keeps its `2.0.0` move narrative, consistent with how the capability already records the
`1.0.0`, `1.1.0`, and `2.0.0` moves. CB-018 does not rewrite it.

### 19. Retire debt only through an authorized, substantiated, pinned transition

The policy gains `governance_authorities.debt_resolution_grant` with value
`resolve-contract-version-semantic-drift`, and `authorization_discovery.operations` gains
`RESOLVE_DEBT`. The policy schema `openspec/governance/schemas/normative-source-precedence.schema.json`
closes `governance_authorities` with `additionalProperties: false`, so the grant is representable only
when that object gains the property `"debt_resolution_grant": {"type": "string", "minLength": 1}` and
lists it in its `required` set, beside the six existing grants. `additionalProperties: false` stays.
A policy carrying the grant is schema-valid; a policy missing it fails with the repository's
`policy-schema-required` diagnostic. `authorization_discovery.operations` already admits any
non-empty string, so `RESOLVE_DEBT` needs no policy-schema change. The change-authorization schema's
`operation` enum gains `RESOLVE_DEBT`. No existing grant, operation, principal, role, or key changes,
and the protected authority registry is not edited, so the candidate cannot enroll its own signer.

The pin-set schema gains one optional top-level property, so every existing pin stays valid
without edit:

```json
"retired_debts": {
  "type": "array",
  "items": {
    "type": "object", "additionalProperties": false,
    "required": ["id", "assertion_id", "resolution", "retired_from", "lineage",
                 "prior", "resolving", "authorization"],
    "properties": {
      "id": {"type": "string", "minLength": 1},
      "assertion_id": {"type": "string", "minLength": 1},
      "resolution": {"const": "RESOLVED"},
      "retired_from": {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]+:[a-z0-9][a-z0-9-]+$"},
      "lineage": {"type": "array", "minItems": 2, "uniqueItems": true,
                  "items": {"type": "string", "minLength": 1}},
      "prior": {"$ref": "#/$defs/debtObjects"},
      "resolving": {"$ref": "#/$defs/debtObjects"},
      "authorization": {
        "type": "object", "additionalProperties": false,
        "required": ["id", "path", "object", "operation", "grant"],
        "properties": {
          "id": {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]+$"},
          "path": {"type": "string", "minLength": 1},
          "object": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
          "operation": {"const": "RESOLVE_DEBT"},
          "grant": {"type": "string", "minLength": 1}
        }
      }
    }
  }
}
```

`$defs.debtObjects` is closed and requires `source_path`, `source_blob`, `capability_path`, and
`capability_blob`, each blob a full 40-character object ID. The grant string is not a schema
constant; the validator compares it with the policy.

A retirement is valid only when all five conditions hold:

1. `retired_from` is `<pin-id>:<debt-id>` for a pin other than the carrying pin that records a debt
   with that id, and `lineage` equals that debt's recorded lineage followed by `retired_from`.
2. `prior` equals the retired debt's recorded source and capability paths and blobs, and
   `resolving` equals the carrying pin's `repository_state.source` and the assertion capability's
   object.
3. Re-evaluating `assertion_id` against the `resolving` blobs, read by object ID rather than the
   working tree, yields no conflict, and the carrying pin lists no current debt with that id.
4. Discovery for `RESOLVE_DEBT` returns exactly one current, signature-verified, proposal-bound
   record whose `grant` equals `debt_resolution_grant`, whose `withheld` includes `IMPLEMENT`,
   `MERGE`, `FOLD`, `ACTIVATE`, `RELEASE`, and `ARCHIVE`, and whose id, path, and object equal the
   retirement's `authorization`.
5. The entry is carried by the pin selected for the exact repository-state digest.

The retirement is evidence of an authorization; it cannot authorize itself. A field claiming
retirement is never sufficient on its own.

The continuity guard changes from "a historical contract-version debt exists and the current pin has
no contract-version debt" to "a historical contract-version debt exists and the current pin has
neither a contract-version debt nor a `retired_debts` entry for it". When an entry exists, the
retirement diagnostics decide the outcome. The guard is not deleted, a missing debt is never read as
resolved, the merge allowlist is not widened, and activation and release effects are not weakened.

For CB-018 the expected entry is:

```json
{
  "id": "candidate-a-current-capability-version-drift",
  "assertion_id": "contract-version-is-current-capability-literal",
  "resolution": "RESOLVED",
  "retired_from": "current-pre-fold-revision-3:candidate-a-current-capability-version-drift",
  "lineage": [
    "revision-2-inline-bindings:candidate-a-current-capability-version-drift",
    "current-pre-fold-revision-3:candidate-a-current-capability-version-drift"
  ],
  "prior": {
    "source_path": "contracts/security-audit/source/contract.source.json",
    "source_blob": "981da9e399a18e43c16493df42b80ee43da4779a",
    "capability_path": "openspec/specs/security-audit-event-contract/spec.md",
    "capability_blob": "d33b916244279c348b9cda83f55b3b5d160590cf"
  },
  "resolving": {
    "source_path": "contracts/security-audit/source/contract.source.json",
    "source_blob": "981da9e399a18e43c16493df42b80ee43da4779a",
    "capability_path": "openspec/specs/security-audit-event-contract/spec.md",
    "capability_blob": "487a4f066afa74696411ee782b0008673fd6ca14"
  },
  "authorization": {
    "id": "<fixed by the signed RESOLVE_DEBT record>",
    "path": "openspec/changes/define-normative-precedence-lifecycle/authorizations/<id>.json",
    "object": "<fixed by the signed RESOLVE_DEBT record>",
    "operation": "RESOLVE_DEBT",
    "grant": "resolve-contract-version-semantic-drift"
  }
}
```

The four outcomes stay distinct, and disappearance never implies resolution:

| Outcome | Exact condition |
|---|---|
| `RESOLVED` | assertion conflict absent, exact resolving objects bound, lineage continuous, `resolve-contract-version-semantic-drift` authorized, and new pin records the retirement |
| `SUPERSEDED` | a debt with a different id replaces it and carries lineage to the retired debt; it still blocks activation and release |
| `REBOUND` | the conflict persists on moved objects; the same id is recomputed and re-pinned and still blocks |
| `REMAINS_BLOCKING` | any `RESOLVED` condition is absent; today's state |

Debt resolution does not activate the policy. Activation keeps its own authority and evidence after
the later fold and review.

### 20. One decision site per retirement diagnostic

Each diagnostic below is emitted from exactly one decision site, so each mutant weakens exactly one
property:

| Diagnostic | Fires when |
|---|---|
| `debt-retirement-unauthorized` | condition 4 fails, including a `FOLD`, `MERGE`, `ACTIVATE`, or `RELEASE` record offered for retirement |
| `debt-retirement-binding-mismatch` | condition 2 fails |
| `debt-retirement-unsubstantiated` | condition 3 fails, or the assertion, requirement heading, source pointer, or blob cannot be evaluated |
| `debt-retirement-self-authorized` | the bound authorization path is under `repository_evidence.pin_sets_root`, or its object equals any pin-set object |
| `baseline-conflict-not-inherited` | condition 1 fails; a new retirement site reusing the existing lineage code |
| `contract-version-boundary-violation` | the historical contract-version debt has neither a current debt nor a retirement entry; the existing re-anchored site |

The four `debt-retirement-*` codes are new. Retirement validation lives in a new module,
`openspec/scripts/normative-precedence/debt-retirement.mjs`, which reuses
`discoverAuthorizations`. Only the guard line changes in `pin-sets.mjs`, so seven of its eight
Revision 3 anchors are untouched.

### 21. T3 creates the new pin only after exact T2 authorization

The policy and canonical contract blobs both change, so the capability-state digest changes and the
Revision 3 pin no longer matches. T2 therefore cannot be the final green verification point. After
T2 freezes its exact resolving identity, implementation stops for a separately owner-signed
`RESOLVE_DEBT` authorization. Only the ensuing T3 adds
`openspec/governance/normative-precedence-pins/current-pre-fold-cb-018.json` with `status: CURRENT`,
`created_for` of this change at `lifecycle_state: VERIFIED` and `fold_executed: false`, zero current
debts, one `retired_debts` entry, and lineage `current-pre-fold-revision-3`.

Both existing pins stay byte-identical. The Revision 3 pin keeps its stored `status: CURRENT` value
because history is immutable; `chooseCurrentPinSet` resolves several `CURRENT` values by exact
digest. The policy's `current_cardinality` and `historical_records_immutable` fields are read by no
script. CB-018 records that and does not change it.

T3 recomputation expectations: applicability is unchanged; overlaps involving
`security-audit-event-contract` are rebound to `487a4f06…`, never copied;
`capability-overlap-classification-stale=0`; `CONTRADICTORY=0`; debts are empty; and current pin
cardinality is one. Any other result stops implementation.

### 22. The governed-candidate handover uses the existing cumulative model

The handover is defined in two places, and both must change together. The data record is
`packages/security-audit-sdk-core/verification-lifecycle.json#/contract/governedCandidate`. The trust
anchor is the hardcoded `GOVERNED_CONTRACT_CANDIDATE` in `check-changed-paths.mjs`, which the gate
compares against the data record so the data record cannot approve itself.

The existing gate is cumulative, as its comment at `check-changed-paths.mjs:45` states. `rangeBase`
stays `cdecd7f3f2804517d9aa25ee4322b6486fd7a5bb`. Only `change` and `technicalCommit` advance, and
`protectedPaths` must equal `git diff --no-renames --name-only rangeBase technicalCommit` over the
protected prefixes. Narrowing `rangeBase` to CB-018's parent would reopen the 83 other protected
paths the earlier candidate admitted. The declared set is therefore the cumulative inventory, 84
paths today with no protected change since `342711fc`. CB-018's own protected contribution is
exactly one path, `openspec/specs/security-audit-event-contract/spec.md`, which is already a member.
A superset or subset fails closed.

A second gate constrains the same path. `check-contract-immutability.mjs` diffs the canonical
capability against `contract-provenance.json#/proposalBaseline`, and `check-coherence.mjs` pins that
baseline. The two-step identity is:

```text
T1  materialization commit: canonical capability equals 487a4f06..., plus mechanism and tests
T2  handover commit binding T1:
      verification-lifecycle.json   governedCandidate.change            = define-normative-precedence-lifecycle
                                    governedCandidate.technicalCommit   = T1
                                    governedCandidate.rangeBase         = cdecd7f3... (unchanged)
                                    governedCandidate.protectedPaths    = cumulative inventory (84)
                                    normativeTechnicalTarget            = T1
      check-changed-paths.mjs       GOVERNED_CONTRACT_CANDIDATE.change / technicalCommit = as above
      contract-provenance.json      proposalBaseline = T1
      check-coherence.mjs           expected.proposalBaseline = T1
```

T1 need not be merge-ready on its own; the evaluated candidate includes T2. The contract target in
`contract-provenance.json`, `compatibility.json`, the ADRs, and the consumer documentation stays
`342711fc284a3c1a94e0e1197c9bda0775e7fec0`, because the contract artifacts did not change.
`generate-contract.mjs` reads that target only for its format, and no generated file embeds either
commit, so generated contract and SDK output stay byte-identical. The handover authorizes no other
protected write. The later canonical fold will write this capability again and needs its own advance.

T2 freezes exact `T1_COMMIT`, `T1_TREE`, `T2_COMMIT`, `T2_TREE`, resolving canonical capability
blob, resolving policy blob, and resolving source blob. It is an authorization-input identity, not
the final implementation-verification identity. Before debt resolution, precisely these three
non-review diagnostics are expected because the selected historical pin binds the old event-
capability object `d33b916244279c348b9cda83f55b3b5d160590cf` while T2 contains
`487a4f066afa74696411ee782b0008673fd6ca14`:

| Code | Path | Message |
|---|---|---|
| `capability-overlap-classification-stale` | `openspec/specs/security-audit-event-contract/spec.md` | `overlap-authority-trust does not bind the current capability object` |
| `capability-overlap-classification-stale` | `openspec/specs/security-audit-event-contract/spec.md` | `overlap-delivery does not bind the current capability object` |
| `capability-overlap-classification-stale` | `openspec/specs/security-audit-event-contract/spec.md` | `overlap-derivation does not bind the current capability object` |

This exact three-instance allowance exists only at the T2 intermediate stop. It is not a waiver,
does not apply by diagnostic class generally, and is forbidden at T3/final verification. Any other
non-review diagnostic stops progression. Separately understood review-binding diagnostics retain
their existing rules.

### 23. Exact affected-path model

| Class | Path | Reason |
|---|---|---|
| protected normative object | `openspec/specs/security-audit-event-contract/spec.md` | OD-1 to OD-4 (T1) |
| governed-candidate handover metadata | `packages/security-audit-sdk-core/verification-lifecycle.json` | data record (T2) |
| governed-candidate handover metadata | `packages/security-audit-sdk-core/scripts/check-changed-paths.mjs` | hardcoded trust anchor (T2) |
| governed-candidate handover metadata | `packages/security-audit-sdk-core/contract-provenance.json` | immutability baseline (T2) |
| governed-candidate handover metadata | `packages/security-audit-sdk-core/scripts/check-coherence.mjs` | pinned baseline (T2) |
| mechanism implementation | `openspec/governance/normative-source-precedence.json` | grant and operation |
| mechanism implementation | `openspec/governance/schemas/normative-source-precedence.schema.json` | required `debt_resolution_grant` in the closed `governance_authorities` object |
| mechanism implementation | `openspec/governance/schemas/change-authorization.schema.json` | `RESOLVE_DEBT` |
| mechanism implementation | `openspec/governance/schemas/normative-precedence-pin-set.schema.json` | `retired_debts` |
| mechanism implementation | `openspec/scripts/normative-precedence/debt-retirement.mjs` | new retirement validation |
| mechanism implementation | `openspec/scripts/normative-precedence/pin-sets.mjs` | guard and call site only |
| generated or derived evidence | `openspec/governance/normative-precedence-pins/current-pre-fold-cb-018.json` | recomputed pin |
| generated or derived evidence | `openspec/changes/define-normative-precedence-lifecycle/assessment.json` | generated from source |
| test-only | `openspec/tests/design-pattern-governance/mutation-assurance.test.mjs` | import line; five live-state tests (decision 24) |
| test-only | `openspec/tests/design-pattern-governance/normative-precedence-debt-retirement-controls.mjs` | 11 new controls |
| test-only | `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-mutants.json` | re-anchor 008, add 11 |
| test-only | `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-negative-controls.json` | add 11 |
| test-only | `packages/security-audit-sdk-core/tests/verification/governed-candidate-handover.test.mjs` | SDK Core protected-path control |
| change-owned evidence | `openspec/changes/define-normative-precedence-lifecycle/lifecycle-evidence.json` | revision transitions |
| change-owned evidence | `openspec/changes/define-normative-precedence-lifecycle/authorization-index.json` | `revision-3-apply` leaves `CURRENT` |
| owner-authored authorization | `openspec/changes/define-normative-precedence-lifecycle/authorizations/*.json` | signed IMPLEMENT and RESOLVE_DEBT records |
| owner-authored review | `openspec/governance/records/define-normative-precedence-lifecycle.json` | fresh exact-content record |

The table has 22 rows. The four rows under the change directory collapse into the change root
`openspec/changes/define-normative-precedence-lifecycle/`, so the implementation authorization's
`scope_paths` contain exactly 19 entries. The first CB-018 freeze omitted the policy-schema row that
decision 19 requires; the project owner ruled that a planning-scope defect and ordered this
re-freeze, and the corrected row is the only scope widening.

The T1/T2/A3/T3 sequence has been mechanically re-derived against the table. A3's authorization,
the authorization-index transition, and lifecycle evidence all remain within the existing change
root. T3 writes only the already-listed current pre-fold pin and consumes the already-listed policy,
schema, checker, and test paths. It adds zero scope paths, so the corrected implementation scope
remains exactly 19. Any implementation need for a twentieth path still requires scope review.

`verify-normative-precedence-mutations.mjs` is expected to be unchanged. No path is added because a
checker rejects it. A required path absent from this table, including
`contract-toolchain-exemption.test.mjs` if any of its assertions turn out to pin pre-handover values,
requires scope review before modification. Excluded without exception: `contract.source.json`, every
path under `contracts/security-audit/`, `src/generated/`, `version.txt`, `CHANGELOG.md`,
`.release-please-manifest.json`, and every canonical capability other than the one above.

### 24. Mutation assurance is 33/33 plus one, in two layers

Layer A is CI-enforced integrity. `mutation-assurance.test.mjs` runs in the required
`design-pattern-governance` job and asserts that every manifest anchor resolves exactly once.
Layer B is full execution by `verify-normative-precedence-mutations.mjs`. No npm script, Makefile
target, or workflow invokes it:

```text
FULL_MUTATION_EXECUTION_CI_ENFORCED=NO
```

Layer B is mandatory review evidence. It runs only after T3 from a clean committed worktree and must
report:

```text
EXPECTED=33  APPLIED=33  KILLED=33  NOT_APPLIED=0  SURVIVED=0
ANCHOR_PREFLIGHT=PASS  NULL_CONTROLS=CLEAN  RESTORATION=BYTE_IDENTICAL
```

It is never represented as something CI proved.

The manifest grows from 22 to 33: 22 Revision 3 mutants with none removed and one re-anchored, plus
11 CB-018 mutants. The active `software-design-pattern-governance` requirement "Mutation assurance fails
before kill-rate interpretation when coverage is incomplete" changes only its counts, from 22 to 33. `MUT-R3-008` moves to the rewritten guard line, keeps replacement `if (false)` and
control `R3-T022`, and still weakens the same property: a disappeared contract-version debt without
a retirement must be detected.

| Mutant | Target | Anchor, then replacement | Control | Code |
|---|---|---|---|---|
| `MUT-CB018-001` | `model.mjs` | `if (debtAllowedAtStage(debt, stage, baseCommit ? repositoryChanges : null)) {`, then `if (debt) {` | `NC-CB018-001` | `baseline-conflict-stage-block` |
| `MUT-CB018-002` | `fold-validation.mjs` | `if (withheld.includes("ACTIVATE") === false) {`, then `if (false) {` | `NC-CB018-002` | `fold-activation-separation-missing` |
| `MUT-CB018-003` | `debt-retirement.mjs` | authorization site, anchor fixed at implementation | `NC-CB018-003` | `debt-retirement-unauthorized` |
| `MUT-CB018-004` | `debt-retirement.mjs` | binding site, anchor fixed at implementation | `NC-CB018-004` | `debt-retirement-binding-mismatch` |
| `MUT-CB018-005` | `debt-retirement.mjs` | substantiation site, anchor fixed at implementation | `NC-CB018-005` | `debt-retirement-unsubstantiated` |
| `MUT-CB018-006` | `debt-retirement.mjs` | self-authorization site, anchor fixed at implementation | `NC-CB018-006` | `debt-retirement-self-authorized` |
| `MUT-CB018-007` | `debt-retirement.mjs` | lineage site, anchor fixed at implementation | `NC-CB018-007` | `baseline-conflict-not-inherited` |
| `MUT-CB018-008` | `fold-validation.mjs` | `else diagnostics.push(diagnostic("fold-preview-missing", previewPath`, then `else [].push(diagnostic("fold-preview-missing", previewPath` | `NC-CB018-008` | `fold-preview-missing` |
| `MUT-CB018-009` | `fold-validation.mjs` | `if (gitObject(repoRoot, entry.target_path) === entry.preview_object) return null;`, then `if (true) return null;` | `NC-CB018-009` | `fold-preview-mismatch` |
| `MUT-CB018-010` | `fold-validation.mjs` | `if (expected && bound[path] === expected) return null;`, then `if (true) return null;` | `NC-CB018-010` | `fold-identity-incomplete` |
| `MUT-CB018-011` | `fold-validation.mjs` | `.filter((path) => !reviewBinding?.governed_path_objects?.[path])`, then `.filter(() => false)` | `NC-CB018-011` | `review-binding-incomplete` |

The six existing-code anchors each occur exactly once at `e1cc9f7`. The five new-module anchors are
fixed in the manifest at implementation and must pass the same preflight. A stale pre-fold review is
rejected by `validateFoldReviewBinding`, which emits `review-binding-incomplete`. The fold-stage
`review-binding-pending` is an observation, so a mutant there would weaken no gate.

The CB-018 entries form a true bijection: `MUT-CB018-0nn` and `NC-CB018-0nn` share test pattern
`CB018-T0nn` and property. The Revision 3 entries are equal in count only. Seven of 22 index pairs
share a pattern; `MUT-R3-003`, `-009`, and `-011` have no control of their pattern, and `NC-R3-017`,
`-019`, `-020`, and `-021` have no mutant. That is recorded as a separate pre-existing defect and is
not changed here.

The harness runs only `mutation-assurance.test.mjs`, so the eleven controls live in the sibling
module `normative-precedence-debt-retirement-controls.mjs`, which the control file imports with one
added line. That keeps the new controls out of the hotspot file.

The control file runs against the live repository with base `49ab0c25`. Five Revision 3 tests
assert live state that CB-018 intentionally changes. Each is rewritten to keep its property; none is
removed and no assertion is dropped:

- `R3-T018` empties `debts` to provoke `debt-recomputation-mismatch`, but the CB-018 pin already has
  no debts. It injects a surplus debt instead and remains the kill control for `MUT-R3-004` and
  `MUT-R3-007`.
- `R3-T021` reads the live pin's first debt. It reads the Revision 3 pin's recorded debt instead,
  still proving a persisting contract-version debt is fold-visible and activation-blocking.
- `R3-T031` raises its manifest-size pin from 22 to 33.
- `R3-T037` expects `baseline-conflict-stage-block` from the live repository at activation stage.
  It moves to a disposable repository without the `2.1.0` literal, still proving an unresolved
  conflict blocks activation.
- `R3-T038` keeps its assertion that all three deltas remain active candidate deltas and permits
  exactly one canonical change: `security-audit-event-contract` must equal `487a4f06…`, and every
  other canonical capability must equal base.

The separate SDK Core control, `SDK_CORE_PROTECTED_PATH_CONTROLS=1`, lives in
`tests/verification/governed-candidate-handover.test.mjs` on a disposable clone. It proves that a
change to `openspec/specs/security-audit-event-contract/spec.md` outside the exact governed-candidate
binding fails `check-changed-paths.mjs`. It is not normative-precedence mutant or control 34.

### 25. T1, T2, A3, and T3 are distinct governed checkpoints

The owner signs every authorization and review below. The implementer never writes or signs one.

1. IMPLEMENT: a schema-JSON record under `authorizations/` in a dedicated signed commit, bound to the
   corrected frozen proposal commit, tree, and change subtree. `supersedes` is not read by any
   script, so `revision-3-apply` must separately leave `CURRENT` in `authorization-index.json`;
   otherwise discovery fails closed with `authorization-current-conflict`. That transition is
   lifecycle evidence, not a grant.
2. T1 implements the exact semantic/mechanism scope while leaving debt unretired and fold unexecuted.
3. T2 performs the governed-candidate handover, proves the exact 84-path binding, freezes the exact
   resolving technical identity, and admits only the three named stale-overlap diagnostics as an
   intermediate expectation.
4. A3 is a separate dedicated owner-signed `RESOLVE_DEBT` authorization derived from exact T2
   objects. Predicted hashes are forbidden. It withholds IMPLEMENT, MERGE, FOLD, ACTIVATE, RELEASE,
   and ARCHIVE.
5. T3 executes the authorized retirement, recomputes applicability/overlap/debt, and creates the new
   current pre-fold CB-018 pin. T3 is not fold and creates no activation evidence.
6. Final implementation verification, the SDK protected-path control, and the complete 33-mutant
   campaign run after T3. All stale-overlap diagnostics must be absent.
7. Fresh exact-content review binds the final T3 technical identity and replaces the Revision 3
   record for merge.

FOLD, ACTIVATE, RELEASE, and ARCHIVE are withheld throughout.

### 26. CB-019 boundary and exclusions

CB-018 establishes coherent normative and current-spec semantics; CB-019 performs the later exact
JSON Schema and projection identity. CB-019 may not establish semantics absent from the canonical
capability or authored source, and it starts only after CB-018 materialization, fold, and review.
OD-5 is excluded. PR #537 and its three release-metadata files are outside CB-018. Fold, activation,
release, CB-002, and CB-019 remain unauthorized.

### 27. Bind the corrected CB-018 planning revision without making it operative

This revision is based on `e1cc9f770160bb1f3d6c8e41b40260cab8fea3ad` with tree
`054c5170c1630d343ca7292b9c7c0eabe652b53e`, package set
`fc9acef3002dbe0a41b5092f0494c00d002a60a7700d680591c0de1d92576ce4`, and manifest
`5e866b74f4b19ffb740a084cc3a27a565ff41303676b60717b72bcf56f74862f`. The freeze changes only planning
artifacts in this change directory. A separately signed apply authorization must bind the frozen
proposal commit, tree, and change subtree before any implementation path is edited.

This is the third CB-018 planning freeze. It supersedes the Revision 2 freeze because that approved
sequence required a fully green T2 before the separately authorized debt/pin transition needed to
make T2's object graph current. Its owner-signed authorization commit
`8daa24265af2ce568b1483d927d2597f78e32e65` and authorization-index commit
`d35cc744b74f716ef5d395b6500ee25eac8b7b13` are abandoned before T1. They are preserved only as
external process history and grant no authority to implement this corrected sequence.

The frozen commit is expected to fail the required `design-pattern-governance` context for two
reasons, and neither is waived. `R3-T038` fails at every stage because the edited
`software-design-pattern-governance` delta no longer equals the object `revision-3-apply` authorized.
It clears only when the CB-018 IMPLEMENT authorization binds the new delta object. At merge stage,
`review-binding-post-review-change` fires for exactly the seven planning files. It clears only with
fresh exact-content review. Every other command in that job passes on the frozen commit.

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

- **[Debt retirement could become a waiver]** → Retirement requires exact lineage, exact prior and
  resolving objects, an independent re-evaluation that finds no conflict, and a separately signed
  `RESOLVE_DEBT` record; any missing condition keeps the debt blocking.
- **[The handover edits gate code]** → Only the hardcoded candidate constant and the pinned baseline
  change. The cumulative inventory must match exactly, and generated contract and SDK output must
  stay byte-identical.
- **[Shared change identifier could blur CB-018 with Revision 3]** → Every CB-018 record carries the
  program, change, and revision-purpose keys, and the Revision 3 review stays immutable history.
- **[Full mutation execution is not a CI gate]** → CI enforces anchor integrity only; the 33/33
  campaign is out-of-band review evidence from a clean committed worktree and is labelled as such.
- **[The T2 intermediate state intentionally has stale overlap evidence]** → The plan admits exactly
  three object-bound instances only at T2, stops for independent A3 authority, and requires T3 to
  eliminate all three before any final verification or mutation claim.

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

CB-018 revision:

8. Freeze the corrected CB-018 planning proposal commit, tree, and change subtree against the
   sequencing-correction package hashes, then stop for a separately signed apply authorization.
9. Under that grant, implement the retirement mechanism and materialize OD-1 to OD-4 at T1 while
   leaving debt unretired and fold unexecuted.
10. At T2 bind the governed-candidate handover and immutability baseline to T1, freeze exact T1/T2
    resolving identities, and verify that the only non-review diagnostics are the three explicitly
    named stale-overlap instances.
11. Stop and obtain a separately owner-signed `RESOLVE_DEBT` A3 authorization derived from the exact
    T2 objects; do not use planning-time hashes.
12. Under A3 only, perform T3 debt retirement, applicability/overlap/debt recomputation, and current
    pre-fold pin creation. Do not fold and do not create activation evidence.
13. After T3, run the 33 negative controls, CI anchor integrity, the out-of-band 33/33 campaign, the
    SDK Core protected-path control, and every required check. Require zero stale overlaps, then
    freeze the final T3 technical identity for fresh exact-content review.
14. Folding the three deltas, activation, and release each remain separate governed actions.

Rollback before Revision 3 activation is branch abandonment or a new governed revision; merged
Revision 2 evidence is never rewritten. After any future activation, rollback requires a new
governed candidate.
