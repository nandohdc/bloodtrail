# ADR-NODE-003: Governed additive widening for the fetch delivery adapter

- Status: Accepted for SDK-node implementation
- Date: 2026-09-10
- Decision source: `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`

## Context

#113 asks for post-freeze delivery adapters, and its first acceptance criterion is that every adapter
is named in an approved governed inventory. None existed. The inventory is recorded in
`openspec/changes/implement-fetch-delivery-adapter/inventory.md` and approves exactly one adapter: an
`HttpExchange` over the Node runtime's `fetch`.

ADR-NODE-001 froze the surface and ADR-NODE-002 established the path for widening it additively. This
is the second use of that path.

## Decision

Add one value export, `createFetchHttpExchange`, and one type-only export, `FetchHttpExchangeOptions`.
The frozen lists in `check-exports.mjs` move from 17/41 to 18/42, and `compatibility.json` records the
widening as a third `freezeRecord` amendment rather than rewriting the record. Nothing is removed,
renamed, or retyped.

The adapter adds no conformance semantics of its own. It maps native `fetch` outcomes onto the
existing `HttpExchangeOutcome` set, and every classification — acknowledged, retryable, permanent,
protocol error — stays with `createHttpDeliveryHandoff`. The common per-class conformance suite runs
once through the in-process exchange and once through this adapter over a loopback socket.

## Reversal

Revert `index.ts`'s export line, the two frozen-list entries, the amendment, the coupling role, and
`src/fetch-exchange.ts`. No other export depends on the adapter.
