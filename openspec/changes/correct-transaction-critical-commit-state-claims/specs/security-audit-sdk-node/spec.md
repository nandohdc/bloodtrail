# Spec Delta

## MODIFIED Requirements

### Requirement: Transaction-critical delivery orders durability after the business commit and fails closed before it

A `transaction_critical` binding SHALL perform, in this fixed order: prove audit durability is
reachable, then run the caller's business commit gate, then reach the durability point. An
occurrence whose commit state is `not_committed` has no business commit to gate, and skips only the
commit gate, as stated below.

Before the durability probe runs, the binding SHALL take one snapshot of the occurrence: its JSON
serialization, parsed back and deeply frozen. Every later step SHALL read only that snapshot: the
admission checks, the deduplication key, the occurrence handed to the durability point, and the
result. A change the caller makes to its own object after delivery begins SHALL change neither the
bytes that reach the durability point nor the result. An occurrence that cannot be serialized SHALL
be refused with a distinct outcome, and the durability probe, the commit gate and the durability
point SHALL NOT be reached. A snapshot that is not an occurrence object SHALL be refused as carrying
no catalogued event name, and the binding SHALL return the refusal rather than reject.

Before the durability probe runs, the binding SHALL refuse, with a distinct outcome, an occurrence
whose commit state is absent or is not one of the commit states that the occurrence's own catalog
entry allows. The check SHALL use that event's own catalog entry, not the commit states that any
`transaction_critical` entry allows. A refused occurrence SHALL NOT invoke the durability probe or
the commit gate, SHALL NOT reach the durability point, and SHALL NOT be recorded or reserved for
deduplication.

These refusals, like the transaction identifier refusal, SHALL be decided before the duplicate
check. A repeat of a settled or in-flight pair that one of them refuses SHALL be refused, not
reported as already delivered or as a duplicate. A refusal records neither the commit gate nor the
durability point, because neither has run.

Each commit state a `transaction_critical` catalog entry allows SHALL map to exactly one outcome:
`committed` to committed and durable, `partially_committed` and `compensated` to their qualified
outcomes, and `not_committed` to a durable outcome without a commit claim. No commit state SHALL
reach a commit claim by default.

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

Each failure after admission SHALL carry a distinct outcome and SHALL record whether the commit gate
was invoked and whether the durability point was reached, so that the ordering is observable rather
than asserted. A
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
- **WHEN** an occurrence whose commit state is `committed` is delivered, the business commit gate
  commits, and the durability point acknowledges
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

#### Scenario: A commit state the occurrence's catalog entry does not allow is refused
- **WHEN** an occurrence's commit state is absent, or is `pending`, `unknown`, `not_started`,
  `not_applicable` or any other value its own catalog entry does not allow
- **THEN** it is refused with an outcome distinct from every other refusal, neither the durability
  probe nor the commit gate runs, and the occurrence never reaches the durability point

#### Scenario: A commit state allowed only for another event is refused
- **WHEN** an occurrence carries a commit state that another `transaction_critical` catalog entry
  allows but its own entry does not
- **THEN** it is refused as a commit state its catalog entry does not allow, and the commit gate never
  runs

#### Scenario: A change to the caller's object after admission is not delivered
- **WHEN** the caller changes its occurrence object while the durability probe, the commit gate or the
  durability handoff is running
- **THEN** the bytes that reach the durability point are those of the occurrence as admitted, and the
  result follows the admitted commit state

#### Scenario: An occurrence that cannot be serialized is refused before the commit
- **WHEN** an occurrence cannot be serialized to JSON
- **THEN** it is refused with an outcome distinct from every other refusal, neither the durability
  probe nor the commit gate runs, and the binding returns the refusal rather than rejecting

#### Scenario: A refused occurrence leaves its pair deliverable
- **WHEN** an occurrence is refused at admission and a corrected occurrence with the same event
  identifier and transaction identifier is then offered
- **THEN** the corrected occurrence is delivered rather than reported as already delivered or as a
  duplicate
