# Design — implement-remaining-delivery-classes

## Context

`packages/security-audit-sdk-node/src/` carries four delivery primitives, all class-agnostic:

| Module | What it does | What it knows about delivery classes |
|---|---|---|
| `http-handoff.ts` | exactly one exchange for one attempt | nothing |
| `delivery-retry.ts` | bounded, jittered retry over a handoff | nothing |
| `delivery-backpressure.ts` | bounded synchronous admission gate | nothing |
| `delivery-shutdown.ts` | deadline-bounded drain | nothing |

The vertical slice (#109) composed them by hand for `security_significant` and recorded the evidence.
Nothing in the package refers to a delivery class at all, and `delivery_class_contracts` is not among
the artifacts the generator emits into `src/generated/` — so the rows exist only in the frozen
contract source.

The catalog, meanwhile, assigns every one of the 24 events a class:

```
transaction_critical  11
security_significant   8
policy_critical        4
best_effort            1
```

So the substitution risk is concrete: a single `best_effort` event sits in a catalog where 15 of 24
events demand more.

## Decision

### 1. A class is a policy over the primitives, not a new transport

Each binding composes the existing boundary and adds only what its row needs that the primitives
cannot know: a loss counter, a commit gate, a policy record. Nothing here opens a socket, and the
durability substrate stays injected — `transaction_critical`'s row names "transactional outbox or
equivalent behavior, **product not selected**", and #112 puts selecting one out of scope.

### 2. Class binding is exact match, in both directions

A binding accepts an occurrence only when `EVENT_CATALOG`'s entry for its name declares the binding's
own class. The alternative is a strength ordering with "at least as strong" substitution allowed.

Rejected, for two reasons. The contract fixes no ordering — `policy_critical`'s durability row reads
"at least security-significant; **may** require transaction-critical semantics", which is explicitly
not comparable to `transaction_critical`. And the substitution is unsafe *upward* as well as
downward: `best_effort`'s posture is `fail_open`, `transaction_critical`'s is `fail_closed before
business commit`, so promoting a best-effort occurrence would give an event the catalog treats as
losable the power to block a business commit.

Exact match needs no invented ordering and makes both silent weakening and silent strengthening
impossible. Two distinct refusals — a class mismatch and an uncatalogued name — because they call for
different fixes: one is a wiring error, the other is an event that is not in the contract at all.

### 3. `best_effort`: the loss counter is the feature

The row's `backpressure` reads "drop with bounded counter and health signal" and its `semantic` is
"At-most-once acceptable with **bounded loss reporting**". So the counter is not diagnostics — it is
the thing that makes at-most-once acceptable, because loss you cannot see is not loss you accepted.

Three consequences fall out:

- **One attempt, never a retry.** Routing `best_effort` through `createBoundedDeliveryRetry` would be
  a silent upgrade to a stronger class than the catalog asked for.
- **The counter saturates.** "Bounded" cannot mean an unbounded integer, and a wrapping counter would
  under-report — the one failure mode a loss signal may not have. It saturates at
  `BEST_EFFORT_LOSS_CEILING`, and reaching the ceiling fires its own callback so the ceiling itself is
  never silent.
- **The health signal carries `claimsDelivered: false` as a literal type.** Not a runtime value that
  happens to be false — a type that cannot hold anything else, so no future edit can make a
  `best_effort` shutdown report a delivery.

`shutdown()` is synchronous. The row says "no unbounded delay"; with one attempt and no retry queue
there is nothing outstanding to drain, so returning immediately is the strongest possible reading.

### 4. `transaction_critical`: the order is the guarantee

The row asks for two things that look contradictory until the order is fixed:

- `semantic`: "Audit durability **atomic with successful business commit**"
- `business_failure_posture`: "**fail_closed before business commit** if audit durability cannot be
  reached"

and #112 adds "a fixture proves an audit record is **not durable ahead of** the business commit gate."

One order satisfies all three:

```
1. durabilityProbe()   ── false ─→ failed_closed(audit_durability_unreachable)
      │                             commitGateInvoked: false, durabilityAttempted: false
      ↓ true
2. commitGate()        ── declined ─→ failed_closed(business_commit_declined)
      │                               commitGateInvoked: true, durabilityAttempted: false
      ↓ committed
3. handoff()           ── not acknowledged ─→ failed_closed(audit_durability_unreachable)
      │                                       commitGateInvoked: true, durabilityAttempted: true
      ↓ acknowledged
   committed_and_durable
```

Step 1 is what makes the fail-closed posture real: the business commit *cannot* happen when audit
durability is unreachable, because the gate is never invoked. Step 3 after step 2 is what keeps the
record from becoming durable ahead of the commit.

The two boolean fields on `failed_closed` exist so the ordering is **observable** rather than
asserted. A test can distinguish "we never got to the commit" from "we committed and then durability
failed" — and those are genuinely different operational situations, the second leaving a committed
business transaction with no audit record, which is exactly the state an operator needs to see.

Deduplication is keyed `${eventId} ${transactionId}`. The separator is a space, which appears in
neither a UUID nor any transaction-id alphabet in use, so two distinct pairs cannot collide into one
key. Only a delivery that *reached* durability is recorded, so a fail-closed occurrence stays
retryable rather than becoming a phantom duplicate — otherwise a transient durability failure would
permanently suppress the audit record.

### 5. `policy_critical`: construction throws, because there is no default

The row's posture is `blocked_pending_qualified_review` and its `outage` reads "production blocked
until reviewed policy exists". A binding constructible without a policy record would *have* a default
behaviour — whatever the code did in that case — and the row says there is none.

So `createPolicyCriticalDelivery` throws when the record is absent, names a behaviour outside the
three the row enumerates, has no policy owner, or has no review reference. Throwing rather than
returning a result is the SDK's documented single exception — configuration errors throw at
construction — and it is the only treatment that makes the absence of a policy unrepresentable rather
than merely discouraged.

Requiring an owner *and* a review reference, not just the behaviour, is deliberate: "someone chose
fail_open" and "a policy owner approved fail_open, recorded at X" are different facts, and only the
second is the reviewed policy the row demands.

The returned record is frozen, so the approval cannot be edited into a different one after
construction.

### 6. The suite reads the rows instead of restating them

The conformance contract's first requirement is *"Delivery conformance derives exclusively from the
frozen delivery class contract"*, with the scenario *"Conformance statement traces to a frozen row"*.

A suite that restates a row as an expected string satisfies that only by convention: edit the row and
the suite keeps passing against yesterday's contract. So the suite reads
`delivery_class_contracts` out of `contracts/security-audit/source/contract.source.json` at test
time, and asserts implemented behaviour against the row text — `/at-most-once/i` on the semantic,
`/bounded counter/i` on best-effort backpressure, `/event id and transaction id/i` on
transaction-critical idempotency, `/blocked_pending_qualified_review/i` on the policy-critical
posture. A row edit breaks the suite.

**Why read rather than generate.** Emitting the rows into `src/generated/` would be the
single-source-of-truth move, and it was rejected on blast radius: it changes sdk-core's generated
output, requires a new sdk-core export, and sdk-core's surface is frozen too — so a test-only concern
would have widened a second frozen package. Reading the canonical file has no drift risk at all,
because there is no copy.

Occurrences come from `contracts/security-audit/examples/positive/all-events.json` — the contract's
own example set — so each arm runs against the real catalog entry for its class rather than a
hand-built shape that might not be a valid event.

The arms are parameterized rather than copied per class. Beyond the obvious, this repository has a
specific reason: making several tests assert the same contract by copy trips CodeScene's duplication
analysis, and the resolution there is to parameterize rather than suppress.

`security_significant` participates as the **null control**. A suite that only ran the three new
classes could pass while asserting nothing the vertical slice had not already proven; including the
satisfied class makes "these assertions have teeth" checkable.

## The frozen-surface conflict

#112 says "No contract artifact, event catalog entry, or frozen core/Node API surface is modified."
ADR-NODE-001 says "Adding, removing, or renaming any export is a public API change: the frozen lists
in `check-exports.mjs` must be updated in the same governed change that makes the change."

**This change reads #112's criterion as "no *breaking* modification"** and widens additively, updating
the frozen lists here. `ADR-NODE-002` records it. Three reasons:

1. ADR-NODE-001 provides for exactly this. A reading that forbids what the ADR provides for makes the
   ADR's own process unreachable.
2. #112's *Verification* section prescribes only "generated-artifact drift checks to prove no
   contract or catalog mutation occurred" — it names no export check, which is where the criterion's
   weight sits.
3. The roadmap's gate line for this tier reads: "Deliberately after the freeze: widening the surface
   before the API is fixed means re-doing it." Widening after the freeze is the sequencing's purpose.

The stricter reading — no new exports — was rejected because under it the bindings exist only as
unexported internals reachable by no consumer, satisfying the letter of one criterion while making
"Implement each remaining class against its own `delivery_class_contracts` row" unachievable as a
usable feature.

**This is flagged rather than assumed.** If the stricter reading was intended, the revert is the
export block in `index.ts` plus the two frozen lists — nothing else depends on the surface being
public.

`compatibility.json` records the widening as `freezeRecord.amendments` rather than by rewriting
`valueExportCount`/`typeExportCount`. Rewriting them would erase what #111 actually froze at
`2833852489e162954bdd495a4c466cbdc75fee84`; the amendment keeps both facts visible.

## What this does not establish

Conformance evidence proves the implemented semantics for the exercised class against an injected
boundary. It proves nothing about the durability of a substrate that has not been selected: a
`transaction_critical` binding whose `durabilityProbe` returns `true` and whose handoff acknowledges
has satisfied its row, and that is a statement about the protocol, not about any real store.

It also does not make any class production-ready. `policy_critical` in particular remains blocked for
production use by its own row until a policy owner records a decision — this change makes that
blocking mechanical, it does not lift it.

## Revisit conditions

- A durability substrate is authorized — step 3's injected boundary becomes a real one, and step 1's
  probe becomes a real reachability check rather than an injected predicate.
- `delivery_class_contracts` is edited — the suite fails by design, and the failure names the row.
- The owner intends the stricter frozen-surface reading — apply the revert named above.
- A future adapter (#113) adds a second boundary — the class bindings should compose over it
  unchanged, and that is the first thing to check rather than assume.
