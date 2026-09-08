## Context

The #107 ingress ends at `version -> accept` and is deliberately synchronous, stateless, and dependency-free. See proposal.md for motivation and the `security-audit-collector` delta for observable behavior. The collector's authored runtime source may import only relative modules and has no approved host coupling, so a cryptographic helper, a database, a queue, a timer, and an external cache are unavailable by design.

## Goals / Non-Goals

**Goals:**

- Give one collector instance deterministic, bounded duplicate behavior after the existing validation stages.
- Preserve exact submission equality and sender isolation without creating key-concatenation ambiguity.
- Make expiry and re-entrancy reproducible through a deterministic clock seam.
- Preserve secret-free diagnostics/metrics and fail closed when bounded ledger capacity is unavailable.

**Non-Goals:**

- Durable evidence storage, cross-process or cross-instance idempotency, queues, background cleanup, delivery behavior, or an exactly-once guarantee.
- A production retention period, cryptographic fingerprinting, body-derived metric labels, or any new runtime dependency or host capability.

## Decisions

### D1 — Use a private nested in-memory ledger, not a serialized composite key

`CollectorIngress` will own a small `DeduplicationLedger` in a new relative-only module. Its shape is `Map<senderIdentity, Map<eventId, Record>>`, with a separate live-record count. Nested maps make sender/event pairing exact even if a future authenticator returns arbitrary strings; concatenating values with a delimiter would admit collision ambiguity. A record stores only the already size-bounded body and its expiry timestamp.

The chosen record body comparison is byte equality. It is collision-free without a forbidden cryptographic import, and a syntactically different body that reuses an identity fails closed rather than being mistaken for an idempotent retry. The alternative of a non-cryptographic hash could silently collide; a crypto hash violates the collector's zero-host-coupling boundary; a durable adapter belongs to #114/#115.

### D2 — Reserve after version validation and before admission

`submit()` will retain its existing authenticate -> size -> parse -> schema -> version sequence, obtain the validated event ID, then ask the ledger to decide. `first` reserves immediately and proceeds to construct the admission; `duplicate` returns a new duplicate result; `conflict` and `capacity` project to distinct bounded rejections. This preserves the existing no-body-before-auth guarantee and ensures a re-entrant call from an injected validator cannot cause two admissions: the nested call reserves first and the outer call observes duplicate.

The alternative of reserving before validation would let invalid input poison identity capacity; reserving after admission leaves a duplicate execution window. An asynchronous lock is unnecessary and would introduce a new lifecycle/concurrency mechanism into a synchronous API.

### D3 — Use fixed lazy expiry and reject saturated live capacity

The ledger uses a 300,000 ms window and a hard 32-record limit. Before every decision it deletes records whose expiry is at or before the current time. It does not allocate timers, so idle collectors retain no scheduled work. When 32 records remain live, a new identity is rejected rather than evicting a live record and weakening duplicate consistency. A `now?: () => number` option defaults to `Date.now`; it is a deterministic test seam, not a user-controlled retention configuration.

The alternative of LRU/FIFO eviction permits a retry inside the declared window to run again. A configurable TTL or capacity broadens the public policy surface without an approved production decision. Eager timer cleanup adds lifecycle behavior and a resource that this package does not otherwise own.

### D4 — Make outcomes and observations closed and non-secret

`IngressResult` gains `DuplicateAdmission` with `kind: "duplicate"`, event ID, and sender identity; it is not an admission. Diagnostics gain one deduplication category and two codes for conflict and capacity. Metrics gain `deduplicated`, `rejectedDuplicateConflict`, and `rejectedDeduplicationCapacity`, all closed numeric counters. The raw body never appears in a result, diagnostic, metric key, metric value, exception, or documentation example.

Returning the ordinary admission result for a duplicate would overstate capacity consumption; reporting duplicate as a rejection would obscure a safe retry outcome. Keeping conflict and capacity distinct makes operators able to distinguish caller inconsistency from bounded local pressure without exposing the identity or body.

## Risks / Trade-offs

- [An in-memory record retains synthetic body bytes for five minutes] -> Bound each body by the existing 65536-byte gate, cap records at 32, keep the package synthetic-only, and make no production retention claim.
- [A caller can retry with semantically equivalent JSON serialized differently] -> Treat it as a conflict rather than guessing canonical semantics; a future canonicalization policy would require a separately governed change.
- [A process restart or another collector instance loses the ledger] -> State this scope explicitly in README, specs, and tests; do not market it as durable or exactly-once.
- [A full ledger rejects a new otherwise-valid event] -> Fail closed with a separate bounded counter/diagnostic rather than silently evicting a live duplicate record.
- [Re-entrancy rather than threads is the relevant runtime race] -> Exercise it through the existing injectable validation seam and assert exactly one admitted result.

## Migration Plan

The collector is private and non-production. Add the result union and counters with their tests, update the package README to name the instance-local limitation, then run the package validation chain and repository gates. Rollback is a normal revert of this package-only change; it requires no data migration because the ledger has no durable state.
