# Design — ratify-collector-storage-semantics

## Context

The collector as it stands is deliberately amnesic. `packages/security-audit-collector/src/ingress.ts`
runs a fixed stage order — authenticate → size → parse → schema → version → deduplicate → accept —
where every stage fails closed, and its header states the boundary in its own words:

> Acceptance is admission only: the occurrence enters `admitted` with its event identity and the
> sender identity recorded at the authentication boundary; no durability, delivery, retry, storage,
> or downstream claim is made.

The ratified `security-audit-collector` capability carries the matching requirement, _Acceptance is
admission only_, with a scenario asserting an admitted occurrence carries identity only.

The single piece of state the collector keeps is the deduplication ledger, and every property of it
argues against reusing it as a durability record:

| Property | Value in `deduplication.ts` | Why it disqualifies it as storage |
|---|---|---|
| Scope | instance-local | a second collector instance has never seen the record |
| Capacity | `DEDUPLICATION_MAX_RECORDS = 32` | eviction at capacity is a normal outcome (`"capacity"`) |
| Retention | `300_000` ms, lazily purged | five minutes is a retry window, not a retention class |
| Content | `{ body, expiresAt }` keyed by sender and event id | keeps the body only to detect conflicting reuse |

Its own header says it: *"Records are never durable."* A capacity eviction and a retention expiry
would be indistinguishable if this were the store, which is precisely the confusion an audit store
must not have.

So there is no storage, and #114 asks what its semantics must be before there is. The decision below
takes the strict option at each fork, for the same reason as the derived-field ratification: each
lenient option is individually defensible, and all of them fail in the same direction — toward the
collector appearing to have kept something it did not.

## Decision

### 1. Two acknowledgment kinds, and `persisted` follows the write

`admitted` is today's result and claims nothing about durability. `persisted` is new and may only be
returned after the port confirms the write. There is no third kind and no mode that makes `persisted`
reachable without a confirmation.

The alternative — acknowledge on admission, persist afterwards — is the shape almost every ingestion
pipeline reaches for, because it is faster and because the window is small. It is wrong here for a
specific reason rather than a general one: the producer's `security_significant` contract row says
"at-least-once **after required producer boundary accepts the occurrence**", and a producer that has
been told the occurrence was accepted is entitled to stop retrying. Acknowledging ahead of the write
converts a collector crash into evidence loss that the producer has already been told did not happen,
and no amount of producer-side retry can recover it, because the producer is no longer retrying.

Keeping `admitted` as a distinct kind rather than folding it into `persisted` matters too: the
collector is useful today without storage, and a deployment with storage disabled must be unable to
express a durability claim it cannot support.

### 2. A port with three operations, idempotent on event identity

```
put(scope, record)                -> written | duplicate | failed | indeterminate
get(scope, eventId)               -> found | absent | unsupported_version | failed
deleteExpired(scope, now)         -> deleted(count) | failed
```

Three operations, a closed union per operation, no open-ended values, no exceptions across the port.
This is the same shape as the SDK's `AuditResult<T>` boundary and the collector's own `IngressResult`,
and it is chosen for the same reason: an unhandled rejection at a durability boundary is a silent
outcome, and silence is the one thing an audit store may not produce.

`put` is idempotent on `(scope, eventId)`. That single property does most of the work in §5: it is
what makes "treat an indeterminate write as not persisted" safe rather than duplicate-producing.

Selecting the backend is explicitly *not* part of this decision. #114's own out-of-scope section
names "choosing infrastructure by implementation convenience" first, and the reason is visible in the
port: three operations and eleven outcomes is a small enough surface that almost anything satisfies
it, so availability would otherwise be the only differentiator, and availability is not a security
property.

### 3. Retention derives from the record

The frozen contract already carries `data.retention_class` on every event, and the producer already
sets it. Retention derives from that, and a deployment cannot shorten or lengthen it.

The alternative is a deployment-level retention setting, which is how most storage is configured and
which fails a specific way here: the same event would be deletable in one environment and not in
another, with nothing in the record saying which is correct. Since the retention class travels *with*
the evidence, the evidence carries its own answer, and two deployments handed the same record reach
the same one.

A deployment may still decline to store a class entirely. That refusal is a rejection with its own
diagnostic — never a silent shorter retention — because "we kept it for less time than the record
says" and "we did not keep it" are different facts and only one of them is honest.

### 4. Deletion is whole-record, and that is what keeps a future integrity scheme possible

Expiry removes the record. No field is redacted, blanked, or truncated inside a retained record.

This is the non-obvious coupling in #114, and it is why the issue names it as its own acceptance
criterion. Cryptographic audit-log chaining is unauthorized — `.hermes.md` and source plan §D.9 say
"do not design it", and this change does not. But retention and integrity are not independent
choices. A scheme that hashes a whole record is invalidated by any field-level expiry inside it; the
record is still retained, still readable, and now fails its own integrity check for a reason that is
not tampering. A retention policy that permits field-level expiry therefore forecloses whole-record
integrity before anyone has decided whether to want it.

So the capability records the constraint without designing the scheme: should chaining ever be
authorized, its computation is over a **retention-stable projection** — the subset of a record that
retention cannot alter while the record is retained. Whole-record deletion makes that projection the
whole record, which is the simplest case and the one that stays available.

### 5. Every write failure has one outcome, and indeterminate is its own outcome

| Port result | Collector outcome | Acknowledgment |
|---|---|---|
| `written` | accept | `persisted` |
| `duplicate` | accept as already stored | `persisted` |
| `failed` | reject — `storage_write_failed` | none |
| `indeterminate` | reject — `storage_write_indeterminate` | none |

`failed` and `indeterminate` are distinct because they are different facts. A backend that reports a
write failed has told us something; a connection severed after the request was issued has told us
nothing, and the record may or may not exist. Collapsing the second into the first would report an
unknown state as a known one.

Treating indeterminate as **not persisted** is the fail-closed direction: the sender is not told the
evidence is durable when it might not be. The cost of that choice is a possible duplicate write on
retry, and §2's idempotency requirement is what pays it — which is why the two are decided together
rather than separately.

`duplicate` acknowledging `persisted` is deliberate: the record is durable, which is what `persisted`
asserts. Deduplication at ingress and idempotency at the port answer different questions and both
answers are "the evidence is stored once".

### 6. Tenancy is inexpressible across scopes, not merely disallowed

Every record carries the tenant scope it was admitted under, and every read names one. A read with no
scope returns nothing rather than everything — the opposite default from most query interfaces, and
the only safe one for an audit store, where the failure mode of the usual default is cross-tenant
disclosure.

The stronger half is that the port offers no operation whose result can span scopes. A rule that
cross-tenant reads are disallowed can be violated by a caller; a port with no such operation cannot
be. This mirrors how `src/context.ts` makes authority unforgeable by construction rather than by
convention.

### 7. Encryption at rest, with keys the collector never sees

Records are encrypted at rest, and the port never accepts, returns, or logs key material. A backend
that requires the data holder to also hold the keys is disqualified from selection.

This is the one requirement that constrains the backend list before the selection change runs, and
it does so on a property — separability of key custody from data custody — rather than on a product.

### 8. Three named owners, and this decision fills none of them

Storage is not enabled until the **data owner**, the **retention and deletion authority**, and the
**key owner** are each named. They may be different parties. An unnamed role blocks storage rather
than defaulting to whoever runs the collector, because the default would silently make the operator
accountable for a deletion obligation they never accepted.

Naming them is an owner act. This decision is delegated and cannot perform it, and the capability
says so in its own text so that a later reader cannot mistake the decision for the appointment.

### 9. Migration reads by version; recovery restores records, not acknowledgments

A record carries the schema version it was admitted under. A collector whose supported set contains
that version can read it; one whose set does not reports an explicit unsupported-version outcome —
distinguishable from absence, because "we cannot read this" and "this is not here" are different
facts and conflating them would let a version rollback look like evidence loss.

Recovery restores records only. An acknowledgment already returned to a sender cannot be un-returned,
so reissuing or revoking one during recovery would be asserting control over something already gone.

## Rejected alternatives

**Acknowledge on admission, persist asynchronously.** Faster, and the standard shape. Rejected in §1:
it converts a crash into loss the producer has been told did not happen, and the producer's own
contract row entitles it to stop retrying at that point.

**Reuse the deduplication ledger as the durability record.** Zero new surface. Rejected on four
independent grounds in the Context table — instance-local, 32 records, five-minute expiry, and a
capacity outcome indistinguishable from a retention expiry.

**Deployment-configured retention.** Operationally flexible. Rejected in §3: it makes the same record
deletable in one environment and not another, with no record of which is correct, while the frozen
contract already carries a per-record answer.

**Field-level expiry inside retained records.** Finer-grained privacy. Rejected in §4: it forecloses
whole-record integrity before anyone has decided whether to want it, and the issue's own acceptance
criteria require the retention-stable-projection constraint be preserved.

**Select a backend now.** Would make #115 immediately actionable. Rejected in §2 and by #114's
out-of-scope list: with a surface this small, availability becomes the differentiator, and
availability is not a security property. It also needs authorization this delegated decision does not
have.

## What this decision does not establish

It bounds what the collector may claim. It proves nothing about a backend nobody has selected: no
durability, confidentiality, or deletion goal of any future deployment follows from a port and a set
of semantics. A conforming implementation of §2's port can still lose data, and this capability is
not evidence that it will not.

It also does not authorize anything. `decision_source = "delegated to Claude by the owner,
2026-09-09; not a human owner decision"`. `storage` stays forbidden in `check-scope.mjs`; #115 stays
blocked on owner authorization and a backend selection; #116 stays blocked on #115 and on a written
authorization naming environment, versions, data classification, duration, owners, and testable stop
and rollback criteria.

## Revisit conditions

- A backend selection change is proposed — §2's disqualification rule and §7's key-custody
  requirement are the first things it must answer.
- Cryptographic chaining is authorized — §4's retention-stable projection becomes a design input
  rather than a preserved possibility.
- The contract moves past `1.0.0` in a way that changes `data.retention_class` — §3 derives from it.
- A deployment needs a retention shorter than a record's class allows — that is a §3 refusal today,
  and changing it is a decision, not a configuration.
