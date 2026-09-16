# Apply Authorization — CB-001 Revision 2 design-pattern-policy ownership correction

```text
APPLY_AUTHORIZATION=GRANTED
AUTHORIZATION_SCOPE=CB-001-R2-DESIGN-PATTERN-POLICY-OWNERSHIP-CORRECTION
```

This record authorizes one bounded governed-scope correction. It is not CB-001 normative approval,
CB-001 re-review approval, Candidate B approval, activation approval, or release approval. It does
not authorize Revision 3, CB-002, any dependent remediation, or any further semantic, governance,
contract, generator, validator, SDK, compatibility, or provenance change.

## Authorized base

| Field | Value |
| --- | --- |
| Change | `define-normative-precedence-lifecycle` |
| Branch | `docs/cb-001-normative-precedence-r2-rebuild` |
| Authorized base head | `174d52bcd86b84fa45358bff9beb0f5316c22913` |
| Authorized base tree | `e369e00a5d12000516f176a9a319e05be64db45b` |
| Base change subtree object | `855c92e75b7e0660eff802c8d3fc4d27492f864c` |
| Candidate A base | `b8122751342b0a2591a69a728ea58a99ca37dd0f` |
| Candidate A tree | `42a0eecff212ad642de8d515ce5fbeb6a6ed2b83` |
| Amended authorization | `revision-2-apply-authorization.md`, blob `b77c3a0c1cfc58de0af3ef86e3cac6a9c4fc3ff9`, recorded in `6eecbedd774d2d91426877a12e7a2476e85c0e17` |

This authorization applies only while the working branch still descends from this exact base and the
authorized correction is applied without unrelated modifications.

## Authorized correction

Amend the CB-001 Revision 2 governed assessment ownership metadata so that
`openspec/governance/design-pattern-policy.json` is covered by the `owned_paths` ownership
declaration the trusted governance checker requires.

At the authorized base the trusted checker reports, in both the implementation and final phases:

```text
openspec-association-unrelated  openspec/governance/design-pattern-policy.json
no OpenSpec change in this range owns or describes this governed implementation path
```

The correction exists to let the trusted governance mechanism resolve ownership of that file without
broadening CB-001's semantic or implementation scope.

**The correction may:**

- add the ownership declaration that assigns `openspec/governance/design-pattern-policy.json` to its
  already-intended CB-001 governance scope;
- update the directly dependent assessment metadata needed to keep that declaration internally valid;
- regenerate evidence that is mechanically derived from that correction.

**The correction may not:**

- change normative-precedence policy semantics, the semantic-versus-encoding delegation model,
  lifecycle semantics, activation semantics, or review-binding semantics;
- change compatibility classifications;
- alter contract source, generated contract artifacts, schemas, validators, SDK semantics, or
  generated SDK artifacts;
- implement Revision 3;
- broaden the authorized path scope beyond what this ownership correction needs.

## Path constraint

The correction stays inside the path set already authorized for Revision 2. This authorization
confirms the governance ownership relationship for exactly one path:

```text
openspec/governance/design-pattern-policy.json
```

No unrelated governed path may be added. The correction changes exactly these two files:

```text
openspec/changes/define-normative-precedence-lifecycle/assessment.source.json
openspec/changes/define-normative-precedence-lifecycle/assessment.json
```

`assessment.json` is regenerated with
`node openspec/scripts/generate-assessment.mjs --change define-normative-precedence-lifecycle`.

## Expected result objects

| Path | Required resulting blob |
| --- | --- |
| `openspec/changes/define-normative-precedence-lifecycle/assessment.source.json` | `7daf8c6ff3255fa54c2672d79ea0d278105fddd5` |
| `openspec/changes/define-normative-precedence-lifecycle/assessment.json` | `6977b88f5e39fd5ec6cab89179008910ba71f5ff` |

Apply stops if either resulting object differs, or if any other path changes.

## Historical treatment of e802cd4

Commit `e802cd47e4df96785ce0eaf4b9d61bc093925e02` is **not** retroactively authorized. Its content may
be used as the intended correction only by recreating that correction after this authorization,
against the authorized base above. The earlier draft sequence remains historical evidence only.

## Required post-authorization sequence

1. Apply or replay only the authorized ownership correction.
2. Record the resulting exact commit and tree.
3. Verify the resulting diff contains no unauthorized change.
4. Run the trusted baseline checker in all required phases.
5. Run the candidate checker.
6. Run the dual check.
7. Run the complete precedence and governance test suites.
8. Re-run the full mutation proof.
9. Require every expected mutant killed and every null control clean.
10. Freeze the resulting exact PR-B01 head and tree.
11. Push that exact bounded branch.
12. Open PR-B01 as a draft pull request.
13. Run exact-head GitHub CI.
14. Do not merge.
15. Do not request CB-001 re-review until all required CI and evidence bind that exact head.

## Revision 3 exclusion

Drafting Revision 3 is permitted; applying it is not. Each of these needs a new apply authorization:
narrow merge-block and debt scope, per-change apply-authorization discovery, fold-time debt and
overlap re-pinning, any new external review or activation authority mechanism, and the remediation of
CR-F01, CR-F07, CR-F12, and CR-F14.

## Review status

This record grants implementation of the bounded correction only. It does not change:

```text
NORMATIVE_PRECEDENCE_DECISION_STATUS=NEEDS_REVIEW
```

and it does not authorize CB-002.

## Authority binding

| Field | Value |
| --- | --- |
| `AUTHORIZING_IDENTITY` | `nandohdc` |
| `AUTHORITY` | `PROJECT_OWNER` |
| `AUTHORIZED_BASE_HEAD` | `174d52bcd86b84fa45358bff9beb0f5316c22913` |
| `AUTHORIZED_BASE_TREE` | `e369e00a5d12000516f176a9a319e05be64db45b` |
| `AUTHORIZATION_SCOPE` | `CB-001-R2-DESIGN-PATTERN-POLICY-OWNERSHIP-CORRECTION` |
| Authority evidence | SSH signature on the dedicated commit that introduces this record, made with the signing key whose fingerprint is `SHA256:MSQGfkZ33HtMFLuekps6RSechU/Ki/jK6cRvt4mRUHA`, registered as a signing key on the `nandohdc` GitHub account |
| Effective authorization event | That signed commit, whose single parent is the authorized base head |

A self-asserted field such as `signed: true` is not proof of authority. This record carries authority
only through the verified signature on its introducing commit.

## Stop conditions

Apply stops, and the correction is unauthorized, if the base head or tree differs, if the introducing
commit's signature does not verify against the owner's published signing keys, if the identity
binding above is left unfilled, if any path other than the two named files changes, if either
resulting object differs from its required blob, or if this record is modified after it is first
recorded. A passing candidate or trusted checker, an AI-authored analysis, or a pull request cannot
grant any withheld authority.
