# Fraud-Evidence Consumer Context

This context defines the vocabulary for supplying Bloodtrail occurrences to an external fraud engine under the
`fraud-evidence-profile` capability. Bloodtrail emits evidence. The consumer owns detection, scoring and
fraud verdicts. The integration profile, `consumer-integration-profile.md` in this directory, applies these
terms.

## Language

**Fraud-evidence consumer**:
An external fraud engine, downstream of the host, that receives occurrences as evidence for detection,
scoring and fraud verdicts. It is never an own service, which is where an occurrence is emitted.
_Avoid_: own service, collector, detector, Bloodtrail fraud detection

**Presented identifier**:
The login identifier a client submits in an authentication, reset or registration attempt, such as a
username, email address or phone number, whether or not it resolves to an account. It is client-presented
content, never an authoritative identifier.
_Avoid_: username (as the general term), login, account ID

**Honest carrier**:
A contract field that holds a value in the field's own contract meaning, with published trust that matches
where the value came from, without breaking its event's resource rule or revealing whether an account exists.
Contract 2.1.0 has no honest carrier for a failed login's presented identifier.
_Avoid_: accepted carrier, valid field

**Provenance ambiguity**:
A field whose published policy trust disagrees with where its value actually came from, such as a
client-presented value in a field the policy marks as server-authoritative.
_Avoid_: trust mismatch, spoofing

**Post-authentication join identifier**:
A value that is identical on every occurrence of one account's chain from successful authentication onward,
so the consumer can join those occurrences: the internal opaque account identifier, sent directly, and the
session fingerprint.
_Avoid_: correlation ID, user ID, tracking ID

**Session fingerprint**:
A host-computed keyed digest of the server session handle, under one key scope shared by the whole chain,
that stands in for the session identifier. It is never the session's bearer value.
_Avoid_: session token, raw session ID, device fingerprint
