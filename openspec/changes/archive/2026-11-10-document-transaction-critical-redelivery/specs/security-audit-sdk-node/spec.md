## MODIFIED Requirements

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

#### Scenario: A redelivery after a failure following the commit runs the commit gate again
- **WHEN** a delivery fails closed after the commit gate ran, because the durability point did not
  acknowledge or because the commit gate's result could not be confirmed, and the same pair is offered
  again
- **THEN** the durability probe runs again and, once it confirms that audit durability is reachable, so
  does the commit gate, before the durability point; the binding does not skip the commit gate because
  an earlier attempt ran it

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
