## Why

The collector now admits authenticated, bounded, structurally valid events, but it has no idempotency boundary: a retry can run admission twice and a reused event identity can silently describe conflicting content. #108 follows #107 by making duplicate handling deterministic at the collector boundary without implying durable storage or exactly-once delivery.

## What Changes

- Add a bounded, non-production in-memory duplicate ledger after authentication, size, parsing, schema, and version validation but before admission.
- Derive duplicate identity exclusively from the authenticated sender identity and canonical `event.id`; return a distinct duplicate result for byte-identical retries, reject conflicting reuse of that identity, and reserve the identity before admission so re-entrant submissions cannot both be admitted.
- Set a fixed five-minute, lazy-expiry window and 32-record maximum for the synthetic ledger. A new identity when every record is live fails closed with a bounded diagnostic; no timer, queue, durable store, payload-derived metric, external integration, or cryptographic dependency is introduced.
- Extend collector counters with closed, non-secret duplicate/conflict/capacity outcomes and add deterministic first-seen, duplicate, conflict, re-entrancy, expiry, capacity, ordering, and non-disclosure tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-collector`: specify collector-local duplicate identity, bounded in-memory record lifetime, deterministic duplicate/conflict outcomes, validation-before-deduplication ordering, and the continued exclusion of durable storage and exactly-once claims.

## Impact

- `packages/security-audit-collector/src/**` and its runtime tests gain the bounded ledger and public duplicate outcome.
- `openspec/specs/security-audit-collector/spec.md` gains the collector idempotency requirements; the frozen contract, SDK packages, delivery contract, CI topology, and production infrastructure remain untouched.
- The change remains restricted to synthetic/isolated development and CI environments. The five-minute ledger lifetime is a local non-production resource bound, not a data-retention duration, storage policy, or authorization for real-user processing.

## Authorization boundary

The current owner away-window instruction authorizes implementation, PR creation, and administrative merge only after exact-head CI has no failures. #107 is closed and its archive merge is on `main`, satisfying #108's stated dependency. This change authorizes neither production collection nor a production data-retention decision: its fixed five-minute, 32-record ledger is an instance-local synthetic test/CI bound, and it makes no durability, delivery, or exactly-once claim.
