## Context

`admit` in `examples/evaluation-receiver.ts` already distinguishes duplicates and conflict. Collector `src/ingress.ts` returns `COLLECTOR_DEDUPLICATION_CAPACITY` and conflict in the same `deduplication` category. Collector `src/deduplication.ts` checks existing identities before the 32-record bound and retains them for 300_000 ms without storage. Only the example's translation is incorrect; those collector files remain read-only.

## Design Pattern Assessment

Schema 1.1, full assessment, direct implementation and `security_sensitive: false`. The canonical capability requirement is a full-assessment trigger even though this fixed response naming does not alter security policy. All 15 security dimensions are justified individually. The proposal baseline is `6ee6f57037466ac80fd0b9b181f6e881cde62520`; planning must precede runtime edits. Assessment records technical rationale, not approval.

### Architectural forces

1. Name bounded capacity backpressure without permanently discarding later-admissible evidence.
2. Distinguish capacity from conflict while preserving unknown diagnostic fallback and frozen surfaces.
3. Prove the real installed receiver boundary without exhausting other probes or changing the cap.

## Delegated decisions and alternatives

Decision source: owner decision, 2026-10-14, via overnight planning in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

The R1–R10 table in proposal.md contains delegated Claude recommendations subject to owner override, not personal owner approval. Direct implementation at the existing seam is selected; no new abstraction, ADR or glossary term is needed.

- R1/R2: `429` with a fixed capacity reason identifies bounded backpressure. `503` is plausible and retryable, but names general service unavailability rather than the specific exhausted deduplication capacity. A permanent 4xx is inappropriate: the SDK would classify it as `http_permanent` / `SDK_SINK_REJECTED`, dropping evidence that could become admissible when the window expires. No automatic retry is added.
- R3: match the diagnostic code, as conflict already does. Category matching cannot distinguish conflict from capacity because both are `deduplication`; mapping that category to 429 would mislabel conflict or future unknown refusals. Preserve the category map and `?? 500` / `ingress_rejected` fallback for unknown codes/categories.
- R4/R5/R7: do not send `Retry-After` or change ledger admission/retention. The SDK does not read that header and an in-window retry encounters the same full ledger. The documentation describes existing `http_retryable` / `SDK_SINK_FAILURE` classification, not a new retry capability.
- R8: spawn a separate installed receiver with no previous probe traffic. Reusing the careful-ingress receiver would depend on its prior identity count and could starve routing/abort probes. Changing the collector cap/clock to ease testing would test a different boundary. Keep fresh random UUIDs on valid synthetic events, loopback networking and child cleanup in finally, including readiness failures.

## Implementation

Add a narrow diagnostic-code branch returning `reject(state, 429, "deduplication_capacity")`. Retain counters, duplicate acknowledgment, conflict, request/auth/body/route behavior and unknown fallback. No new public export.

In the installed-kit exchange, use an existing demonstrated valid event as template, with fresh random event IDs. On the dedicated receiver assert 32 exact 200 acknowledgments, then distinct events 33 and 34 return the exact fixed JSON body and no Retry-After. Assert health HTTP 200/healthy, acceptedCount 32 and rejectedCount 2; resend the exact first admitted bytes and assert its single accepted acknowledgment and duplicateCount 1 without increasing admissions. Print an observation marker only after these assertions pass.

Extend the existing module-scope string-anchored receiver plant definitions once. Replacing the new capacity return with `500` / `ingress_rejected` must fail specifically at `loopback-example-exchange` with `deduplication capacity: expected 429, got 500`. Keep source-change measurements, disposable-kit resealing and the disabled-check fail-closed harness. Extend the gate success clause and matching control assertion; preserve existing gate identities.

## Implementation-specific invariants

| Invariant | Tasks | Evidence plan (not yet observed) |
| --- | --- | --- |
| implementation-named-capacity | 2.1, 3.1, 5.1 | Dedicated installed-kit probe: 32 × 200, 33–34 × exact 429/body/no-header, health and duplicate counts |
| implementation-sensitive-control | 3.2, 5.1 | Measured capacity-to-500 plant fails at loopback-example-exchange with the capacity-specific condition |
| implementation-preserved-scope | 1.2, 4.1, 5.1, 5.2 | Strict OpenSpec, assessment/final governance, generated/export/scope/git/product and CodeScene gates; existing controls |

## Security implications

Only a fixed response reason/status changes. Authentication, authorization, privacy validation, sender authority, admission, retention, durability, concurrency and shared retry classification remain unchanged. The cap remains fail-closed. No caller input appears in the error body. The fresh receiver and negative kit copy are disposable synthetic loopback processes, not production integrations.

## Verification plan

Run assessment governance and strict OpenSpec before the planning-only commit. After the runtime, regression and wire documentation commits, execute the supplied exact tamandua-test wrapper covering Node/collector/contract validation, generated drift, changed-paths, strict OpenSpec, final governance, empty-index Git, make test and CodeScene CLI 1.0.53 delta. Also run the supplied build chain and git diff --check. Record actual gate names, exit statuses and stdout in tasks.md and invariant evidence before the fifth commit. Never tick merge/fold/archive or claim checks executed after the evidence commit.
