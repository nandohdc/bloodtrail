## MODIFIED Requirements

### Requirement: Delivery results are not commit evidence

Hosts SHALL NOT treat the Node binding's transaction-critical delivery result or its declared guarantees as proof of a business commit, of business and audit atomicity, of persistent retry, or of deduplication across binding instances (G4, G5). Consumers SHALL read whether a business change committed from the occurrence's own commit state.

#### Scenario: Delivery reported for an uncommitted occurrence
- **WHEN** the binding returns any delivery result, including `durable_without_commit`, for an occurrence
- **THEN** the host and the consumer rely on the occurrence's commit state, not on the delivery result
