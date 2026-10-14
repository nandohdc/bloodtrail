## ADDED Requirements

### Requirement: The example receiver names a deduplication capacity refusal

The example receiver SHALL recognize `DIAGNOSTIC_CODES.DEDUPLICATION_CAPACITY` (`COLLECTOR_DEDUPLICATION_CAPACITY`) by diagnostic code and answer `429` with exactly `{"error":"deduplication_capacity"}` and no `Retry-After` header, preserving conflict `409`, duplicate acknowledgment and unknown-ingress fallback `500` / `ingress_rejected`.

#### Scenario: The 33rd distinct identity within the window is refused by name

- **WHEN** a fresh no-storage example receiver acknowledges 32 distinct valid synthetic event identities within its 300 s window and receives a 33rd distinct valid event
- **THEN** it answers `429` with exactly `{"error":"deduplication_capacity"}` and no `Retry-After`
- **AND** a 34th distinct valid event receives the same answer
- **AND** GET /health still answers `200` and `healthy` with 32 admissions and two rejections

#### Scenario: A duplicate is still acknowledged at capacity

- **WHEN** the receiver's no-storage ledger is full and a byte-identical copy of an admitted event is submitted
- **THEN** it answers `200` with exactly one matching `accepted` acknowledgment
- **AND** the duplicate count increases without another admission

#### Scenario: Wire documentation distinguishes capacity from permanent rejection

- **WHEN** an evaluator reads the wire protocol
- **THEN** it documents the unchanged no-storage bound of 32 identities per 300 s and `429` as `http_retryable` / `SDK_SINK_FAILURE`
- **AND** it states the SDK does not read `Retry-After`, retry while the ledger remains full within the window meets the same refusal, and automatic delivery retry is not added
- **AND** the collector and shared HTTP classification remain unchanged

#### Scenario: The installed-kit gate detects a disguised capacity refusal

- **WHEN** the kit gate runs its capacity probe
- **THEN** it uses a separate fresh receiver whose ledger no other probe has used, with fresh random UUIDs on valid synthetic fixtures and loopback only
- **AND** its measured negative control replaces the capacity answer with `500` / `ingress_rejected` in a disposable kit
- **AND** the planted kit fails specifically at `loopback-example-exchange` with a capacity-specific expected-429/got-500 diagnostic
- **AND** the unmodified kit passes and receiver children are cleaned up even on readiness or assertion failure
