## ADDED Requirements

### Requirement: Node binding provides bounded delivery admission backpressure

The Node binding SHALL provide a backpressure module that gates admission to an injected asynchronous delivery operation by an explicit, bounded in-flight capacity, independent of what that operation is. An admission attempted while the current in-flight count is at the configured capacity SHALL be rejected immediately and synchronously with a `rejected_overload` outcome; it SHALL NOT wait, queue the attempt for later admission, or silently drop it. Capacity consumed by an admitted operation SHALL be released exactly once when that operation settles, whether it resolves or rejects, with no drift between admitted and released counts.

#### Scenario: Admission at capacity rejects with a counted overload
- **WHEN** an admission is attempted while the in-flight count equals the configured capacity
- **THEN** the module immediately returns a `rejected_overload` outcome without invoking the wrapped operation, and an observable overload counter increments

#### Scenario: Capacity is released after completion without drift
- **WHEN** an admitted operation settles, whether by resolving or rejecting
- **THEN** the in-flight count decreases by exactly one and a subsequent admission up to the configured capacity succeeds

#### Scenario: Concurrent admission never exceeds capacity
- **WHEN** more admissions than the configured capacity are attempted with none yet settled
- **THEN** exactly the configured capacity of admissions proceed to invoke the wrapped operation and every admission beyond that is rejected with `rejected_overload`

#### Scenario: Admitted work is never silently dropped
- **WHEN** an operation is admitted
- **THEN** the module always awaits and reports that operation's own settlement and never abandons or discards it before it settles

#### Scenario: Observability exposes counters without event content
- **WHEN** an admission or rejection is observed through the module's optional observability hooks
- **THEN** the hook receives only numeric depth and capacity values and never the admitted occurrence or any operation result content
