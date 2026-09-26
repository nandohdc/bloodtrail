## Context

`proposal.md` explains why this change exists. The umbrella, `deliver-sdk-evaluation-alpha`, owns
everything else in the evaluation alpha. Its `design.md` holds the conventions both changes share:
exact-path ownership amended in place, flat test layout, and rebasing after every merge.

The state at `main` `73493c5` that shapes this design:

- **The frozen Node surface.** It is frozen by ADR-NODE-001 and widens only additively. Every widening
  updates the frozen export lists, the freeze-record amendments in `compatibility.json`, the
  source-inventory pins in `tests/scope-mutations.test.ts`, and an ADR, all together.
- **The fetch adapter.** A1 (`createFetchHttpExchange`) is the only code allowed to reach `fetch`. Its
  inventory (#113) defines an adapter as code that performs the exchange.
- **The delivery handoff.** It owns every HTTP classification today (ADR-NODE-003). Its request projection
  rewrites `correlation.retry_attempt` (#577), which is out of scope here.
- **The core's sink-failure diagnostics.** The ratified F-11 requirement forbids event IDs in them, and
  sdk-core's coherence check freezes that requirement.

## Goals / Non-Goals

**Goals:**

- A byte-exact, single-attempt HTTP sink that evaluators can wire in with one factory call.
- One classification source shared with the delivery handoff.
- An additive widening, with no change to the scope gate's rules.

**Non-Goals:**

- Retry, batching, queueing, backpressure, ordering and durability.
- Delivery-class conformance.
- Fixing the handoff's `retry_attempt` behaviour, which is #577.
- Any evaluator documentation. That belongs to the umbrella.

## Decisions

### D1. The sink composes A1; it is not a new adapter

`src/http-audit-sink.ts` calls `createFetchHttpExchange` directly. It builds its own request, with the
SDK-validated event serialized once as the body.

It does not go through the handoff's request projection. That projection rewrites
`correlation.retry_attempt`, which would break byte-exactness.

The sink performs no exchange itself, so it needs no entry in A1's inventory. Only `src/fetch-exchange.ts`
reaches `fetch`.

*Alternative: wrap `createHttpDeliveryHandoff`.* Rejected. Its projection is the #577 defect, and its
outcome set carries attempt semantics the sink does not claim.

### D2. One internal response classifier

#579 moves the handoff's response classification into `src/http-response-classification.ts`, an internal
module that is not exported. The handoff and the sink both call it. The request-side codes
(`request_too_large`, `request_serialization_failed`) stay with the handoff.

This changes ADR-NODE-003's letter, which says classification stays with the handoff, while keeping its
intent of a single classification source.

- #579 adds no ADR, because the handoff is still the classifier's only user.
- ADR-NODE-004 records the change when the sink adopts the classifier, in #589.
- ADR-NODE-003 gains a pointer to ADR-NODE-004 and is not otherwise rewritten.

*Alternative: duplicate the rules in the sink.* Rejected, because the two rule sets would drift.

### D3. The event identifier reaches developers through the outcome callback

This is deviation 6 in the umbrella's proposal. The core's sink-failure results keep F-11's diagnostics.

`onOutcome` receives `{ eventId, outcome, status? }`, as #590 specifies. The `outcome` field holds the shared
classifier's code, `acknowledged` included. The callback never receives a body, a payload or a header
value. A callback that throws or rejects is contained.

### D4. Files stay flat, and names pass the scope gate

- `http-response-classification.ts` and `http-audit-sink.ts` avoid every token the scope gate forbids,
  such as `transport` and `adapter`.
- The new tests sit directly in `tests/`. The Node binding's `test:runtime` passes
  `dist-tests/**/*.test.js` through `sh`. As the umbrella's D4 records, one test subdirectory would
  silently drop every top-level runtime test.

## Path plan

All paths are relative to `packages/security-audit-sdk-node/`. Every one of them is in `owned_paths`.

| Ticket | Paths |
|---|---|
| #579 | `src/http-response-classification.ts` (new), `src/http-handoff.ts`, `tests/scope-mutations.test.ts` |
| #589, #590, #591 | `src/http-audit-sink.ts` (new), `src/index.ts`, `scripts/check-exports.mjs`, `compatibility.json`, `adr/004-http-audit-sink-and-shared-response-classification.md` (new), `adr/003-governed-fetch-delivery-adapter.md`, `tests/http-audit-sink.test.ts` (new), `tests/scope-mutations.test.ts` |
| #592 | `tests/http-audit-sink-mutations.test.ts` (new) |
| #606 | `openspec/specs/security-audit-sdk-node/spec.md`, folded together with the umbrella |
| #607 | this change directory and its dated archive directory, relocated together with the umbrella |

**Shared canonical spec.** Both changes own the Node canonical spec, because each declares the capability.
Their requirement names are distinct, and #606 applies the two deltas one after the other.

**Files that stay out of this change.** The Node README stays with the umbrella's #601. Documenting the
sink is evaluator-facing, so no sink PR edits the README.

## Risks / Trade-offs

- [This is the first sink that reaches a network.] → It is confined to A1, non-production, and
  single-attempt. The owner's approval act for both changes is its explicit authorization.
- [An `onOutcome` callback that throws or blocks the sink.] → Its errors are contained, and the callback
  receives only closed values. A test with a throwing callback proves the result is unchanged.
- [A sink change during the evaluation.] → This change stays active until the fold, so a re-issue fix
  lands under it, with a task added before 4.1.

## Migration Plan

Nothing is deployed. The widening is additive, so rolling back means reverting the PRs, and the freeze
record keeps the history of every amendment.
