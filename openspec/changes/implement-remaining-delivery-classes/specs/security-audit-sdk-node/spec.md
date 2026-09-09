## ADDED Requirements

### Requirement: A delivery class binding accepts only occurrences its catalog entry declares

A delivery class binding SHALL be bound to exactly one governed delivery class, and SHALL accept an
occurrence only when that occurrence's catalog entry declares the same class.

An occurrence declaring a different class SHALL be refused with a distinct outcome, and an occurrence
whose event name is absent from the catalog SHALL be refused with a different distinct outcome. A
refusal SHALL occur before the occurrence reaches any delivery attempt.

Binding SHALL be by exact match rather than by a strength ordering. The contract fixes no ordering
over the classes, and substitution is unsafe in both directions: a stronger occurrence delivered
through a weaker binding tolerates loss its catalog entry says is intolerable, and a weaker
occurrence delivered through a stronger binding gives an event whose posture is `fail_open` the
ability to block a business commit.

#### Scenario: A foreign class is refused
- **WHEN** an occurrence whose catalog entry declares one class is offered to a binding bound to a
  different class
- **THEN** it is refused as a class mismatch and no delivery attempt is made

#### Scenario: An uncatalogued event name is refused distinctly
- **WHEN** an occurrence carries an event name absent from the catalog
- **THEN** it is refused with an outcome distinct from a class mismatch

#### Scenario: An occurrence of the bound class is accepted
- **WHEN** an occurrence whose catalog entry declares the binding's own class is offered
- **THEN** it is accepted and delivered under that class's semantics

### Requirement: Every class binding states the guarantees it provides and never claims exactly-once

A delivery class binding SHALL expose the guarantees it provides, comprising at least its bound
class, its delivery semantic, whether it claims at-least-once, and whether it fails closed before a
business commit.

The stated semantic SHALL be `at_most_once` exactly when the class's frozen row states at-most-once,
and `at_least_once` otherwise. No binding SHALL state, or make reachable, a semantic of
`exactly_once`.

#### Scenario: Stated semantic matches the frozen row
- **WHEN** a binding's guarantees are read
- **THEN** its semantic corresponds to the semantic in its own `delivery_class_contracts` row

#### Scenario: Exactly-once is unreachable
- **WHEN** any binding's guarantees are examined
- **THEN** no value states or implies exactly-once delivery

### Requirement: Best-effort delivery loses occurrences visibly and never claims to have delivered them

A `best_effort` binding SHALL make exactly one attempt per occurrence and SHALL NOT schedule a retry.

An occurrence that is not acknowledged SHALL be dropped, SHALL increment a loss counter, and SHALL be
reported with a status distinct from delivery. The loss counter SHALL be **bounded**: it SHALL
saturate at a declared ceiling rather than growing without limit or wrapping, and reaching the
ceiling SHALL itself be observable, signalled once rather than on every subsequent drop.

The ceiling SHALL be readable from the binding and SHALL be configurable within a bounded range, so
that saturation is a behaviour a test can reach rather than a claim asserted about a value no test
can drive to. A ceiling that is not a bounded positive integer SHALL fail at construction.

A `best_effort` binding SHALL declare that it does not provide the `security_significant`
guarantees. Its shutdown SHALL return without delay, and SHALL emit a health signal carrying the
loss count and whether the ceiling was reached, in which the claim of delivery is structurally
absent.

#### Scenario: A dropped occurrence is counted and never reported as delivered
- **WHEN** a `best_effort` occurrence is not acknowledged
- **THEN** it is reported as dropped, the loss counter increases, and no result reports it delivered

#### Scenario: No retry is ever scheduled
- **WHEN** consecutive `best_effort` occurrences are not acknowledged
- **THEN** each made exactly one attempt at ordinal zero

#### Scenario: The loss counter is bounded
- **WHEN** drops continue past the configured loss ceiling
- **THEN** the counter saturates at the ceiling rather than wrapping or growing, and reaching the
  ceiling is signalled exactly once

#### Scenario: An unbounded ceiling is refused
- **WHEN** a binding is constructed with a loss ceiling that is not a bounded positive integer
- **THEN** construction fails, and omitting the ceiling uses the declared default

#### Scenario: Shutdown is immediate and claims nothing
- **WHEN** a `best_effort` binding is shut down after a loss
- **THEN** it returns without delay with a health signal that reports the loss and claims no delivery

### Requirement: Transaction-critical delivery orders durability after the business commit and fails closed before it

A `transaction_critical` binding SHALL perform, in this fixed order: prove audit durability is
reachable, then run the caller's business commit gate, then reach the durability point.

When audit durability is not reachable, the binding SHALL fail closed and the business commit gate
SHALL NOT be invoked. When the business commit gate declines, the occurrence SHALL NOT reach the
durability point. Only after a successful business commit SHALL the occurrence be made durable.

Each failure SHALL carry a distinct outcome and SHALL record whether the commit gate was invoked and
whether the durability point was reached, so that the ordering is observable rather than asserted.

#### Scenario: Unreachable audit durability stops the business commit
- **WHEN** audit durability cannot be reached
- **THEN** the binding fails closed, the commit gate is never invoked, and no delivery attempt is made

#### Scenario: A declined business commit leaves the record non-durable
- **WHEN** the business commit gate declines
- **THEN** the binding fails closed, records that the commit gate ran, and the occurrence never
  reaches the durability point

#### Scenario: Durability follows a successful commit
- **WHEN** the business commit gate commits and the durability point acknowledges
- **THEN** the occurrence is reported committed and durable

#### Scenario: A failure at the durability point is distinguishable
- **WHEN** the business commit succeeds and the durability point does not acknowledge
- **THEN** the binding fails closed, recording that both the commit gate ran and durability was
  attempted

### Requirement: Transaction-critical deduplication is keyed on event identity and transaction identity together

A `transaction_critical` binding SHALL require a non-empty transaction identifier and SHALL refuse an
occurrence without one, before any durability probe or commit gate runs.

The binding SHALL deduplicate on the event identifier and the transaction identifier **together**. A
repeat of the same pair SHALL be reported as already delivered without reaching the durability point.
The same event identifier under a different transaction identifier SHALL NOT be treated as a
duplicate.

Only a delivery that reached durability SHALL be recorded for deduplication; an occurrence that
failed closed SHALL remain deliverable on a later attempt.

A pair that is already in flight SHALL be **refused** with a distinct outcome rather than reported as
already delivered, because the first attempt has not finished and claiming delivery would be a
premature success. The duplicate check and the reservation that follows it SHALL be decided in one
step with no interleaving point between them, so that a concurrently reachable duplicate is
impossible rather than merely unlikely. A reservation SHALL be released whether the attempt succeeds
or fails.

#### Scenario: A missing transaction identifier is refused
- **WHEN** an occurrence is offered without a transaction identifier
- **THEN** it is refused and neither the durability probe nor the commit gate runs

#### Scenario: The same pair is deduplicated
- **WHEN** the same event identifier and transaction identifier are delivered twice
- **THEN** the second is reported as already delivered and reaches no durability point

#### Scenario: A new transaction is not a duplicate
- **WHEN** the same event identifier is delivered under a different transaction identifier
- **THEN** it is delivered rather than deduplicated

#### Scenario: A failed delivery stays retryable
- **WHEN** a delivery fails closed and the same pair is offered again
- **THEN** it is attempted again rather than reported as a duplicate, the reservation having been
  released

#### Scenario: A concurrently reachable duplicate is refused, not claimed delivered
- **WHEN** the same pair is offered again while the first attempt is still in flight
- **THEN** the second is refused with an outcome distinct from already-delivered, and only one
  occurrence reaches the durability point

### Requirement: Policy-critical delivery is blocked without a recorded policy-owner decision

A `policy_critical` binding SHALL NOT be constructible without a policy-owner decision record naming
the exact approved behaviour — `fail_open`, `fail_closed`, or `deferred_completion` — together with
the policy owner and a reference to where the review is recorded.

An absent record, an unrecognised behaviour, an unattributed owner, or an absent review reference
SHALL each cause construction to fail deterministically. There SHALL be no default behaviour, and no
configuration SHALL make an unreviewed policy-critical binding reachable.

A constructed binding SHALL expose the recorded decision, and that record SHALL NOT be mutable after
construction. Applying the approved behaviour to a failed delivery SHALL never report the occurrence
as delivered.

#### Scenario: Construction without a policy record fails
- **WHEN** a `policy_critical` binding is constructed with no policy-owner decision record
- **THEN** construction fails deterministically and no binding exists

#### Scenario: An unapproved behaviour is rejected
- **WHEN** the record names a behaviour other than the three the contract enumerates
- **THEN** construction fails deterministically

#### Scenario: An unattributed or unreferenced approval is rejected
- **WHEN** the record names no policy owner, or no review reference
- **THEN** construction fails deterministically

#### Scenario: The recorded decision is immutable and never claims delivery
- **WHEN** a delivery fails and the approved behaviour is applied
- **THEN** the result names the behaviour, reports no delivery, and the recorded decision cannot be
  edited

### Requirement: Class conformance is asserted against the frozen rows rather than a restatement of them

The conformance suite SHALL read `delivery_class_contracts` from the authored contract source at test
time rather than restating the rows, so that an edit to a row breaks the suite instead of leaving it
silently divergent.

The suite SHALL exercise the same assertions across every implemented class rather than duplicating a
per-class copy, and SHALL run each class against an occurrence drawn from the contract's own positive
example set for that class.

`security_significant` SHALL participate as an already-satisfied control, so that a suite asserting
nothing beyond what the vertical slice proved is distinguishable from one that adds coverage.

#### Scenario: A row edit breaks the suite
- **WHEN** a `delivery_class_contracts` row no longer matches the implemented behaviour
- **THEN** the conformance suite fails rather than passing against a restated expectation

#### Scenario: Each class is exercised against its own catalog occurrence
- **WHEN** a class arm runs
- **THEN** its occurrence is the contract example whose catalog entry declares that class

### Requirement: Implementing the remaining classes introduces no delivery substrate

Implementing the remaining delivery classes SHALL introduce no transactional outbox, queue, or
storage engine. The durability boundary SHALL remain an injected port whose selection is a separate
governed change carrying its own authorization.

The production scope gate SHALL continue to reject `transport`, `collector`, `queue`, `outbox`, and
`storage` as filename, import, and export tokens after this change.

#### Scenario: No substrate is added
- **WHEN** the package source is inspected after this change
- **THEN** no outbox, queue, or storage implementation is present and durability is reached only
  through an injected boundary

#### Scenario: The scope gate is unchanged
- **WHEN** the production scope gate runs after this change
- **THEN** it still rejects the forbidden production integration tokens
