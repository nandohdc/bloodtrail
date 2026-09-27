# ADR 0013: Delivery attempts never enter the canonical event

- Status: Accepted
- Date: 2026-09-27
- Decision owners: Project owner
- Decision source: the owner's approval of the OpenSpec change `separate-delivery-attempts-from-re-executions`,
  given as an approval comment naming the change and the exact head commit, and the owner's own merge of it

## Context

The Node binding's delivery handoff wrote its delivery attempt number into the occurrence's
`correlation.retry_attempt` before sending, and the bounded delivery retry passed each attempt number
through it (#577). The delivery-conformance, Node binding and collector capabilities all required that
behaviour, and the collector excluded the field from its deduplication key so that rewritten copies still
read as duplicates (#391).

`correlation.retry_attempt` is also the contract's re-execution counter, and one field cannot hold both
counts. A re-execution emitted with retry attempt `2` was sent with `0` and still validated, so the
corruption was silent. A delivery retry of a first execution was sent with retry attempt `1` and no
`original_event_id`, which the SDK's own validator rejects as `BAD_CAUSALITY`.

The frozen 2.1.0 contract is not unanimous about which count the field holds.

- For re-execution only:
  - the event contract retries "the same immutable event";
  - ADR-003 keeps the event ID stable on redelivery;
  - the contract design says "Retransmitting identical event bytes keeps the event ID";
  - the authority matrix validates correlation fields for "retry stability";
  - the contract validator requires `original_event_id` whenever the retry attempt is above zero.
- For delivery as well:
  - the archived contract design describes `retry_attempt` as "Which delivery/execution attempt is this?";
  - the "Queue retry redelivers a message" scenario says "message and retry metadata identify the delivery
    attempt".

## Decision

`correlation.retry_attempt` counts re-executions only, and a delivery attempt never enters the canonical
event:

- Every delivery attempt of one occurrence sends the occurrence exactly as supplied, so all its copies are
  byte-identical.
- The delivery attempt tracking stays with the sender. In the Node binding, that means the request
  descriptor and handoff result (ordinal), the bounded retry's attempt count, and its callbacks. A future transport may
  carry the ordinal as its own metadata, but never inside the event.
- The collector decides duplicates over the whole submission. A copy that differs from a live identity in
  any field, a different retry attempt included, is a conflict.

The "Queue retry" scenario's "retry metadata" is read as transport metadata outside the event. The archived
design row is prose that the contract's own validator contradicts, so it does not override the rule.

## Alternatives

- **An optional delivery-attempt field in the contract (2.2.0).** Rejected. It moves every contract version
  pin, needs CB-018's version conflict settled, and is blocked at release. Copies would still differ byte for
  byte, so the collector would keep excluding a field.
- **`retry_attempt` as a delivery-only counter (3.0.0).** Rejected. The compatibility policy classes semantic
  reuse as major, and the change would remove the re-execution count that the SDK's named API and causality
  validation depend on.
- **The delivery attempt in an HTTP header.** Rejected. It adds a wire contract no consumer needs, and the
  platform-neutral conformance capability cannot name a transport mechanism.

## Consequences

- A kit that pairs a Node binding from before this change with a collector from after it sees delivery
  retries rejected as conflicts. The two packages ship together.
- A collector store written before this change keys its records without `correlation.retry_attempt`. Such
  stores are synthetic and non-production, so they are discarded rather than migrated.
- The frozen contract text keeps its ambiguity. Resolving it belongs to the CB-018 reconciliation, and this
  ADR records the reading every capability now follows.
