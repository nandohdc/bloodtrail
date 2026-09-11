## Why

#113 asks for post-freeze delivery adapters that conform to the frozen delivery semantics. Its first
acceptance criterion is that every adapter is named in an approved governed inventory, and none
existed. Meanwhile `createHttpDeliveryHandoff` has always needed an injected `exchange` that nobody
supplies: the vertical slice (#109) used an in-process fake, and the #116 pilot wrote a `fetch`
exchange by hand.

## Authorization

The owner's 2026-09-10 instruction names #113. The inventory and the adapter are
`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`.
Nothing here authorizes a deployment, an endpoint, or delivery infrastructure.

## What Changes

- **`inventory.md`** approves one adapter, A1 `createFetchHttpExchange`, and records the candidates
  it does not approve and why: OTLP exporter, CloudEvents envelope, queues and outboxes, gRPC.
- **`src/fetch-exchange.ts`** implements A1 over the runtime's `fetch`. The origin is scheme, host, and
  port only; redirects are never followed; each attempt has a deadline and response bodies are read to
  a bound. A response becomes a `response` outcome with its parsed acknowledgments, a deadline becomes
  `timeout`, and a connection failure becomes `transport_failure`. An unparseable, empty, shapeless, or
  oversized body becomes an acknowledgment the handoff rejects as a protocol error. The adapter
  classifies nothing itself.
- **The common per-class conformance suite is parameterized by transport** and runs once through the
  in-process exchange and once through A1 over a loopback socket. Adapter-specific arms cover timeout,
  refusal, malformed and oversized bodies, redirect, headers, and origin validation.
- **Governed additive widening** of the frozen surface (ADR-NODE-003): one value export and one type
  export, recorded as a third `freezeRecord` amendment. The scope gate gains a per-file role that lets
  only `src/fetch-exchange.ts` reach `fetch` and `AbortSignal`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: the scope requirement admits `fetch` and `AbortSignal` for the adapter
  file alone, with a new confinement scenario, and one requirement is added for the adapter.

## Impact

`packages/security-audit-sdk-node/` only: one new source file, `index.ts`, the coupling policy, the
scope and export gates, `compatibility.json`, an ADR, the README, and tests. No contract, collector,
or Core change.
