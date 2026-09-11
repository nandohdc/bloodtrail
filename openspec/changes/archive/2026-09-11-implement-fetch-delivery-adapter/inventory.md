# Governed Delivery Adapter Inventory (#113)

Status: **approved under delegation — one adapter**.

- **Decision source:** `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`,
  under the owner's 2026-09-10 instruction to implement #96–#132. The owner has not personally
  reviewed this inventory, and it is not an exact-commit authorization.
- **Scope:** delivery adapters for `@bloodtrail/security-audit-sdk-node` only — code that performs the
  exchange `createHttpDeliveryHandoff` delegates. No deployment, endpoint, credential system, or
  delivery infrastructure is approved by this inventory.

## Approved

| Id | Adapter | Native boundary | Why it is approved |
|---|---|---|---|
| A1 | `createFetchHttpExchange` | the Node runtime's `fetch` over HTTP(S) | The handoff already speaks HTTP. Without this adapter every consumer writes an ad-hoc `exchange`, and the #116 pilot had to. It adds no dependency, since `fetch` is in the pinned runtime. It maps onto the existing outcome set without new semantics, and the common conformance suite can run through it unchanged |

## Considered and not approved

| Candidate | Why not |
|---|---|
| OTLP/HTTP log exporter | OpenTelemetry is transport-only under the canonical boundary, and an exporter needs its own event → LogRecord mapping, semantic-convention pins, and endpoint authentication. That is a separate governed change, not an adapter over an existing exchange |
| CloudEvents envelope adapter | CloudEvents is optional envelope-only. Wrapping is a serialization choice for a specific consumer, and none has asked for one |
| Message queue, broker, or outbox adapters | Queues and outboxes are explicitly unauthorized infrastructure (`test:scope` enforces this). Each needs its own authorization |
| gRPC or raw socket adapters | No peer speaks them, and they would add a dependency or a new trust boundary for no consumer |

## Conditions on A1

- Origin is scheme, host, and optional port only; redirects are never followed; responses are read to a bound.
- It classifies nothing. `createHttpDeliveryHandoff` keeps every conformance decision.
- It passes the common per-class conformance suite, plus adapter-specific timeout, refusal, malformed-body,
  oversized-body, redirect, and origin arms.
- Only `src/fetch-exchange.ts` may reach `fetch` and `AbortSignal`; the scope gate enforces it.

## Adding an adapter

A new adapter needs a new entry here, recorded by a governed change with its own assessment, and must
pass the same common conformance suite. Conformance proves mapped observable behaviour. It does not
prove a peer's durability or security is equal to another's.
