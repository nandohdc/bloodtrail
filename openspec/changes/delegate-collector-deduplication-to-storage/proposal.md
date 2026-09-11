## Why

The #116 non-production pilot's first run (#478) persisted **32** of 600 synthetic events. The other
identities were refused 1,254 times with `COLLECTOR_DEDUPLICATION_CAPACITY` until the pilot's
wall-clock stop criterion terminated it. With storage configured, the collector still put its
in-memory deduplication ledger in front of the storage port: 32 live identities for 300 seconds, per
instance. That cap was right for a synthetic admission-only control. In front of a durable store it
is simply a throughput ceiling.

The storage port already decides the same question with stronger authority. `collector-storage-semantics`
makes `put` idempotent on `(scope, eventId)`, answering `duplicate` for the same occurrence and a
conflict for different content, durably and across collector instances. The ledger adds nothing but
the cap.

## Authorization

Found while implementing #116 under the owner's 2026-09-10 instruction to implement #96–#132 and to
"create issues and PRs to fix any problems that arise during the implementation". The design choice
below is `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner
decision"`. It is not an exact-commit authorization and authorizes no deployment.

## What Changes

- With storage configured, the persist stage is the deduplicate stage. The collector no longer
  consults or populates the in-memory ledger. A port `written` returns `persisted`, a port
  `duplicate` returns the distinct duplicate outcome acknowledged `persisted`, and a port conflict
  keeps its distinct `COLLECTOR_STORAGE_CONFLICT` diagnostic.
- The reservation-release, persisted-flag, and acknowledgment-lookup plumbing #115 added to the
  ledger is removed. The ledger is again the admission-only control it was ratified as, and exactly
  that when storage is not configured: 32 identities, 300 seconds, capacity rejection.
- With storage, identity is the record's scope and `event.id`, whichever authenticated sender
  submits it. That is the port's identity. Sender isolation, a property of the in-memory ledger,
  applies without storage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-collector`: four requirements are restated so that the in-memory ledger governs
  duplicates only without storage, and the storage port governs them with it. No scenario is dropped;
  two are added.

## Impact

- `packages/security-audit-collector/src/ingress.ts`, `src/deduplication.ts`, `README.md`,
  `compatibility.json`, and `tests/storage.test.ts`.
- `openspec/specs/security-audit-collector/spec.md` through the fold.
- No change to the storage port, the SQLite backend, the contract, or either SDK package.
