# ADR-NODE-002: Governed additive widening of the frozen surface for the remaining delivery classes

- Status: Accepted for SDK-node implementation
- Date: 2026-09-09

## Context

ADR-NODE-001 froze `src/index.ts` at 13 value exports and 24 type-only exports, and stated the path
for changing it: *"Adding, removing, or renaming any export is a public API change: the frozen lists
in `check-exports.mjs` must be updated in the same governed change that makes the change, through
this repository's ordinary OpenSpec/design-pattern-governance process."*

Issue #112 implements the three governed delivery classes the vertical slice did not exercise —
`best_effort`, `transaction_critical`, and `policy_critical` — and is sequenced deliberately *after*
the freeze. Its acceptance criteria also say "No contract artifact, event catalog entry, or frozen
core/Node API surface is modified."

Those two sentences pull in opposite directions, so this ADR records which reading was taken and why.

## Decision

**This change widens the frozen surface additively, under ADR-NODE-001's own stated process. It
removes nothing and renames nothing.** The frozen lists in `check-exports.mjs` move from 13/24 to
17/41 in this same change, and `compatibility.json` records the widening as an amendment to the
`freezeRecord` rather than by rewriting it — so the record of what #111 froze at
`2833852489e162954bdd495a4c466cbdc75fee84` stays intact and the one governed widening is visible
beside it.

The reading taken of #112's "no frozen surface is modified" criterion is **no breaking modification**:
no existing export is removed, renamed, or retyped. Three reasons:

1. ADR-NODE-001 explicitly provides for additive change through a governed change. A criterion read
   as forbidding what the ADR provides for would make the ADR's own process unreachable.
2. #112's *Verification* section names only "generated-artifact drift checks to prove no contract or
   catalog mutation occurred". It prescribes no export-surface check, which is where the criterion's
   weight sits.
3. The tier this issue belongs to exists for exactly this: the roadmap's gate line for post-freeze
   breadth reads "Deliberately after the freeze: widening the surface before the API is fixed means
   re-doing it." Widening after the freeze is the sequencing's purpose, not a violation of it.

The alternative reading — no new exports at all — was considered and rejected. Under it the class
bindings could exist only as unexported internals, reachable by no consumer, which would satisfy the
letter of one criterion while making "Implement each remaining class against its own
`delivery_class_contracts` row" unachievable as a usable feature.

**This reading is recorded rather than assumed.** If the owner intended the stricter reading, the
correction is cheap and local: revert `index.ts`'s new export block and the two frozen lists, and the
class bindings become internal. Nothing else in this change depends on the surface being public.

## What was added

Four value exports — `createBestEffortDelivery`, `createTransactionCriticalDelivery`,
`createPolicyCriticalDelivery`, and `BEST_EFFORT_LOSS_CEILING` — and seventeen type-only exports
naming their options, results, guarantees, and refusal codes.

`GovernedDeliveryClass` is an alias of `SecurityAuditEvent["event"]["delivery_class"]`, derived from
the core's own type rather than restated, preserving #111's criterion that the Node surface reuse
core semantic types instead of duplicating them. `check-exports.mjs` continues to verify that no
added name collides with the core's frozen surface.

## Boundary

This ADR widens `@bloodtrail/security-audit-sdk-node`'s public export surface and nothing else. It
does not unfreeze the surface, publish this package, authorize production deployment, or add a
transport, outbox, queue, or storage substrate — the durability boundary for `transaction_critical`
stays an injected port whose selection is a separate governed change with its own authorization.
