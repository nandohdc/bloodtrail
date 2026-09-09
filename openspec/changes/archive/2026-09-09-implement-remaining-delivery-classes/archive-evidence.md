# Archive Evidence — implement-remaining-delivery-classes

Explicit archive validation record (R24) for relocation of
`implement-remaining-delivery-classes` to
`openspec/changes/archive/2026-09-09-implement-remaining-delivery-classes/`.

Archive validation is explicit and is not implied by strict OpenSpec validation
alone.

## Completion record

- **1.1–1.2** were completed by the proposal, PR #411 at head
  `8e37437`, merged as `14f5392fabb94b437a79d77e4c12815ce6170424`. The diff
  modified only paths under `openspec/changes/implement-remaining-delivery-classes/`.
- **2.1–4.5** were completed by the implementation, PR #415 at head
  `a59cec8a`, merged as `753c8cf1ccf3f30abd31eb1cbcc42044ed1b607d`. It touched
  only `packages/security-audit-sdk-node/` and this change's own `tasks.md`;
  `git diff origin/main -- openspec/specs/` was empty.
- **5.1** is completed: the canonical fold, PR #417, merged as
  `13bae3e4318b4dd872653e03387b7808c650c996`. It materialized all eight delta
  requirements and twenty-seven scenarios in
  `openspec/specs/security-audit-sdk-node/spec.md` while this change was active,
  taking that capability from twelve requirements to twenty with no name
  collision, and recorded task completion.

## What the implementation established

Each class was implemented against its own row of the frozen
`delivery_class_contracts`, and the conformance suite reads those rows out of
`contracts/security-audit/source/contract.source.json` at test time rather than
restating them, so a row edit breaks the suite instead of leaving it silently
divergent. `security_significant` participates as the already-satisfied control.

Two defects were found and fixed during implementation rather than after:

- **A concurrency gap in transaction-critical deduplication.** The first draft
  recorded the deduplication key only after a successful delivery, so two
  concurrent attempts on the same `(eventId, transactionId)` could each run a
  business commit gate. Admission — the duplicate check and its reservation — is
  now decided in one synchronous step before any `await`, an in-flight duplicate
  is refused rather than reported delivered, and the reservation is released on
  success and failure alike.
- **An unprovable saturation claim.** The best-effort loss ceiling was a constant
  at 1,000,000 drops, which no test can reach; the suite asserted only that the
  constant was bounded. The ceiling is now readable from the binding and
  configurable within a bounded range, and saturation and its validation are both
  exercised.

Post-merge, the built package was exercised against the contract's own positive
examples and reproduced the load-bearing behaviours, including
`commitGateInvoked: false` when audit durability is unreachable.

## The contested acceptance criterion

#112 states "No contract artifact, event catalog entry, or frozen core/Node API
surface is modified", while `adr/001-frozen-public-api-surface.md` states that
adding an export "must be updated in the same governed change".

The **additive reading** was taken: 13 value and 24 type exports became 17 and
41, removing and renaming nothing, with the frozen lists in
`scripts/check-exports.mjs` updated in the same change.
`adr/002-governed-widening-for-remaining-delivery-classes.md` records the reading,
its three reasons, the rejected stricter alternative, and **the exact revert**
that would apply the stricter one — the export block in `index.ts` plus the two
frozen lists, on which nothing else depends.

`compatibility.json` records the widening as `freezeRecord.amendments` rather
than by rewriting `valueExportCount`/`typeExportCount`, so what #111 froze at
`2833852489e162954bdd495a4c466cbdc75fee84` stays legible beside the one governed
widening.

## Merge posture

No pull request in this chain carried a completed reviewer run bound to its head.
No Hermes reviewer fleet ran in the session that produced them, and no reviewer
run was fabricated to satisfy the merge gate's review arm. Every merge rests on
the owner's away-window authorization of 2026-09-09 together with green required
checks, and each pull request carries a comment recording the gate arm by arm,
including the failing review arm.

**No merge in this chain is evidence that an independent review occurred.**

## Archive geometry and byte identity

The following files are moved byte-for-byte from the active change at archive
base `13bae3e4318b4dd872653e03387b7808c650c996`; `archive-evidence.md` is the
only newly authored archive file. `tasks.md` was already fully checked by the
separate canonical-fold pull request, so this relocation changes no task text.

| Relocated file | Archive-base blob |
| --- | --- |
| `.openspec.yaml` | `1ea7e36f49a4d8fd7e0a757a1df1a234cd8e6bdc` |
| `assessment.json` | `47f5987ca0b106f64f9b93225a50308a8acaefb7` |
| `assessment.source.json` | `cb023cf84d114b299852e12b2a91d45c307c8d3d` |
| `design.md` | `bef104dfdf6385fe9ad6adf779a09329a3ecd767` |
| `proposal.md` | `29d7c7fe170168da1f6f2117af88a546e6de83e4` |
| `specs/security-audit-sdk-node/spec.md` | `d74ea29ce0a56afc4343429096a83a3772a5865a` |
| `tasks.md` | `b4aa9128068d05e9a0825464ff073b1b2da3454a` |

## Boundary at archive

No delivery substrate was introduced. `transaction_critical`'s row names a
"transactional outbox or equivalent behavior, product not selected"; the
durability boundary remains an **injected port**, and selecting a substrate
requires its own OpenSpec change with its own authorization.

`transport`, `collector`, `queue`, `outbox`, and `storage` remain forbidden
filename, import, and export tokens in every package's `check-scope.mjs`, and the
canonical contract stays frozen at `1.0.0` with its 24-event catalog unchanged.

Conformance evidence proves the implemented semantics for the exercised class
against an injected boundary. It proves nothing about the durability of a
substrate that has not been selected, and it does not make any class
production-ready — `policy_critical` in particular remains blocked for production
use by its own row until a policy owner records a decision. This change makes
that blocking mechanical; it does not lift it.
