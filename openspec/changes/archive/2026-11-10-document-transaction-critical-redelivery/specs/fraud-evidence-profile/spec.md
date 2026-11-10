## ADDED Requirements

### Requirement: Host redelivery after a failure following the commit

A host that offers a pair again after transaction-critical delivery reported `audit_durability_failed_after_commit`
or `business_commit_unconfirmed` SHALL use a reconciling commit gate built for that transaction identifier,
returning `committed` only for a business change it confirms committed and never committing it twice. The host
SHALL bound redeliveries of one pair and SHALL alert while a committed change's record is not durable. Crash
recovery needs the host's own durable record (G5).

#### Scenario: Redelivery after a confirmed commit commits nothing again
- **WHEN** the binding reports a durability failure after the commit gate committed, and the host offers the same
  pair again with its reconciling commit gate
- **THEN** the gate confirms the already-committed business change without committing it again, and the record
  reaches durability

#### Scenario: Redelivery after an unknown commit reconciles first
- **WHEN** the binding reports that the commit gate's result could not be confirmed, and the reconciling commit
  gate then establishes whether the business change committed
- **THEN** the gate returns `committed` only for a change it confirms committed, and returns `declined` for a
  change that has not committed and will not be, so that record never reaches durability

#### Scenario: An unknown commit that reconciliation cannot settle stays unconfirmed
- **WHEN** the reconciling commit gate still cannot tell whether the business change committed
- **THEN** it rejects, the binding again reports that the commit could not be confirmed, and the host's
  redelivery bound and alert apply

#### Scenario: Occurrences sharing a transaction commit once
- **WHEN** two occurrences carry the same transaction identifier and each is delivered with the reconciling
  commit gate
- **THEN** the business change commits once, and both records reach durability

#### Scenario: A crash between the commit and durability
- **WHEN** the host process stops after the business commit and before the record is durable
- **THEN** the binding retains nothing to redeliver, so the record can still be relayed only if the host kept it in
  its own durable store
