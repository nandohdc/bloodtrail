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

**Commit claim**:
A transaction-critical delivery result's statement that the caller's business commit gate confirmed the
commit. Three results make one, each only for the commit state it names: `committed_and_durable` for
`committed`, `partially_committed_and_durable` for `partially_committed`, and `compensated_and_durable` for
`compensated`. It is never evidence that the business change committed; the occurrence's own commit state is.
_Avoid_: commit evidence, commit proof

**Reconciling commit gate**:
A business commit gate that answers for one transaction and confirms a business change that already committed
instead of committing it again. With one, a redelivery after a failure following the commit makes the audit record
durable without a second business commit.
_Avoid_: idempotent gate, retry-safe gate

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

**Exchange**:
The code that sends a delivery handoff's request description to a peer and reports what happened as one exchange outcome.
_Avoid_: transport, request, call, delivery

**Exchange outcome**:
What an exchange reports for one attempt. It is exactly one of a response (a status plus the acknowledgments read from the body), a timeout, or a transport failure. Only the exchange decides which condition becomes which outcome.
_Avoid_: result, error, response

**Response classification**:
The single mapping from an exchange outcome to a classification code, shared by the HTTP audit sink and the delivery handoff. It never sees a native transport condition.
_Avoid_: status mapping, error mapping

## Evaluation

**Evaluation kit**:
The non-production bundle that evaluators install outside the repository: the packed packages, the example
service, its driver and the example receiver, the evaluator documents, and the kit identity.
_Avoid_: release, distribution, package

**Kit gate**:
The non-production verifier that builds or checks an evaluation kit and fails closed when a required kit
condition does not hold.
_Avoid_: kit test, evaluator test

**Verification summary**:
The kit gate's result statement, which identifies only the checks that ran and what each verified.
_Avoid_: success line, pass message

**Planted-defect control**:
A disposable verification control that introduces one measured defect and proves the named kit-gate check fails
closed at its identity.
_Avoid_: mutation test, negative test

**Distributable kit**:
An evaluation kit built from its clean identity commit for distribution as both an unpacked directory and a
single archive.
_Avoid_: release, published package

**Verification kit**:
A non-distributable evaluation kit that the kit gate builds from the checked tree solely to verify it.
_Avoid_: distributable kit, evaluator kit

**Kit identity**:
The format 3 record that binds a built kit's build commit, distributability and integrity values, including the
identity file in the checksum list and the separately recorded kit digest; it identifies a kit and authorizes no
release.
_Avoid_: version, signature, manifest

**Kit digest**:
The SHA-256 of `checksums.sha256`, kept outside that checksum list and written in `kit-digest.sha256` in the
`shasum -c` format.
_Avoid_: archive digest, signature

**Archive digest**:
The SHA-256 of a distributable kit's archive, recorded outside that archive because an archive cannot contain
its own digest.
_Avoid_: kit digest, signature

**Kit destination**:
The directory a kit build writes the unpacked kit into. A distributable kit's archive is written beside it, in its
parent.
_Avoid_: output directory, dest

**Evaluator**:
A person whom an owner-approved amendment names, and who uses the evaluation kit with synthetic data in
non-production services they own.
_Avoid_: user, customer, tester

**Own service**:
An evaluator's existing service, outside the kit directory, to which they add both SDK packages from the kit's
tarballs and the kit's core pin.
_Avoid_: consumer, consumer manifest, host application

**Evaluation facilitator**:
The person who distributes the evaluation kit, publishes its kit digest and archive digest, and holds the
facilitator answer key. They do not evaluate.
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
got exactly the bytes the SDK handed to the HTTP audit sink.
_Avoid_: sample event, test event

**Evaluated path**:
The SDK calls, the HTTP audit sink and the example receiver that the evaluation exercises. A frozen export
outside it is still part of the API, but the evaluation says nothing about it.
_Avoid_: supported path, happy path
