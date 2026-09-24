# ADR-NODE-004: The HTTP audit sink, and one response classification shared with the delivery handoff

- Status: Accepted for SDK-node implementation
- Date: 2026-09-23
- Decision source: the owner's approval of the OpenSpec change `add-sdk-node-http-audit-sink`, given as a
  SHA-bound approval comment on PR #610 and the owner's own merge of it (`520aa69`)

## Context

The SDK MVP evaluation alpha (#575) needs events to leave the process over HTTP. Nothing implemented the
core's sink interface over HTTP, and neither existing piece fits on its own:

- `createHttpDeliveryHandoff` classifies HTTP outcomes, but its request projection rewrites
  `correlation.retry_attempt` (#577). It cannot send the validated event byte for byte.
- `createFetchHttpExchange` (ADR-NODE-003) reaches the network, but classifies nothing.

ADR-NODE-003 says every classification stays with `createHttpDeliveryHandoff`. A sink needs the same
classification, so it must either copy the rules or share them.

## Decision

**The widening.** Add one value export, `createHttpAuditSink`, and one type-only export,
`HttpAuditSinkOptions`. The frozen lists in `check-exports.mjs` move from 18/42 to 19/43, and
`compatibility.json` records the widening as a new `freezeRecord.amendments` entry, after the entries for
#112 and #113. The factory returns the core's own `AuditEventSink`, so no sink type is restated. Nothing is
removed, renamed or retyped.

#590 adds the sink's outcome type under this same ADR. It edits the #589 amendment entry in place rather
than adding another, so the change records one amendment naming all three exports, as its spec requires.

**The sink composes the adapter and is not a second one.** It builds its own request: the validated event,
serialized once with `JSON.stringify` and sent unchanged. It hands that request to `createFetchHttpExchange`,
which stays the only code that reaches `fetch`. The declared-coupling inventory and the scope gate's rules
are unchanged.

The sink checks its path against the handoff's bounded-path pattern, through one shared constant, and also
rejects a non-string path. It validates header names and values. It also reserves two groups of headers:
those it derives from its body and origin (`content-type`, `content-length` and `host`), and those the
connection owns. `fetch` refuses some of the connection's headers on every send, so a caller who names one
gets an error at construction, not a failure on every emit.

**One classification, shared.** #579 moved the handoff's response rules into
`src/http-response-classification.ts`, an internal module the package does not export. The handoff and
the sink both call it, and the sink adds no rule of its own. In this first version `acknowledged` is
accepted, and every other code is unknown and carries the classifier's code. #590 maps `http_permanent`
to rejected.

This changes the letter of ADR-NODE-003, which says "every classification … stays with
`createHttpDeliveryHandoff`". It keeps that ADR's intent: one classification source, which no second
component can drift from. ADR-NODE-003 now points here.

**The adapter no longer hides acknowledgments.** `createFetchHttpExchange` used to drop every
acknowledgment entry it could not read as accepted. The classifier's exactly-one rule therefore never saw
those entries, so a 2xx that paired the exact acknowledgment with a rejected, null or malformed entry read
as acknowledged. That happened through the sink, and through the handoff over this adapter since #113.

The adapter now treats the whole list as unreadable when any entry is not an accepted acknowledgment. The
classifier then judges the peer's real answer, and nothing it sends becomes acceptance except the exact
acknowledgment. `src/fetch-exchange.ts` joined the change's `owned_paths` under the umbrella's D1 amendment
rule, and its header comment now names the shared classifier.

**Scope.** Non-production evaluation only. The sink makes one attempt per event, with no retry, batching,
queueing, backpressure or ordering, and it claims no delivery-class conformance. #591 adds `flush` and
shutdown draining.

The change's assessment rejected two alternatives:

- *Building the sink on the handoff.* Its projection is the #577 defect.
- *A sink-local copy of the rules.* The copies would drift, so a status such as 429 could be a failure in
  one component and a rejection in the other.

## Reversal

Revert these together:

- `index.ts`'s export line;
- the two frozen-list entries and the amendment;
- `src/http-audit-sink.ts` and its test file;
- the exported path pattern in `src/http-handoff.ts`;
- the three scope-mutation pins.

The shared classifier can stay. Without the sink, the handoff is again its only caller, as it was after
#579. The adapter's acknowledgment fix should stay too: it corrects the handoff as well, and does not
depend on the sink.
