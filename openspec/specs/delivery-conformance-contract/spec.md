# delivery-conformance-contract Specification

## Purpose

The platform-neutral observable delivery semantics every conforming delivery implementation must satisfy, derived exclusively from the frozen contract's `delivery_class_contracts` and its existing delivery-class statements in the `security-audit-event-contract` capability.

## Requirements

### Requirement: Delivery conformance derives exclusively from the frozen delivery class contract

Every normative statement of the delivery conformance contract SHALL derive each delivery class's semantic, durability, idempotency, retry, backpressure, shutdown, outage, and business-failure-posture expectations exclusively from `delivery_class_contracts` in the frozen canonical contract source. The conformance contract SHALL NOT redefine, extend, or weaken any frozen row, and SHALL use the contract's exact controlled vocabulary for delivery class names (`best_effort`, `security_significant`, `transaction_critical`, `policy_critical`) and business-failure postures (`fail_open`, `fail_closed`, `blocked_pending_qualified_review`).

#### Scenario: Conformance statement traces to a frozen row
- **WHEN** a conformance claim is evaluated against a delivery class
- **THEN** every dimension of the claim must trace to the corresponding `delivery_class_contracts` row without redefining its wording or semantics

### Requirement: Delivery states are finite and every transition is externally observable

A conforming delivery implementation SHALL model each accepted occurrence in exactly the following delivery states: `admitted` (the producer boundary accepts the occurrence; capacity consumed; attempt identity assigned), `attempting` (an attempt is in flight; attempt counter incremented), `acknowledged` (terminal success; the peer's well-formed acceptance is recorded), `retryable` (a retryable response, timeout, or transport failure; attempt counter and next-delay bound observable), `non_retryable` (terminal failure with a permanent rejection classification), `protocol_error` (terminal failure on a malformed or ambiguous acknowledgment, classified distinctly from `non_retryable`), `exhausted` (terminal failure after the retry budget is spent), `rejected_overload` (terminal rejection at capacity, counted, never silent), and `abandoned` (terminal, counted, and never reported delivered after the shutdown deadline expires with outstanding work).

Every state transition SHALL have a deterministic externally observable outcome recorded through at least one of: the attempt counter, capacity accounting, an acknowledgment record, a failure classification, an exhaustion alert, or a loss counter. A state with no observable outcome SHALL NOT be part of the model.

#### Scenario: State transition is never silent
- **WHEN** an admitted occurrence moves between delivery states
- **THEN** exactly one of the defined observable outcomes records the transition and no transition leaves the occurrence's disposition unobservable

### Requirement: Attempt identity is stable and retry attempts are zero-based

Every attempt of the same occurrence SHALL carry the identical `event.id`, SHALL NOT be assigned a new event identity, and SHALL advance a zero-based attempt count expressed through `correlation.retry_attempt`. Duplicate identity SHALL remain source plus id, so a consumer deduplicates copies of one occurrence idempotently while distinct occurrences remain distinguishable.

#### Scenario: Retry preserves event identity
- **WHEN** a conforming implementation retries an occurrence after a retryable failure
- **THEN** every copy carries the identical `event.id` with an incremented zero-based `correlation.retry_attempt` and consumers deduplicate the copies without discarding distinct occurrences

### Requirement: Acknowledgment is well-formed acceptance only

A conforming delivery implementation SHALL treat an occurrence as `acknowledged` only when the downstream peer returns a well-formed acceptance for that occurrence. A malformed, ambiguous, or unparseable response SHALL be classified as a terminal `protocol_error` failure, distinct from `non_retryable`, and SHALL never be recorded as delivered.

#### Scenario: Malformed acknowledgment is never acceptance
- **WHEN** the downstream peer returns a malformed or ambiguous acknowledgment for an attempt
- **THEN** the occurrence terminates in `protocol_error`, is never reported delivered, and the classification is distinct from a permanent `non_retryable` rejection

### Requirement: Validation rejection precedes admission and is terminal

An occurrence that fails validation SHALL be rejected before admission, before any attempt is made, and before any capacity is consumed. The rejection SHALL be terminal and non-retryable, SHALL carry a bounded machine-readable validation error code, and SHALL NOT be retried.

#### Scenario: Validation rejection is terminal and never retried
- **WHEN** an occurrence fails validation at the producer boundary
- **THEN** the occurrence is rejected with a bounded machine-readable validation error code, is never admitted, and no retry attempt is made

### Requirement: Retry is bounded, jittered, and exhausted with an alert

Retryable failures — a retryable response, an attempt timeout, or a transport failure — SHALL be retried only within a bounded retry budget. `security_significant` retry SHALL apply jitter and SHALL raise a retry-exhaustion alert when the budget is spent; the occurrence then terminates in `exhausted`. An attempt timeout SHALL be classified `retryable`, SHALL never be reported delivered, and SHALL never consume unbounded time.

#### Scenario: Retry exhaustion alerts before terminating
- **WHEN** a `security_significant` occurrence spends its bounded retry budget with jittered attempts
- **THEN** the implementation raises the retry-exhaustion alert and the occurrence terminates in `exhausted`

#### Scenario: Attempt timeout is retryable and never reported delivered
- **WHEN** an attempt times out before any well-formed acknowledgment
- **THEN** the occurrence becomes `retryable` within its remaining budget and the timed-out attempt is never reported delivered

### Requirement: Capacity is bounded and overflow is counted, never silent

A conforming delivery implementation SHALL bound its buffered capacity explicitly. An occurrence admitted while the implementation is at capacity SHALL terminate in `rejected_overload`, be counted through a bounded counter and health signal, and SHALL never be dropped silently. A `security_significant` implementation SHALL alert before silent loss.

#### Scenario: Admission at capacity rejects with a counted overload
- **WHEN** an occurrence arrives while the delivery implementation is at capacity
- **THEN** the occurrence terminates in `rejected_overload` with the overload counter and health signal incremented and no silent drop occurs

### Requirement: Shutdown has a deadline with bounded flush or durable handoff

Shutdown SHALL follow the frozen row for the occurrence's class and SHALL NOT cause unbounded delay. A `security_significant` implementation SHALL perform a bounded flush or durable handoff at shutdown. When the shutdown deadline expires with outstanding work, the affected occurrences SHALL terminate in `abandoned`, be counted, and SHALL never be reported delivered.

#### Scenario: Shutdown deadline expires with outstanding work
- **WHEN** shutdown begins with buffered non-best-effort occurrences and the bounded flush or durable handoff does not complete before the shutdown deadline
- **THEN** the outstanding occurrences terminate in `abandoned`, are counted, and are never reported delivered

### Requirement: Downstream failure and outage are classified and accounted

A downstream failure SHALL be classified as `retryable` or `non_retryable` before any response is acted on. During an outage, a `security_significant` implementation SHALL perform delay accounting and raise an operator alert, and a `best_effort` implementation SHALL record a loss estimate in its health signal. No outage outcome SHALL falsely assert that a missing occurrence was delivered.

#### Scenario: Downstream outage is accounted and alerted
- **WHEN** a required delivery path is unavailable during `security_significant` delivery
- **THEN** the implementation performs delay accounting and raises the operator alert without asserting delivery of any missing occurrence

### Requirement: Delivery guarantees are at-most-once or at-least-once per class, never exactly-once

Delivery guarantee statements SHALL follow the frozen rows: `best_effort` accepts at-most-once with bounded loss reporting and SHALL NOT claim durable delivery; `security_significant` provides at-least-once after the required producer boundary accepts the occurrence, with the same event id on retry and consumer deduplication; `transaction_critical` makes audit durability atomic with the successful business commit, provides downstream at-least-once, deduplicates by event id and transaction id, retries persistently after commit, and fails closed before the business commit when audit durability cannot be reached; `policy_critical` provides at least security-significant durability under a reviewed policy.

No conformance claim, requirement, or scenario of this capability SHALL assert exactly-once delivery for any class. Consumer deduplication SHALL be described as an idempotency mechanism, never as exactly-once delivery.

#### Scenario: Best-effort occurrence is lost with bounded reporting
- **WHEN** a `best_effort` occurrence cannot be delivered
- **THEN** the implementation follows the frozen drop or bounded-buffer behavior and records a loss estimate in its health signal without claiming durable delivery

#### Scenario: Security-significant occurrence is delivered at least once
- **WHEN** the required producer boundary accepts a `security_significant` occurrence
- **THEN** the implementation keeps delivering it with the same event id until acknowledgment or a classified terminal outcome, and consumers deduplicate copies

#### Scenario: Transaction-critical durability is atomic with business commit
- **WHEN** business state and its `transaction_critical` audit record must commit together
- **THEN** the durability boundary prevents a successful business commit from being reported without the durable event record, and downstream delivery proceeds at least once from that record

#### Scenario: Exactly-once is never claimed
- **WHEN** any conformance claim, requirement, or scenario is read for any delivery class
- **THEN** no exactly-once delivery guarantee is asserted and deduplication is stated only as an idempotency mechanism

### Requirement: Policy-critical delivery requires a reviewed policy before production

A `policy_critical` occurrence SHALL be subject to the frozen blocked-pending posture: production SHALL remain blocked until a reviewed policy exists that approves the exact fail-open, fail-closed, or deferred-completion behavior. The absence of that reviewed policy SHALL itself be a conformance failure, and retries SHALL use the same event id with policy-specific reconciliation.

#### Scenario: Policy-critical production without a reviewed policy fails conformance
- **WHEN** a `policy_critical` delivery path is evaluated without a policy-owner-approved fail-open, fail-closed, or deferred-completion policy
- **THEN** the evaluation records `blocked_pending_qualified_review` and production remains blocked until the reviewed policy exists

### Requirement: The semantic contract is platform-neutral with no transport runtime dependencies

The delivery conformance contract SHALL specify observable semantics only. It SHALL NOT require, name, or depend on any transport, queue, outbox, collector, or storage runtime mechanism, and SHALL NOT authorize creating one. A conformance claim SHALL be verifiable from observable outcomes alone and SHALL identify the producer boundary at which the claimed implementation accepts occurrences; transport-specific adapters remain separately authorized outside this capability.

#### Scenario: Conformance claim is verifiable without a transport runtime
- **WHEN** an implementation claims conformance for a delivery class
- **THEN** the claim names its producer boundary and is verifiable from observable outcomes without reference to any transport-specific runtime dependency

### Requirement: Ordering scope is per-occurrence only

The delivery conformance contract SHALL make no ordering guarantee across distinct occurrences and SHALL NOT require an implementation to preserve cross-occurrence arrival order. Within one occurrence, attempts SHALL be sequential and SHALL NOT overlap, ordered by zero-based `correlation.retry_attempt`.

#### Scenario: Cross-occurrence ordering is not a conformance requirement
- **WHEN** two distinct occurrences are admitted by a conforming implementation
- **THEN** conformance places no relative-order requirement on their delivery while each occurrence's own attempts remain sequential and non-overlapping

### Requirement: Attacker-controlled pressure cannot create ambiguous acceptance, unbounded resource use, or fail-open validation

Validation SHALL run before admission so an attacker-controlled payload can never reach the delivery path through a validation defect, and a rejected payload SHALL never become `admitted`. Attempt counts, retry budgets, jittered delays, buffered capacity, and overload counters SHALL be bounded so retry pressure cannot cause unbounded resource use. Acceptance SHALL result only from a well-formed acknowledgment, so retry pressure or malformed traffic SHALL NOT create ambiguous acceptance.

#### Scenario: Malformed flood fails closed at the validation boundary
- **WHEN** a flood of attacker-controlled malformed occurrences reaches the producer boundary
- **THEN** each is rejected before admission with a bounded validation error, no capacity is consumed, and no occurrence is admitted through a validation defect

#### Scenario: Retry pressure stays within bounds
- **WHEN** repeated retryable failures or malformed responses pressure a conforming implementation
- **THEN** attempt counts, delays, capacity, and counters remain within their declared bounds and only a well-formed acknowledgment produces acceptance

### Requirement: Compatibility and observability requirements are recorded

Every attempt SHALL carry the producer's single bound canonical contract version, per the exact-one package support policy, and SHALL NOT span multiple contract versions. The conformance contract SHALL require separate safe operational signals for validation failure, enqueue failure, buffer exhaustion, retry exhaustion, delivery delay, and collector or ingestion outage, none of which SHALL falsely assert delivery or create a recursive audit-event failure loop. A conformance claim SHALL name the delivery conformance contract version it was evaluated against.

#### Scenario: Attempt carries the producer's single bound contract version
- **WHEN** a conforming implementation emits an attempt
- **THEN** the attempt carries the producer's single bound canonical contract version and no attempt spans multiple contract versions

#### Scenario: Outage signal never claims delivery
- **WHEN** a delivery failure produces an operational signal
- **THEN** the signal records the class-specific outcome without asserting that the missing occurrence was delivered and without emitting a recursive audit-event failure
