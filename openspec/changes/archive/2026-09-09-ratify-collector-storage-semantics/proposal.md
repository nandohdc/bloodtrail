# Proposal — ratify-collector-storage-semantics

Ratify the storage, retention, acknowledgment, durability, and failure semantics the collector will
have to satisfy before any persistence is implemented, as a decision.

## Why

The collector accepts evidence and forgets it. `packages/security-audit-collector/src/ingress.ts`
states this in its own header — acceptance is admission only, "no durability, delivery, retry,
storage, or downstream claim is made" — and the ratified capability carries a matching requirement,
_Acceptance is admission only_. The one piece of state the collector does keep, the deduplication
ledger, is explicitly instance-local, bounded at 32 records, and expires after five minutes.

That is a correct place to stop, and it is also the reason a storage decision cannot be deferred any
further. Every property the pilot (#116) would need to observe is a property of the thing that is not
there yet, and each one has a convenient default that is wrong in the same direction — toward the
collector appearing to have kept something it did not:

- Acknowledging on admission and persisting afterwards turns every crash into silent evidence loss
  that the producer has already been told did not happen.
- Reusing the deduplication ledger as the durability record makes a five-minute bounded cache look
  like an audit store, and makes a capacity eviction indistinguishable from a retention expiry.
- Letting retention be a per-deployment configuration value means the same event is deletable in one
  environment and not in another, with no record of which is correct.
- Treating a partial write as a failed write is safe; treating it as a successful one is not — and
  which of those a backend does is a property of the backend, not of the collector.
- Deleting an expired field in place mutates the bytes any future integrity scheme would have been
  computed over, so a retention policy written without that in mind forecloses one written with it.

The last one is why #114 names it explicitly. Cryptographic audit-log chaining is unauthorized by
`.hermes.md` and by source plan §D.9 and §J, and this change does not design it. But retention and
integrity are not independent: a scheme that hashes whole records is invalidated by any field-level
expiry, so the decision has to record now that a future integrity computation is over a
**retention-stable projection**, or the retention policy chosen today quietly rules that future out.

This change is a **decision only**. It implements no storage, selects no backend product, adds no
package, and lifts no boundary. `storage` remains a forbidden filename, import, and export token in
`check-scope.mjs`, and it stays forbidden after this change merges.

`decision_source = "delegated to Claude by the owner, 2026-09-09; not a human owner decision"`. It is
a delegated technical decision, not a human owner sign-off, and it is not exact-commit owner
authorization for any implementation. #115 and #116 remain blocked.

## What Changes

Adds one capability, `collector-storage-semantics`, recording:

- **Acknowledgment is never ahead of durability.** The collector may return exactly one of two
  acknowledgment kinds: `admitted`, which is today's admission-only result and makes no durability
  claim, or `persisted`, which may only be returned after the storage port has confirmed the write.
  There is no third kind, and no configuration makes `persisted` reachable without that confirmation.
- **A storage port, not a storage product.** The decision fixes a narrow port — `put`, `get`,
  `deleteExpired` — with a total, closed result union, and states that selecting a backend is a
  separate governed change requiring its own authorization. Convenience of an available backend is
  not an input to that selection.
- **Retention is a property of the record, not of the deployment.** Retention derives from the
  event's own `data.retention_class`, which the frozen contract already carries and the producer
  already sets. A deployment may not shorten or lengthen it; it may only decline to store at all.
- **Deletion is whole-record and irreversible.** Expiry removes the record, never a field inside it.
  Field-level redaction inside a retained record is explicitly not the model, precisely so that a
  future integrity computation over a retention-stable projection stays possible.
- **Every write failure has one deterministic collector outcome**, including the two the issue
  requires: a write that fails outright, and a partial outage where the port neither confirms nor
  denies. Both resolve to a rejection with a distinct diagnostic; neither is ever acknowledged as
  `persisted`, and an indeterminate write is treated as not persisted while remaining safe to retry
  because the port is required to be idempotent on the event identity.
- **Tenancy is enforced at read, not only at write.** A retrieval that cannot name a tenant scope
  returns nothing rather than everything; cross-tenant retrieval has no expressible form in the port.
- **Named owners.** Data owner, retention/deletion authority, and key owner are each recorded as a
  role that a deployment must fill before storage may be enabled, and the decision states that
  filling them is an owner act this delegated decision cannot perform.
- **Encryption is required at rest and the key is never the collector's.** The port never sees key
  material, and a backend that cannot separate key ownership from data ownership is disqualified.
- **Migration and recovery boundaries.** A record written under one contract version is readable
  under another only if its schema version is in the supported set; recovery restores records, never
  acknowledgments, because an acknowledgment already delivered cannot be un-delivered.
- **Cryptographic audit-log chaining is not designed here and remains unauthorized**, stated in the
  capability's own text alongside the retention-stable-projection constraint that keeps it possible.
- **What the decision does not establish**: that any future deployment meets a durability,
  confidentiality, or deletion goal. A port and a set of semantics bound what the collector may
  claim; they prove nothing about a backend nobody has selected.

## Capabilities

- `collector-storage-semantics`: the ratified storage abstraction, durability target, encryption and
  key ownership, retention and deletion, tenancy, indexing, failure behaviour, acknowledgment
  ordering, migration and recovery boundaries, named owner roles, decision provenance, assurance
  limitation, and revisit conditions for collector persistence.

## Impact

- Affected code: none. This change adds
  `openspec/specs/collector-storage-semantics/spec.md` by fold and its own change directory. It
  touches no package, no contract artifact, and no workflow.
- `packages/security-audit-collector/` is unchanged. `check-scope.mjs` still rejects `storage` as a
  filename, import, and export token, and this change does not ask it to stop.
- Closing #114 authorizes no implementation. #115 (storage adapter) stays blocked on owner
  authorization and a backend selection; #116 (non-production pilot) stays blocked on both #115 and
  a written owner authorization naming environment, versions, data classification, duration, owners,
  and stop and rollback criteria.
- Out of scope: implementing a storage backend, selecting a product, claiming production durability,
  and designing cryptographic audit-log chaining, hash chains, or tamper-evident log linking.
