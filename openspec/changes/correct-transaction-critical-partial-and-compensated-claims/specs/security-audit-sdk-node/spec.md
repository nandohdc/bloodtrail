# Spec Delta

## MODIFIED Requirements

### Requirement: Transaction-critical delivery orders durability after the business commit and fails closed before it

A `transaction_critical` binding SHALL perform, in this fixed order: prove audit durability is
reachable, then run the caller's business commit gate, then reach the durability point. An
occurrence whose commit state is `not_committed` has no business commit to gate, and skips only the
commit gate, as stated below.

When audit durability is not reachable, the binding SHALL fail closed and the business commit gate
SHALL NOT be invoked. When the business commit gate declines, the occurrence SHALL NOT reach the
durability point. Except for an occurrence whose commit state is `not_committed`, only after a
successful business commit SHALL the occurrence be made durable.

The binding SHALL continue past the durability probe only when the probe returns exactly `true`, and
past the commit gate only when the gate returns exactly `committed`. Any other probe value, or a
probe that rejects, SHALL be treated as unreachable audit durability. Any commit gate value other
than `committed` or `declined`, or a gate that rejects, SHALL fail closed with an outcome distinct
from a declined commit, SHALL record that the commit gate ran, and SHALL NOT let the occurrence reach
the durability point. A durability handoff that rejects SHALL be treated as not acknowledged. The
binding SHALL return a result rather than reject in each of these cases.

An occurrence whose commit state is `not_committed` SHALL be delivered without a commit claim. The
binding SHALL prove audit durability is reachable and then reach the durability point, SHALL NOT
invoke the business commit gate, and SHALL report a durable outcome distinct from committed and
durable.

An occurrence whose commit state is `partially_committed` or `compensated` SHALL invoke the business
commit gate, SHALL require a successful business commit before reaching the durability point, and
upon acknowledged durability SHALL report a qualified durable outcome (`partially_committed_and_durable`
or `compensated_and_durable`, respectively) truthful to the occurrence's commit state, rather than
claiming a full business commit.

Each failure SHALL carry a distinct outcome and SHALL record whether the commit gate was invoked and
whether the durability point was reached, so that the ordering is observable rather than asserted. A
failure at the durability point after the commit gate ran SHALL carry an outcome distinct from
unreachable audit durability. The binding's declaration that it fails closed before the business
commit SHALL cover only failures before the commit gate runs.

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

#### Scenario: An out-of-type probe result fails closed
- **WHEN** the durability probe returns any value other than exactly `true`
- **THEN** the binding fails closed as unreachable audit durability, the commit gate is never invoked,
  and no delivery attempt is made

#### Scenario: An out-of-type commit gate result fails closed
- **WHEN** the business commit gate returns any value other than `committed` or `declined`
- **THEN** the binding fails closed with an outcome distinct from a declined commit, records that the
  commit gate ran, and the occurrence never reaches the durability point

#### Scenario: An uncommitted occurrence is delivered without a commit claim
- **WHEN** an occurrence whose commit state is `not_committed` is delivered and the durability point
  acknowledges
- **THEN** the commit gate is never invoked, and the binding reports the occurrence durable without
  claiming a business commit

#### Scenario: A partially committed occurrence reports qualified durability
- **WHEN** an occurrence whose commit state is `partially_committed` is delivered, the business commit gate commits, and the durability point acknowledges
- **THEN** the binding reports the occurrence as partially committed and durable, distinct from committed and durable

#### Scenario: A compensated occurrence reports qualified durability
- **WHEN** an occurrence whose commit state is `compensated` is delivered, the business commit gate commits, and the durability point acknowledges
- **THEN** the binding reports the occurrence as compensated and durable, distinct from committed and durable

#### Scenario: A failure after the commit is distinguishable from one before it
- **WHEN** the business commit gate commits and the durability point does not acknowledge
- **THEN** the binding fails closed with an outcome distinct from unreachable audit durability

#### Scenario: A rejected probe, gate or handoff fails closed
- **WHEN** the durability probe, the business commit gate or the durability handoff rejects instead of
  returning a value
- **THEN** the binding returns the same failed-closed outcome it returns for a value it cannot
  confirm, rather than rejecting

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

Deduplication SHALL hold within one binding instance only. The binding SHALL NOT claim that another
binding instance, or a restarted process, recognises a pair it delivered; persistent deduplication
across instances is the host's.

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

#### Scenario: Deduplication does not span binding instances
- **WHEN** the same pair is delivered once through each of two binding instances
- **THEN** each instance reaches the durability point, and neither reports the pair as already
  delivered

#### Scenario: Qualified durable deliveries are deduplicated
- **WHEN** a partially committed or compensated delivery succeeds and the same pair is offered again
- **THEN** the second is reported as already delivered and reaches no durability point
