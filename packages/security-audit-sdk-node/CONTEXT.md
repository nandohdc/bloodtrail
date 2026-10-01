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

## Sinks and Handoffs

**HTTP audit sink**:
The Node binding's implementation of the core's sink interface over HTTP, which the SDK calls once for each
occurrence it emits. It makes one delivery attempt per occurrence, and it is the alpha's only evaluated
delivery.
_Avoid_: transport, exporter, delivery handoff

**Delivery handoff**:
A primitive that turns one occurrence into an HTTP request description and leaves the exchange to code the
caller owns. The SDK never calls it, and it sends nothing itself.
_Avoid_: HTTP audit sink, sender, transport

## Evaluation

**Evaluation kit**:
The non-production bundle that evaluators install outside the repository: the packed packages, the example
service, its driver and the example receiver, the evaluator documents, and the kit identity.
_Avoid_: release, distribution, package

**Kit identity**:
The record a kit carries of the commit it was built from and of the digest of every file in it, which an
evaluator checks the kit against with standard tools.
_Avoid_: version, signature, manifest

**Evaluator**:
A person whom an owner-approved amendment names, and who uses the evaluation kit with synthetic data in
non-production services they own.
_Avoid_: user, customer, tester

**Evaluation facilitator**:
The person who distributes the evaluation kit, publishes its archive digest, and holds the facilitator
answer key. They do not evaluate.
_Avoid_: evaluator, organizer

**Facilitator answer key**:
The expected code, path, diagnosis and fix for each seeded invalid call. Only the evaluation facilitator
holds it, and the evaluation kit never contains it.
_Avoid_: solutions, answers, expected output

**Seeded invalid call**:
A deliberately wrong SDK call in the evaluation's diagnosis exercise, which an evaluator diagnoses from the
error the SDK returns.
_Avoid_: broken example, bug

**Example receiver**:
The kit's in-memory, non-production stand-in for an ingestion endpoint. It checks each submission the way a
careful ingress would, admits only a valid event at the collector ingress, and stores nothing.
_Avoid_: collector, server, backend

**Demonstrated event**:
One of the five events the example service emits, each of which the evaluation proves the example receiver
got exactly as the SDK validated it.
_Avoid_: sample event, test event

**Evaluated path**:
The SDK calls, the HTTP audit sink and the example receiver that the evaluation exercises. A frozen export
outside it is still part of the API, but the evaluation says nothing about it.
_Avoid_: supported path, happy path
