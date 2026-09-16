# Apply Authorization — CB-001 Revision 2 review-record ownership association correction

```text
APPLY_AUTHORIZATION=GRANTED
AUTHORIZATION_SCOPE=CB-001-R2-REVIEW-RECORD-OWNERSHIP-ASSOCIATION-CORRECTION
```

This record authorizes one bounded governed-scope correction. It is not CB-001 normative approval,
CB-001 re-review approval, Candidate B approval, merge authorization, activation approval, or release
approval. It does not authorize Revision 3, CB-002, or any dependent remediation.

## Authorized base

| Field | Value |
| --- | --- |
| Change | `define-normative-precedence-lifecycle` |
| Branch | `docs/cb-001-normative-precedence-r2-rebuild` |
| Authorized base head | `4d9c20e5e73ae9eb81aac2575542e5ada4d661b5` |
| Authorized base tree | `d1495f65465c95efb594e118c33856699480e528` |
| Base change subtree object | `9e8ab230cc0ede3d8c98c1764c579ca39af5ca6e` |
| Pull request base | `b8122751342b0a2591a69a728ea58a99ca37dd0f` (`main`) |
| Candidate A base | `b8122751342b0a2591a69a728ea58a99ca37dd0f` |
| Candidate A tree | `42a0eecff212ad642de8d515ce5fbeb6a6ed2b83` |
| Prior bounded authorization | `assessment-scope-apply-authorization.md`, blob `3c75ffb3649d664b3d0d743363f94ade5134c02f`, recorded in `ec5c3a880341f9fd55f11a74583fba53e90d2aa4` |

This authorization applies only while the working branch still descends from this exact base and the
authorized correction is applied without unrelated modifications.

## Status of the approval bound to this base

The exact project-owner review decision recorded for head `4d9c20e5e73ae9eb81aac2575542e5ada4d661b5`
and tree `d1495f65465c95efb594e118c33856699480e528` remains **historical evidence for that exact
content only**. It does not carry to the corrected technical head produced under this authorization.
A fresh exact-content owner review is required against the corrected head.

## The defect this correction addresses

Storing the exact project-owner review record at the path the normative-precedence policy names,
`openspec/governance/records/define-normative-precedence-lifecycle.json`, clears the merge-stage
diagnostic `review-binding-pending` and instead raises, in both the baseline and candidate arms of
the dual check:

```text
openspec-association-unrelated  openspec/governance/records/define-normative-precedence-lifecycle.json
no OpenSpec change in this range owns or describes this governed implementation path
```

The cause is inherited from the trusted baseline `b8122751342b0a2591a69a728ea58a99ca37dd0f`:
`openspec/governance/records/` is classified `governance_record_only`, and
`isGovernanceRecordOnly()` exists in `openspec/scripts/design-pattern-governance/perimeter.mjs`, but
that function has no call sites. Association selects its governed set through `governedPatterns()`
and `matchesSelection()`, which carry no most-specific-pattern rule, so the record path matches the
broad `openspec/governance/` governance-core pattern.

**This authorization does not repair that baseline behaviour.** The defect is recorded as Revision 3
debt and stays unimplemented.

## Authorized correction

Declare `openspec/governance/records/define-normative-precedence-lifecycle.json` within CB-001's
existing assessment ownership, so that the trusted governance mechanism can resolve ownership of the
review record this change's own design requires.

**The correction may:**

- add that one path to the authoritative assessment ownership declaration;
- modify the authoritative assessment source that owns that declaration;
- regenerate the derived assessment artifact through its normal owner.

**The correction may not:**

- change `openspec/scripts/check-normative-precedence.mjs`;
- change `openspec/scripts/design-pattern-governance/perimeter.mjs`;
- make `isGovernanceRecordOnly()` active;
- change `governedPatterns()` or `matchesSelection()`;
- change path-specificity semantics;
- change `openspec/governance/normative-source-precedence.json`;
- change the review-binding model;
- change normative-precedence policy semantics, the semantic-versus-representation delegation model,
  lifecycle semantics, or activation semantics;
- change compatibility classifications;
- alter contract source, generated contract artifacts, schemas, validators, SDK semantics, or
  generated SDK artifacts;
- implement Revision 3, begin CB-002, or authorize activation or release;
- produce any other semantic or policy change.

## Path constraint

This authorization confirms the governance ownership relationship for exactly one path:

```text
openspec/governance/records/define-normative-precedence-lifecycle.json
```

No unrelated governed path may be added. The correction changes exactly these two files:

```text
openspec/changes/define-normative-precedence-lifecycle/assessment.source.json
openspec/changes/define-normative-precedence-lifecycle/assessment.json
```

`assessment.json` is regenerated with
`node openspec/scripts/generate-assessment.mjs --change define-normative-precedence-lifecycle`.

## Expected result objects

Derived by rehearsal in a disposable clone at the authorized base, before this record was drafted.

| Path | Object at the authorized base | Required resulting blob |
| --- | --- | --- |
| `openspec/changes/define-normative-precedence-lifecycle/assessment.source.json` | `7daf8c6ff3255fa54c2672d79ea0d278105fddd5` | `1d68f779a8a78cff08b3735fff52016491d52e67` |
| `openspec/changes/define-normative-precedence-lifecycle/assessment.json` | `6977b88f5e39fd5ec6cab89179008910ba71f5ff` | `d375358a5a15c1ea078fbb0fe2d47bd18acac62e` |

The resulting diff is exactly two files, four insertions and two deletions. Apply stops if either
resulting object differs, or if any other path changes.

## Required post-authorization sequence

1. Verify this authorization: one parent equal to the authorized base head, only this record added,
   `git verify-commit` succeeds against the owner's published GitHub signing keys, the verified key
   fingerprint equals the one bound below, and the identity binding is filled in.
2. Apply only the two-file ownership correction described above.
3. Confirm both resulting blobs equal the required objects and that no unrelated path changed.
4. Re-run the trusted governance checker in every required phase.
5. Re-run the candidate checker and the dual checker.
6. Re-run the policy-model, repository-enforcement, and binding tests.
7. Re-run the contract-reuse suite and the full governance suite.
8. Re-run the complete mutation proof, requiring every expected mutant killed and every null control
   clean.
9. Push the corrected technical head to pull request #536. Do not merge.
10. Run exact-head CI and require nine of the ten required contexts green, with
    `design-pattern-governance` failing only on `review-binding-pending`.
11. Freeze the resulting exact technical head and tree.
12. Request a fresh exact-content owner review against that new head. Do not create the review record
    before the corrected head is frozen and its CI satisfies the condition in step 10.

## Fresh review semantics

At the subsequent exact owner review, the review record is expected to grant:

```text
merge-define-normative-precedence-lifecycle
```

That grant means the exact reviewed CB-001 content is authorized to progress through the merge
lifecycle gate once all required checks pass. It does not mean the merge executes automatically, it
does not waive CI, and it authorizes no other head, no activation, and no release.

The fresh review must explicitly withhold `activate-normative-precedence-policy`, release
authorization, Revision 3 implementation, and CB-002. After the signed review record is stored the
expected state is: candidate stage passes, merge stage passes, all ten required CI contexts pass, and
the activation and release stages still fail because activation authorization and evidence are
intentionally absent.

## Revision 3 debt

The inherited checker defect above is added to Revision 3 as unimplemented debt:

- the `governance_record_only` classification exists;
- `isGovernanceRecordOnly()` exists but is not consumed by association selection;
- flattened governed patterns lose the classifier's specificity semantics;
- future policy should decide and test whether record-only paths are excluded from active-change
  ownership requirements through a most-specific classification rule.

Repairing that behaviour is not part of this correction and needs its own authorization.

## Authority binding

| Field | Value |
| --- | --- |
| `AUTHORIZING_IDENTITY` | `nandohdc` |
| `AUTHORITY` | `PROJECT_OWNER` |
| `AUTHORIZED_BASE_HEAD` | `4d9c20e5e73ae9eb81aac2575542e5ada4d661b5` |
| `AUTHORIZED_BASE_TREE` | `d1495f65465c95efb594e118c33856699480e528` |
| `AUTHORIZATION_SCOPE` | `CB-001-R2-REVIEW-RECORD-OWNERSHIP-ASSOCIATION-CORRECTION` |
| Authority evidence | SSH signature on the dedicated commit that introduces this record, made with the signing key whose fingerprint is `SHA256:MSQGfkZ33HtMFLuekps6RSechU/Ki/jK6cRvt4mRUHA`, registered as a signing key on the `nandohdc` GitHub account |
| Effective authorization event | That signed commit, whose single parent is the authorized base head |

A self-asserted field such as `signed: true` is not proof of authority. This record carries authority
only through the verified signature on its introducing commit. The identity and fingerprint above are
transcribed from the previously verified authorization `ec5c3a8`; replace the fingerprint before
signing if a different registered signing key is used.

## Stop conditions

Apply stops, and the correction is unauthorized, if the base head or tree differs, if the introducing
commit's signature does not verify against the owner's published signing keys, if the verified key
fingerprint differs from the one bound above, if any path other than the two named files changes, if
either resulting object differs from its required blob, or if this record is modified after it is
first recorded. A passing candidate or trusted checker, an AI-authored analysis, or a pull request
cannot grant any withheld authority.
