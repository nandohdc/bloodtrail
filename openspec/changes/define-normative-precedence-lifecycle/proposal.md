## Why

Revision 2 established Bloodtrail's normative authority model, but the post-merge fold analysis
proved that its fold transition cannot safely move exact applicability, overlap, debt, review, and
authorization evidence onto newly materialized canonical objects. Revision 3 is required before any
CB-001 delta can be folded without mutating history, carrying stale evidence, or allowing a
candidate checker or activation record to authorize itself.

This proposal is bound to the owner-reviewed planning package:

```text
BASE_HEAD=49ab0c255a41cc99328ff2cd5d442ffbc80b1bb1
BASE_TREE=d608182899cb981403201c746ac7a18ddbc1d8c9
PACKAGE_SET_SHA256=071d5433d950c5c602e8706d86ce8fc8c2be2b39f3b78823131313b0e2922b43
MANIFEST_SHA256=117b6a59a1fa8ceab9ee84837548b340b238591ac52bf7bb3256e6af800766fd
```

The package review authorizes this planning freeze only. It grants no implementation, fold,
activation, release, archive, CB-002, CB-018, or CB-019 authority.

## What Changes

- Preserve every existing pin, overlap, debt, authorization, freeze, and review binding as immutable
  historical evidence; each folded state receives a new exact pin set and technical identity.
- Recompute applicability, overlap classifications, and bounded inherited debt from the exact
  post-fold repository objects. Missing, ambiguous, conflicting, stale, or silently carried evidence
  fails closed.
- Replace the CB-001-specific apply-authorization filename dependency with deterministic per-change
  authorization discovery under a closed schema and protected-baseline authority registry.
- Define a bounded revision cycle for a verified active change and an exact `VERIFIED` to `FOLDED`
  transition whose authority is independent from merge, activation, release, and archive authority.
- Resolve CR-F16 by using the same most-specific path classification for association and dedicated
  `governance_record_only` validation, without creating a blanket governance-path exemption.
- Strengthen mutation assurance so all 22 planned mutants have one live anchor, apply, are killed by
  their intended control, and restore byte-identically; any not-applied mutant fails assurance.
- Add repository tests and negative controls for the new behavior while preserving the trusted-
  baseline/candidate-checker separation.
- Leave all three active CB-001 deltas unfolded. A later, separately authorized fold must use the
  Revision 3 mechanism and receive a fresh exact-content review.
- Preserve the existing `schema.version=2.1.0` source/current-capability conflict as activation- and
  release-blocking debt owned by CB-018. CB-019 remains the downstream schema-identity projection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-governance`: Define immutable fold evidence, per-change operation authorization, bounded
  revision and fold transitions, fresh fold identity, and independent fold authority.
- `software-design-pattern-governance`: Define exact fold-time recomputation, most-specific governed
  path association, authorization discovery trust, and fail-closed mutation assurance.
- `security-audit-event-contract`: Retain the existing Revision 2 semantic/source boundary unchanged;
  Revision 3 adds no contract-version or event-contract semantic decision.

## Impact

- Planning identifies future governance policy, schema, checker, fixture, test, and minimal CI paths
  under `openspec/`; no operative trusted enforcement changes in this proposal identity.
- Implementation will add append-only pin and authorization evidence models while preserving every
  merged Revision 2 object as historical evidence.
- Generated or derived implementation outputs are limited to the governed assessment and any test
  fixtures explicitly produced by future authorized implementation. Contract and SDK generated
  artifacts are excluded.
- The three active deltas for `change-governance`, `security-audit-event-contract`, and
  `software-design-pattern-governance` remain active and unfolded.
- `contracts/security-audit/source/contract.source.json`, generated contract artifacts, validators,
  SDK outputs, activation evidence, and Candidate B remain unchanged.

Refs #533.
