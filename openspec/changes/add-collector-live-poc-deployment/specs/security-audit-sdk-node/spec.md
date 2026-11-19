# Spec Delta

## ADDED Requirements

### Requirement: The live PoC may deliver through the frozen delivery primitives

Exactly one business application MAY use the Node binding in production, packed from the commit recorded on the change's tracking issue, to deliver the three live PoC authentication events to the collector server. It SHALL deliver them only by composing the frozen delivery handoff, fetch exchange, bounded retry, bounded backpressure and shutdown primitives. The HTTP audit sink SHALL stay non-production, and no export or behaviour SHALL change.

#### Scenario: Only the delivery primitives are authorized
- **WHEN** the business application's use of the Node binding is inspected
- **THEN** it composes `createHttpDeliveryHandoff`, `createFetchHttpExchange`, `createBoundedDeliveryRetry`, `createBoundedDeliveryBackpressure` and `createDeliveryShutdown`, and does not use `createHttpAuditSink`

#### Scenario: The audit sink stays non-production
- **WHEN** `createHttpAuditSink` is considered for the live PoC or any other production use
- **THEN** it remains authorized for non-production evaluation only

#### Scenario: The frozen surface is unchanged
- **WHEN** the Node binding's export check runs after this change
- **THEN** it reports the same value and type-only exports as before, and no delivery behaviour differs

#### Scenario: The authorization binds one commit and one destination
- **WHEN** the business application uses a Node binding packed from an unrecorded commit, or delivers to any destination other than the collector server
- **THEN** that use is unauthorized
