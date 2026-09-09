# Proposal — implement-remaining-delivery-classes

Implement conformance for the three governed delivery classes the vertical slice did not exercise —
`best_effort`, `transaction_critical`, and `policy_critical` — against their own frozen
`delivery_class_contracts` rows.

## Why

The contract fixes four delivery classes and gives each one a row that settles seven dimensions:
`semantic`, `durability`, `idempotency`, `retry`, `backpressure`, `shutdown`, and `outage`, plus a
`business_failure_posture`. The vertical slice (#109) proved exactly one of them,
`security_significant`, because it is the only class that exercises every claimed property. The other
three have no implementation and no other issue.

They are not variations on the one that exists. Each row asks for behaviour the composed
`security_significant` path does not have and, in one case, must not have:

- **`best_effort`** is the only class that may lose an occurrence. Its row asks for at-most-once with
  *bounded loss reporting* and a *drop with bounded counter and health signal*. Running it through
  the bounded-retry path would be a silent upgrade; running it with no counter would make the loss
  unobservable, which is the one thing the row forbids.
- **`transaction_critical`** is the only class whose failure must stop a *business* operation. Its
  posture is `fail_closed before business commit if audit durability cannot be reached`, and its
  idempotency is `dedupe by event id and transaction id` — two identifiers, where every existing path
  uses one.
- **`policy_critical`** is the only class with no default behaviour at all. Its posture is
  `blocked_pending_qualified_review` and its `outage` row reads `production blocked until reviewed
  policy exists`. A binding that can be constructed without a recorded policy-owner decision has a
  default, and the row says there is none.

The catalog also makes substitution a live risk rather than a theoretical one: all 24 events declare
a class, and the distribution is uneven — 11 `transaction_critical`, 8 `security_significant`, 4
`policy_critical`, 1 `best_effort`. A binding that accepted any occurrence would let the single
`best_effort` path carry an occurrence the catalog says must be transaction-critical.

## What Changes

Adds `packages/security-audit-sdk-node/src/delivery-classes.ts` with three class bindings, and a
parameterized conformance suite that reads the frozen rows rather than restating them.

- **Class binding is exact-match, in both directions.** A binding accepts only occurrences whose
  catalog entry declares its own class. Exact match rather than an "at least as strong" ordering,
  because the contract fixes no ordering and the substitution is unsafe both ways: delivering a
  `transaction_critical` occurrence as `best_effort` tolerates loss the catalog says is intolerable,
  and delivering a `best_effort` occurrence as `transaction_critical` gives an event whose posture is
  `fail_open` the power to block a business commit.
- **`best_effort`**: one attempt, never a retry, drop on any non-acknowledgment, a **saturating**
  loss counter (bounded reporting cannot be an unbounded counter, and a wrapping one would
  under-report), and a health signal whose `claimsDelivered` is structurally `false`. `shutdown()`
  returns immediately, because nothing is ever outstanding.
- **`transaction_critical`**: a fixed three-step order — probe audit durability, then run the
  caller's business commit gate, then reach the durability point. Each step's failure has its own
  outcome, and the result records whether the commit gate ran and whether the durability point was
  reached, so "not durable ahead of the commit" is observable rather than asserted. Deduplication is
  keyed on event id **and** transaction id together.
- **`policy_critical`**: construction **throws** without a complete policy-owner decision naming
  `fail_open`, `fail_closed`, or `deferred_completion` plus an owner and a review reference. That
  matches this SDK's one exception to results-not-exceptions — configuration errors throw — and it is
  the only treatment consistent with `blocked_pending_qualified_review`.
- **A common conformance suite** parameterized over the classes, which reads
  `delivery_class_contracts` out of `contracts/security-audit/source/contract.source.json` at test
  time. A row edit breaks the suite instead of silently diverging from it, which is what the
  conformance contract's *"conformance statement traces to a frozen row"* requirement asks for.
  Events come from the contract's own positive example set, so each arm runs against the real catalog
  entry for its class. `security_significant` participates as the already-satisfied null control.

## The frozen-surface reading, stated because it is contestable

#112's acceptance criteria say "No contract artifact, event catalog entry, or frozen core/Node API
surface is modified", while ADR-NODE-001 says adding an export is a public API change that "must be
updated in the same governed change". Those pull in opposite directions.

**This change takes the additive reading**: it adds exports and updates the frozen lists in
`check-exports.mjs` in this same change, removing and renaming nothing. `ADR-NODE-002` records the
reading and its three reasons — the ADR provides for exactly this, #112's own *Verification* section
names only contract and catalog drift checks, and the roadmap's gate line for this tier reads
"Deliberately after the freeze: widening the surface before the API is fixed means re-doing it."

The stricter reading — no new exports at all — was considered and rejected because under it the class
bindings could exist only as unexported internals reachable by no consumer, satisfying one criterion
by making the issue's central requirement unachievable.

**If the owner intended the stricter reading, the correction is cheap and local**: revert the export
block in `index.ts` and the two frozen lists, and the bindings become internal. Nothing else depends
on the surface being public.

## Capabilities

- `security-audit-sdk-node`: the three remaining governed delivery classes, their exact-match class
  binding, their per-class guarantees and failure outcomes, and the common conformance obligation
  that each traces to its own frozen row.

## Impact

- Affected code: `packages/security-audit-sdk-node/` only — one new source file, one new test file,
  the export surface and its frozen lists, the pinned scope-gate source counts, a new ADR, and a
  `freezeRecord.amendments` entry in `compatibility.json`.
- The frozen `freezeRecord` for #111 is **not rewritten**. The widening is recorded beside it as an
  amendment, so what was frozen at `2833852489e162954bdd495a4c466cbdc75fee84` stays legible.
- No `contracts/` path, no generated artifact, no workflow, no `packages/security-audit-sdk-core/`
  path, no `packages/security-audit-collector/` path.
- Out of scope, and unchanged by this change: adding, renaming, or removing audit **event** classes
  (the 24-event catalog is frozen); modifying `delivery_class_contracts` or any contract artifact;
  and implementing a transactional outbox, queue, or storage engine. `transaction_critical`'s
  durability row names "transactional outbox or equivalent behavior, product not selected" — the
  durability substrate stays an **injected port**, and selecting one requires its own OpenSpec change
  and explicit authorization. `outbox`, `queue`, and `storage` remain forbidden tokens in
  `check-scope.mjs` and this change does not ask that to stop.
