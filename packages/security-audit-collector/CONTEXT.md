# Security Audit Collector Context

This context defines how the synthetic, non-production collector ingress decides what it has already seen.
The delivery vocabulary it relies on, occurrence, copy and redelivery, is defined by the Node binding's
context.

## Language

**Identity**:
What the collector keys an occurrence on: the authenticated sender and the `event.id`, or, with storage
configured, the record's storage scope and the `event.id`.
_Avoid_: occurrence key, fingerprint

**Duplicate**:
The collector's outcome for a copy whose content is canonically identical to the occurrence it already
holds under a live identity. It is acknowledged and never admitted twice.
_Avoid_: duplicate event, retry

**Conflict**:
The collector's rejection of a submission that reuses a live identity with any different content, a
different retry attempt included.
_Avoid_: duplicate, retry
