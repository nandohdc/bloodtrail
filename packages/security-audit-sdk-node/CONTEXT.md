# Security Audit SDK Node Binding Context

This context defines how the Node binding delivers audit events. It separates sending one occurrence again
from performing the audited operation again, which the delivery primitives once conflated (#577).

## Occurrences and Re-executions

**Occurrence**:
One audited happening, represented by exactly one canonical event with one `event.id`.
_Avoid_: message, delivery unit

**Re-execution**:
The audited operation performed again. It is a new occurrence with its own `event.id`, linked to the
original by `original_event_id` and counted by its retry attempt.
_Avoid_: retry, redelivery

**Retry attempt**:
The zero-based re-execution count an occurrence carries in `correlation.retry_attempt`. Delivery never
changes it.
_Avoid_: delivery attempt, attempt counter

## Delivery

**Redelivery**:
Sending an already-emitted occurrence again, unchanged, so every copy is byte-identical.
_Avoid_: retry, replay, re-execution

**Delivery retry**:
A redelivery that the bounded delivery retry schedules after a retryable outcome, within its attempt budget.
_Avoid_: retry, re-execution

**Delivery attempt**:
One transmission of an occurrence to a peer, numbered by a zero-based attempt ordinal that is observable to
the sender and never written into the occurrence.
_Avoid_: retry attempt

**Copy**:
One transmitted instance of an occurrence. All copies of one occurrence are byte-identical.
_Avoid_: duplicate, duplicate event
