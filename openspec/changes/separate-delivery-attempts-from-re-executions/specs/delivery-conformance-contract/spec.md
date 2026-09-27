## ADDED Requirements

### Requirement: Attempt identity is stable and delivery attempts are zero-based

Every delivery attempt of the same occurrence SHALL carry the identical `event.id`, SHALL NOT be assigned a new event identity, and SHALL transmit the occurrence unchanged, so every copy of one occurrence is byte-identical. A conforming implementation SHALL number the delivery attempts of one occurrence with a zero-based delivery attempt ordinal that advances by one per attempt and is observable through its attempt counter. The ordinal SHALL NOT be written into the canonical event: a delivery implementation SHALL NOT add, remove, or rewrite any field of the occurrence, including `correlation.retry_attempt`, which counts re-executions and which the frozen contract validates for retry stability. A re-execution is a distinct occurrence with its own `event.id`. Duplicate identity SHALL remain source plus id, so a consumer deduplicates copies of one occurrence idempotently while distinct occurrences, including re-executions, remain distinguishable.

#### Scenario: Redelivery preserves the occurrence byte for byte
- **WHEN** a conforming implementation redelivers an occurrence after a retryable failure
- **THEN** every copy carries the identical `event.id` and is byte-identical to the first, the delivery attempt ordinal advances by one per attempt through the implementation's attempt counter, and consumers deduplicate the copies without discarding distinct occurrences

#### Scenario: A re-execution keeps its retry attempt through every delivery attempt
- **WHEN** an occurrence whose `correlation.retry_attempt` is `2` is delivered on attempt `0` and redelivered on attempt `1`
- **THEN** both copies carry `correlation.retry_attempt` `2`, and the delivery attempt ordinals `0` and `1` are observable through the implementation's attempt counter and appear in neither copy

#### Scenario: A delivery retry of a first execution stays valid
- **WHEN** a first execution, with `correlation.retry_attempt` `0` and no `original_event_id`, is redelivered on attempt `1`
- **THEN** the redelivered copy still carries `correlation.retry_attempt` `0` and still satisfies the contract's causality rules

## MODIFIED Requirements

### Requirement: Ordering scope is per-occurrence only

The delivery conformance contract SHALL make no ordering guarantee across distinct occurrences and SHALL NOT require an implementation to preserve cross-occurrence arrival order. Within one occurrence, attempts SHALL be sequential and SHALL NOT overlap, ordered by their zero-based delivery attempt ordinal.

#### Scenario: Cross-occurrence ordering is not a conformance requirement
- **WHEN** two distinct occurrences are admitted by a conforming implementation
- **THEN** conformance places no relative-order requirement on their delivery while each occurrence's own attempts remain sequential and non-overlapping

## REMOVED Requirements

### Requirement: Attempt identity is stable and retry attempts are zero-based

**Reason**: It required every delivery attempt to advance `correlation.retry_attempt`, the contract's re-execution counter. That rewrote the canonical event on every attempt, contradicted the frozen contract's retry of "the same immutable event" and its retry stability for correlation fields, and made a delivery retry of a first execution fail the contract's causality rule (#577).
**Migration**: Replaced by "Attempt identity is stable and delivery attempts are zero-based". Deliver every attempt of one occurrence byte-identically, and keep the delivery attempt ordinal in the implementation's attempt counter, never in the event.
