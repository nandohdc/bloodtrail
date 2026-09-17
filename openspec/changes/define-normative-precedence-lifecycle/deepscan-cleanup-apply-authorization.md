# Apply Authorization — CB-001 Revision 2 DeepScan code-health cleanup

```text
APPLY_AUTHORIZATION=GRANTED
AUTHORIZATION_SCOPE=CB-001-R2-DEEPSCAN-CODE-HEALTH-CLEANUP
AUTHORIZED_VARIANT=B
```

This record authorizes one bounded, behaviour-preserving code-health cleanup. It is not CB-001
normative approval, CB-001 re-review approval, Candidate B approval, merge authorization, activation
approval, or release approval. It does not authorize Revision 3, CR-F16, CB-002, or any dependent
remediation.

## Authorized base

```text
AUTHORIZED_BASE_HEAD=81c18fbba742ec752a24063ecd837b2a7d82572a
AUTHORIZED_BASE_TREE=1bbd4dee6700d76866217abb734a9b2ad3ac4f2f
AUTHORIZED_PATH=openspec/scripts/normative-precedence/model.mjs
BASE_OBJECT=4a98005fb98fd9a5f8058ea97c9d409662e461b2
```

| Field | Value |
| --- | --- |
| Change | `define-normative-precedence-lifecycle` |
| Branch | `docs/cb-001-normative-precedence-r2-rebuild` |
| Base change subtree object | `eac43be749d969ce786d29ccb4c3d8841573ccc0` |
| Pull request base | `b8122751342b0a2591a69a728ea58a99ca37dd0f` (`main`) |
| Prior bounded authorization | `review-record-ownership-apply-authorization.md`, blob `b33d7113ddbc92fef5981dd6af742fffb62c573e`, recorded in `ae897b8` |

This authorization applies only while the working branch still descends from this exact base and the
authorized cleanup is applied without unrelated modifications.

## Authorized scope

Authorization is granted only for the bounded cleanup of the three DeepScan findings introduced by
the CB-001 decomposition work, including the directly consequent dead binding created by correcting
DS-1.

The authorized implementation changes are:

1. Change:

```javascript
validateCompatibilityTransition(decisions[0], policy)
```

to:

```javascript
validateCompatibilityTransition(decisions[0])
```

2. Remove the now-unused `policy` binding from the corresponding context destructuring in
   `inspectCompatibilityDecision`.

This removal is explicitly authorized because `policy` has no remaining semantic use after
correction of the stale second argument.

3. Remove the unused local function:

```javascript
pathCoveredBy
```

from `model.mjs`.

4. Remove the unused `sourcePath` binding from the context destructuring in
   `inspectSemanticAssertion`.

No other cleanup, refactoring, formatting sweep, diagnostic change, or adjacent dead-code removal is
authorized.

## Expected implementation result

The authorized implementation is Variant B.

```text
EXPECTED_RESULT_BLOB=8badd769e952aa9a4e6c55af27168ae8f8752d94
EXPECTED_RESULT_SHA256=1544205fdbed8bc39975f55ea0b3999d4c8991ade40fbbbdf455d6947f39287c
```

| Path | Object at the authorized base | Required resulting blob |
| --- | --- | --- |
| `openspec/scripts/normative-precedence/model.mjs` | `4a98005fb98fd9a5f8058ea97c9d409662e461b2` | `8badd769e952aa9a4e6c55af27168ae8f8752d94` |

Variant A is not authorized, because it is expected to leave a newly exposed unused `policy` binding
and therefore knowingly retain a DeepScan defect. Its rehearsed object,
`d7135be66577723d4351aa360590e2396b9f2a8f`, is recorded here only so that it cannot be mistaken for
the authorized result.

Apply stops if the resulting object differs, or if any other path changes.

## Behaviour-preservation basis

This authorization relies on the supplied evidence that:

- `validateCompatibilityTransition` currently declares one formal parameter;
- its second historical `policy` parameter was never read;
- the stale two-argument invocation is the only such call-site defect;
- the checker does not inspect `arguments`, `callee`, rest arguments, or function arity in a way
  affected by this edit;
- `pathCoveredBy` has zero consumers, is not exported, and has no dynamic execution path;
- an equivalent live path predicate already exists elsewhere;
- `sourcePath` is unused in `inspectSemanticAssertion`;
- removing `policy` from the destructuring after the DS-1 correction removes only a dead binding;
- candidate, merge, activation and release checker outputs are behaviourally identical between the
  base and rehearsed Variant B;
- existing observations and diagnostics are byte-identical;
- relevant suites and dual-check arms remain unchanged;
- mutation evidence remains 20/20 applied, 20/20 killed, 2/2 null controls clean, with
  `NOT_APPLIED=0`.

The local AST scan is accepted as preflight evidence only. It does not substitute for the actual
DeepScan result after push.

## Explicitly not authorized

No change is authorized to:

```text
normative-source-precedence.json
perimeter.mjs
check-normative-precedence.mjs
diagnostic identifiers
diagnostic text
compatibility-transition semantics
capability-overlap semantics
review-binding semantics
activation semantics
release semantics
post_review_allowlist
governance_record_only classification
path-specificity behavior
Revision 3
CR-F16
CB-002
contract source
generated schema/catalog artifacts
SDK code
DeepScan configuration
DeepScan suppression configuration
```

No finding may be waived or suppressed.

## Prior review status

The review bound to:

```text
REVIEWED_TECHNICAL_HEAD=3c6b4729537065a88cd7d0e049651f158dfbd6eb
REVIEWED_TECHNICAL_TREE=525faf841bb3548a0b5f5dd6d942d7207691ef6a
SIGNED_REVIEW_RECORD_COMMIT=81c18fbba742ec752a24063ecd837b2a7d82572a
```

remains valid historical evidence for that exact content.

It does not carry forward to the new technical head, because `model.mjs` is one of the
review-bound governed objects.

## Required execution sequence

After this authorization is recorded under the independently verifiable owner-signing mechanism:

1. Verify the authorization commit before applying the cleanup.
2. Confirm its exact parent is `81c18fbba742ec752a24063ecd837b2a7d82572a`.
3. Confirm the authorization binds the exact base object, authorized path, four bounded edits, and
   complete expected resulting blob.
4. Apply Variant B only.
5. Confirm exactly one implementation path changed.
6. Confirm the resulting `model.mjs` blob exactly matches the pre-authorized expected object.
7. Re-run all CB-001 governance and reuse suites.
8. Re-run trusted, candidate and dual checkers.
9. Re-run the corrected mutation harness and require:

```text
APPLIED=20/20
KILLED=20/20
NULL_CONTROLS=2/2 CLEAN
NOT_APPLIED=0
```

10. Run static mutation-anchor survival checks before accepting the mutation result.
11. Push the new technical head.
12. Run exact-head CI and DeepScan.

## Correct pre-review acceptance criterion

Before fresh owner review, the required state is:

```text
REQUIRED_CI_PASSING=9/10
DEEPSCAN=PASS
EXPECTED_PENDING_CONTEXT=design-pattern-governance
```

`design-pattern-governance` must fail solely because the existing review no longer binds the changed
technical object. Acceptable expected diagnostics are the policy-defined fresh-review state, such as:

```text
review-binding-post-review-change
```

or, if the old record is intentionally absent from the evaluated shape:

```text
review-binding-pending
```

There must be no unrelated technical or governance diagnostic.

Do not attempt to make this stage 10/10 by extending authorization, retaining a stale binding,
altering the checker, or waiving the context.

## Fresh review

Once the new technical head and tree are frozen and:

- 9/10 required contexts are green;
- DeepScan is green;
- the only required-context failure is the exact-review binding gate;
- all mutation requirements hold;
- no additional status or check is failing;

request a fresh exact-content project-owner review.

Only after a new signed review record binds the new technical head and tree may the acceptance target
become:

```text
REQUIRED_CI_PASSING=10/10
```

Activation and release must remain unauthorized.

## Withheld

```text
ACTIVATION_AUTHORIZED=NO
RELEASE_AUTHORIZED=NO
REVISION_3_IMPLEMENTATION_AUTHORIZED=NO
CB_002_AUTHORIZED=NO
MERGE_AUTHORIZED_BY_THIS_APPLY_DECISION=NO
```

This apply authorization permits only the bounded Variant B cleanup.

## Authority binding

| Field | Value |
| --- | --- |
| `AUTHORIZING_IDENTITY` | `nandohdc` |
| `AUTHORITY` | `PROJECT_OWNER` |
| `AUTHORIZED_BASE_HEAD` | `81c18fbba742ec752a24063ecd837b2a7d82572a` |
| `AUTHORIZED_BASE_TREE` | `1bbd4dee6700d76866217abb734a9b2ad3ac4f2f` |
| `AUTHORIZATION_SCOPE` | `CB-001-R2-DEEPSCAN-CODE-HEALTH-CLEANUP` |
| Authority evidence | SSH signature on the dedicated commit that introduces this record, made with the signing key whose fingerprint is `SHA256:MSQGfkZ33HtMFLuekps6RSechU/Ki/jK6cRvt4mRUHA`, registered as a signing key on the `nandohdc` GitHub account |
| Effective authorization event | That signed commit, whose single parent is the authorized base head |

A self-asserted field such as `APPLY_AUTHORIZATION=GRANTED` is not proof of authority. This record
carries authority only through the verified signature on its introducing commit. The fingerprint
above is transcribed from the previously verified authorizations `ae897b8` and `81c18fb`; replace it
before signing if a different registered signing key is used.

## Stop conditions

Apply stops, and the cleanup is unauthorized, if the base head or tree differs, if the introducing
commit's signature does not verify against the owner's published signing keys, if the verified key
fingerprint differs from the one bound above, if any path other than
`openspec/scripts/normative-precedence/model.mjs` changes in the cleanup commit, if the resulting
object differs from the required blob, if any mutant fails to apply or to be killed, if any null
control is dirty, or if this record is modified after it is first recorded.

```text
CB_001_DEEPSCAN_CLEANUP_APPLY_AUTHORIZATION=GRANTED
AUTHORIZED_VARIANT=B
```
