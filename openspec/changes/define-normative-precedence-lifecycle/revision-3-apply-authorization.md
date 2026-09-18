# Apply Authorization — CB-001 Revision 3 mechanism implementation

```text
APPLY_AUTHORIZATION=GRANTED
AUTHORIZATION_SCOPE=CB-001-REVISION-3-IMPLEMENTATION
IMPLEMENT_NORMATIVE_PRECEDENCE_REVISION_3=AUTHORIZED
```

This record authorizes implementation of the exact reviewed CB-001 Revision 3 mechanism only. It
does not authorize folding an active delta, activation, release, CB-002, CB-018, CB-019, or
resolution of the existing `schema.version=2.1.0` semantic conflict.

## Authorized identities

```text
AUTHORIZED_BASE_HEAD=49ab0c255a41cc99328ff2cd5d442ffbc80b1bb1
AUTHORIZED_BASE_TREE=d608182899cb981403201c746ac7a18ddbc1d8c9

AUTHORIZED_PROPOSAL_COMMIT=5a4957255f2e4830ceb15b38764e6bdb9824cae9
AUTHORIZED_PROPOSAL_TREE=e0d41c104e779aa326180213d3e3f2ba361ca3ba
AUTHORIZED_CHANGE_SUBTREE=509ce431381d224b81f4ad1d90c31992963cf8f1

PACKAGE_SET_SHA256=071d5433d950c5c602e8706d86ce8fc8c2be2b39f3b78823131313b0e2922b43
MANIFEST_SHA256=117b6a59a1fa8ceab9ee84837548b340b238591ac52bf7bb3256e6af800766fd
```

This authorization remains valid only while every identity above is unchanged. Any modification to
the seven planning files bound by the proposal subtree requires a new proposal identity and review.

## Authorized mechanism

Revision 3 may implement only the mechanism described by the frozen proposal, including:

1. preserving historical pins as immutable evidence;
2. creating new pins for newly folded canonical objects;
3. deterministic post-fold applicability recomputation;
4. deterministic overlap recomputation;
5. deterministic debt recomputation and explicit rebinding;
6. a new exact technical identity after fold and fresh exact-content review;
7. deterministic per-change operation-authorization discovery;
8. fail-closed handling of zero, conflicting, revoked, superseded, withdrawn, archive-only, and
   archived-change authorization records;
9. explicit separation of merge, fold, activation, release, and archive authorities;
10. mechanically enforceable `VERIFIED` to `FOLDED` prerequisites;
11. CR-F16 resolution through most-specific path classification and dedicated
    `governance_record_only` validation;
12. fail-closed mutation assurance; and
13. preservation of historical evidence rather than in-place mutation of old bindings.

Every implementation path must map to an approved Revision 3 requirement and be classified as
normative, enforcement, derived, test-only, or evidence-only. Derived artifacts must be regenerated
through their owners. A required implementation path absent from the approved affected-path model
requires scope review before modification.

## Per-change authorization discovery

Authorization discovery must be repository-derived and deterministic:

```text
zero applicable valid records            => unauthorized
one applicable valid record              => evaluate normally
multiple compatible applicable records   => governed deterministic handling
conflicting applicable records           => fail closed
revoked record                            => inactive
superseded record                         => inactive unless policy explicitly preserves applicability
archive-only evidence                     => cannot authorize current work
```

No CB-001-specific authorization filename may remain semantically privileged except where the
proposal explicitly requires backward-compatible historical interpretation.

## CR-F16 path classification

The authorized semantics are:

```text
PATH_CLASSIFICATION=most-specific-applicable-classification
```

`governance_record_only` receives explicit dedicated validation. A broad parent pattern must not
silently override a more-specific record-only classification. Positive, negative, ambiguity, and
overlap tests must demonstrate the intended behavior. This is an intentional trusted-enforcement
semantics change, not cleanup.

## Fold and contract-version boundaries

Revision 3 establishes the fold mechanism but does not execute a fold. These operations remain
unauthorized:

```text
fold-change-governance
fold-security-audit-event-contract
fold-software-design-pattern-governance
```

All three deltas must remain active and unfolded throughout Revision 3 implementation and
verification. A later separately signed authorization is required to fold them.

Revision 3 must preserve the activation and release block caused by the unresolved
`schema.version=2.1.0` source/current-capability semantic conflict. Ownership remains:

```text
CB-018 = semantic/current-spec coherence
CB-019 = subsequent JSON Schema exact-identity projection
```

Revision 3 must not weaken this conflict or make activation possible merely because fold mechanics
exist.

## Mutation assurance

Acceptance requires the complete approved mutant set:

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

Any not-applied mutant, survivor, dirty control, or restoration mismatch fails assurance before a
kill rate may be interpreted.

## Required implementation evidence

Implementation must execute the 38 repository tests, 22 negative controls, and 22 planned mutants,
plus all applicable existing CB-001, OpenSpec, governance, binding, and contract-reuse suites. It
must also run strict OpenSpec validation, assessment regeneration and drift checks, the trusted
checker at every applicable phase, the candidate checker, both dual-check arms, exact diagnostic and
path-classification assertions, fold recomputation tests, authorization-discovery adversarial tests,
fold-identity tests, and review-invalidation tests.

Required adversarial properties include rejection of stale pins, stale overlap and debt bindings,
ambiguous applicability, conflicting or inactive authorizations, authority implication across
operations, broad-pattern override of a specific record-only classification, fold without new exact
identity, fold without fresh review, missing mutation anchors, and not-applied mutants reported as a
passing mutation gate.

## Fresh exact-content review

Implementation must freeze:

```text
REVISION_3_IMPLEMENTATION_HEAD=<exact SHA>
REVISION_3_IMPLEMENTATION_TREE=<exact tree>
REVISION_3_CHANGE_SUBTREE=<exact subtree>
```

and provide a complete governed object inventory. It is not trusted by this apply authorization.
After exact-head repository and CI evidence completes, a fresh exact-content project-owner review
and independently verifiable signed decision are required.

## Explicitly withheld

```text
FOLD_ACTIVE_DELTAS_AUTHORIZED=NO
ACTIVATE_NORMATIVE_PRECEDENCE_POLICY=NO
RELEASE_NORMATIVE_PRECEDENCE_POLICY=NO
BEGIN_CB_002=NO
IMPLEMENT_CB_018=NO
IMPLEMENT_CB_019=NO
```

Also unauthorized are contract/source/schema/SDK changes for CB-018 or CB-019, activation evidence,
moving an active delta to `FOLDED`, weakening activation or release blockers, creating Candidate B,
admin bypass, or merging an implementation PR with a failing required check.

## Authority binding

| Field | Value |
| --- | --- |
| `AUTHORIZING_IDENTITY` | `nandohdc` |
| `AUTHORITY` | `PROJECT_OWNER` |
| `AUTHORIZATION_SCOPE` | `CB-001-REVISION-3-IMPLEMENTATION` |
| `AUTHORIZED_PROPOSAL_COMMIT` | `5a4957255f2e4830ceb15b38764e6bdb9824cae9` |
| `AUTHORIZED_PROPOSAL_TREE` | `e0d41c104e779aa326180213d3e3f2ba361ca3ba` |
| `AUTHORIZED_CHANGE_SUBTREE` | `509ce431381d224b81f4ad1d90c31992963cf8f1` |
| Authority evidence | SSH signature on the dedicated commit that first introduces this record, made with owner signing key fingerprint `SHA256:MSQGfkZ33HtMFLuekps6RSechU/Ki/jK6cRvt4mRUHA` |
| Effective authorization event | That signed commit, whose single parent is the exact authorized proposal commit |

A field claiming authorization is not authority by itself. This authorization becomes effective only
when the introducing commit's signature independently verifies against the bound owner key.

## Stop conditions

Implementation must stop if any authorized identity differs; the package or manifest differs; this
record is not introduced by its own signed direct-child commit; the signature or owner fingerprint
cannot be independently verified; implementation needs an unplanned path; a planned mutant does not
apply or survives; restoration is not byte-identical; an active delta is folded; the contract-version
conflict is weakened or silently resolved; another authority is implied; or CB-002, CB-018, or CB-019
work appears.

```text
REVISION_3_APPLY_AUTHORIZATION=GRANTED
IMPLEMENT_NORMATIVE_PRECEDENCE_REVISION_3=AUTHORIZED
FOLD_AUTHORIZED=NO
ACTIVATION_AUTHORIZED=NO
RELEASE_AUTHORIZED=NO
CB_002_AUTHORIZED=NO
CB_018_AUTHORIZED=NO
CB_019_AUTHORIZED=NO
```
