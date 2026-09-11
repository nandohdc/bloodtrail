# @bloodtrail/security-audit-collector

Bounded, **non-production** collector ingress for Bloodtrail security audit events.

> **AUTHORIZATION BOUNDARY (issue #343, owner decision 2026-09-06):** this package
> exists under strict scope — synthetic/isolated development and CI environments only,
> synthetic non-sensitive adversarial fixtures only, a non-production authentication
> interface with mock/synthetic credential verification, and no production
> deployment, production collection, real-user data processing, or infrastructure.
> Production authorization: **none**.
>
> **Storage (issue #115):** optional persistence through SQLite (`node:sqlite`) was
> added under the owner's 2026-09-10 instruction; the backend selection was
> delegated to Claude and is not a human owner decision. It is equally
> non-production: synthetic data only, no deployment, and no retention policy
> for real evidence.

## Overview

The ingress enforces the fixed stage order, each stage failing closed:

```
authenticate → size → parse → schema → version → deduplicate → [persist] → accept
```

- **authenticate** — the configured `Authenticator` verifies the submission before
  any body byte is read, sized, or parsed. Missing, malformed, and invalid
  authentication are rejected before the parse stage runs. Authentication
  **identifies a sender**; it does not prove evidence truth, trust, or integrity.
- **size** — the raw body must not exceed `event_max_bytes` (65536), derived from
  the frozen contract bounds block, never configured locally.
- **parse** — JSON deserialization only; all semantic and structural judgment
  belongs to the generated validator and the version stage.
- **schema** — structural validation runs the **exact generated validator** the
  SDK core produces (`schema-validator.generated.cjs`), carried as a
  byte-identical vendored copy with a drift gate, so producer and collector
  cannot disagree about what is valid.
- **version** — the explicitly enumerated finite supported set
  `["2.1.0"]` per the ratified asymmetric version policy (#75/#76). An
  unsupported version is rejected distinctly from a schema rejection.
- **deduplicate** — after every existing validation stage, each collector
  instance retains at most 32 authenticated-sender/validated-event pairs for
  five minutes. A byte-identical retry is a distinct `duplicate` outcome and
  is not admitted again; different bytes under a live pair are rejected as a
  conflict. Full live capacity rejects rather than evicting a live pair.
- **persist** — runs only when storage is configured (see below), and then
  replaces the in-memory deduplicate stage: the storage port decides duplicate
  identity durably on the record's scope and event identity. The occurrence is
  acknowledged `persisted` only after the port confirms the write; a port
  `duplicate` is the distinct duplicate outcome acknowledged `persisted`; any
  other port outcome rejects with a distinct `storage` diagnostic (#478).
- **accept** — without storage, acceptance is **admission only**: the
  occurrence enters `admitted` with its event identity. No durability,
  delivery, retry, or downstream claim is made (delivery conformance
  contract, #102).

Rejection diagnostics are bounded triples `{ code, category, path }` from a
closed vocabulary; counters are plain increments keyed by stable labels.
No diagnostic or metric carries payload content, credentials, or secrets, and
no failure emits an audit event.

Duplicate recognition without storage is an in-memory, instance-local
synthetic control. It uses lazy expiry (no timer), is not durable or shared
between collectors, and makes **no exactly-once, delivery, retry, storage, or
production-retention claim**. With storage configured it is not consulted at
all: the storage port's durable identity decision replaces it, so its
32-record capacity does not bound persisted throughput (#478).

## Storage

Storage implements the ratified `collector-storage-semantics` capability (#114)
through a three-operation port, `put` / `get` / `deleteExpired`, each returning a
closed result union and never throwing across the port. `SqliteStorage` is the
single selected backend.

| Port result | Collector outcome |
|---|---|
| `written` | `persisted` |
| `duplicate` | `duplicate`, acknowledged `persisted` |
| `failed` (`backend`) | rejected — `COLLECTOR_STORAGE_WRITE_FAILED` |
| `failed` (`conflict`) | rejected — `COLLECTOR_STORAGE_CONFLICT` |
| `indeterminate`, a throw, or an unrecognised result | rejected — `COLLECTOR_STORAGE_WRITE_INDETERMINATE` |

- **Owners.** Construction throws `StorageConfigurationError` unless the data
  owner, the retention and deletion authority, and the key owner are all named.
  Naming them is an owner act; the collector only refuses to run without them.
- **Retention** derives from the record's own `data.retention_class` through
  fixed candidate durations no deployment can change (`operational_short` 30
  days, `security_standard` 365, `security_elevated` 7 × 365).
  `policy_governed` is declined with `COLLECTOR_RETENTION_CLASS_DECLINED`. These
  are non-production values, not a legal retention policy.
- **Tenancy.** A record's scope is its own `tenant.scope` plus, for `tenant` and
  `cross_tenant`, its `effective_tenant_id`; a record whose scope cannot be
  resolved is declined with `COLLECTOR_STORAGE_SCOPE_UNRESOLVED`. Every port
  operation takes exactly one scope, and a read without one returns nothing.
- **Deletion** removes whole records. The table is `WITHOUT ROWID`, so no
  secondary index holds a copy of any column, and `secure_delete` overwrites
  deleted content in the database file.
- **Encryption at rest** is the volume's: the database file must live on an
  encrypted volume whose keys the key owner holds. The collector holds, derives,
  and receives no key material, and cannot verify that the volume is encrypted.

What this does **not** establish: production durability, backup, key
management, legal retention compliance, or deletion from media below the file
system (journal blocks, SSD wear levelling). Volume encryption under a
separate key owner is what bounds that residue.

```ts
import { CollectorIngress, SqliteStorage, SyntheticFixtureAuthenticator } from "@bloodtrail/security-audit-collector";

const storage = new SqliteStorage({ location: "/encrypted-volume/collector.db" });
const ingress = new CollectorIngress({
  authenticator: new SyntheticFixtureAuthenticator(["fixture-token-a"]),
  storage: {
    port: storage,
    owners: { dataOwner: "…", retentionAuthority: "…", keyOwner: "…" },
  },
});
```

## Package boundaries

- Standalone workspace: own `package.json` and `package-lock.json` (ADR 0009 topology).
- Private, unlicensed (`private: true`, `license: "UNLICENSED"`), unpublished.
- **Zero runtime dependencies** — the vendored generated validator is the only
  non-authored runtime artifact and is byte-drift-gated against the canonical
  generated artifact. The one built-in import, `node:sqlite`, is confined to
  `src/sqlite-storage.ts` by both the scope and the dependency gates.
- Engines: Node `>=24 <25 || >=26 <27`.
- `packages/security-audit-sdk-core`, the frozen contract, and `research/` are
  never modified by this package.

## Usage

```ts
import {
  CollectorIngress,
  SyntheticFixtureAuthenticator,
} from "@bloodtrail/security-audit-collector";

// NON-PRODUCTION: synthetic fixture credentials only.
const ingress = new CollectorIngress({
  authenticator: new SyntheticFixtureAuthenticator(["fixture-token-a"]),
});

const result = ingress.submit({
  credentials: { credential: "fixture-token-a" },
  body: JSON.stringify(canonicalEvent),
});

if (result.kind === "admitted" || result.kind === "persisted") {
  console.log(result.kind, result.eventId, "from", result.senderIdentity);
} else if (result.kind === "duplicate") {
  console.log("duplicate", result.eventId, "first acknowledged as", result.acknowledgment);
} else {
  console.log("rejected", result.diagnostic.code);
}

const counters = ingress.metrics();
```

## Verification

```sh
npm run validate              # check:generated → typecheck → build → runtime → scope → dependencies → package
npm run test:scope            # one approved runtime coupling (node:sqlite, backend only); fail-closed mutations
npm run check:generated       # bounds regeneration check + validator byte-identity drift gate
```
