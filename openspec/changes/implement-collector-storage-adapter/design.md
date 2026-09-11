# Design — implement-collector-storage-adapter

## Context

`collector-storage-semantics` (#114) fixed every semantic storage needs and named no backend, on the
grounds that a three-operation port is small enough for almost anything to satisfy, so availability
would become the differentiator — and availability is not a security property. This change makes the
selection, and so it has to make it on something else.

The collector's ingress is synchronous: `submit()` returns an `IngressResult`, not a promise. That
matters more than it looks, because the ratified rule is that `persisted` never precedes a confirmed
write. With a synchronous port there is no await gap in which an acknowledgment could be issued ahead
of the write; the ordering is structural rather than disciplined.

## Decision 1 — SQLite through `node:sqlite`

| Property the semantics require | How SQLite supplies it |
|---|---|
| `persisted` only after a confirmed write | `DatabaseSync.run()` returns after the implicit transaction commits; `journal_mode = DELETE` and `synchronous = FULL` make a commit durable per SQLite's contract |
| idempotent on (scope, identity) | `PRIMARY KEY (scope_kind, scope_tenant, event_id)` with `ON CONFLICT DO NOTHING` — a schema constraint, not application code |
| no operation spans tenant scopes | scope is two columns of the key; each of the three prepared statements binds exactly one scope |
| no index outlives a record | `WITHOUT ROWID` makes the primary key the table, so there is no secondary structure copying any column |
| deletion is irreversible | `secure_delete = ON` overwrites deleted content in the file; a rollback journal (not WAL) keeps no frames of it after commit |
| failure outcomes are distinguishable | SQLite guarantees BUSY, LOCKED, READONLY, FULL and CONSTRAINT had no effect → `failed`; everything else → `indeterminate` |
| keys separable from data | the database is a file; encryption is the volume's, under a key owner the collector never sees |

And one property of the selection rather than the semantics: the engine ships inside the pinned
Node runtime, so the collector keeps zero npm runtime dependencies and no third-party code enters the
trust boundary. That is a supply-chain property, not a convenience one — the package's own gates
already treat every runtime import as attack surface.

### Rejected

- **A file per record over `node:fs`.** Durable atomic writes need temp-file, fsync, rename, and
  directory fsync, each a place to get it wrong; idempotency becomes filename collision; a tenant
  identifier becomes a path component with traversal to defend; expiry needs a full scan.
- **A networked database through an npm driver.** Adds a runtime dependency and a network peer with
  credentials, which the collector would then have to hold — a credential boundary the non-production
  candidate has no business owning.
- **SQLite with application-level encryption** (SQLCipher-style). The collector would hold the key,
  which is exactly what the ratified disqualification rule forbids.
- **An in-memory map.** Not durable, so `persisted` would be a lie.

### What it costs

`node:sqlite` is experimental on Node 24 and prints a warning there; both CI legs exercise it. The
volume-encryption requirement is an assumption the collector cannot check. Both are recorded in the
README and in the proposal's assurance limitations.

## Decision 2 — the persist stage and the ledger

Persistence runs after deduplication and before acceptance, only when storage is configured.

- `written` or `duplicate` → `persisted`, and the ledger entry is marked persisted.
- `failed`, `indeterminate`, a throw, or an unrecognised result → reject, and **release** the
  ledger reservation. Without the release, a producer's retry inside the five-minute window would be
  answered `duplicate` for evidence that was never stored — the exact false durability claim the
  semantics exist to prevent.
- A live duplicate carries `acknowledgment`: what its first-seen occurrence was acknowledged with.
  A duplicate of an admitted-only occurrence says `admitted`; it never claims `persisted`.

A second collector instance has no ledger entry, so the port decides: the same occurrence (the same
canonical deduplication key, which excludes `correlation.retry_attempt`) is `duplicate`; different
content under the same identity is `failed` with reason `conflict`, reported as its own diagnostic.
The comparison is exact on the stored key, never a hash — the same choice the ledger made.

## Decision 3 — retention and scope

The contract defines four retention classes and no durations. The semantics say retention derives
from the class and never from the deployment, so the durations have to live in code:
`operational_short` 30 days, `security_standard` 365 days, `security_elevated` 7 × 365 days. They are
non-production candidate values, not a legal retention policy, and changing one is a governed
decision. `policy_governed` is declined outright — its retention is set by a policy outside the record,
which the collector cannot evaluate, and the ratified rule prefers an explicit refusal to a guessed
duration.

Scope is `tenant.scope`, plus `effective_tenant_id` for `tenant` and `cross_tenant`. A `tenant`-scoped
record without an effective tenant identifier has no scope a read could name, so it is declined before
the port is reached rather than filed under an empty tenant.

## Decision 4 — owners

`new CollectorIngress({ storage: { port, owners } })` throws `StorageConfigurationError` unless all
three roles are non-blank, bounded strings. That is the SDK's precedent: configuration fails at
construction, everything after it returns results. The collector does not record or publish the
names; it only refuses to run without them. Filling them for any real deployment remains an owner act.

## Provenance and reversal

`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`. To
reverse: revert the implementation commit. The port and ingress fall back to admission-only, and the
scope gate's two-file allowance and the dependency gate's one approved import disappear with it.
