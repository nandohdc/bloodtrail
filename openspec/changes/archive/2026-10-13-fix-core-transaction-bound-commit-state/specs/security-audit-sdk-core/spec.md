## ADDED Requirements

### Requirement: Transaction-bound commit state requires operation evidence for every outcome

Named methods for catalog events including `committed` SHALL take terminal commit state only from SDK-issued operation evidence for every outcome, never infer it from outcome. Without a handle or direct commit state, they SHALL refuse success, failure, denied, partial and cancelled with bounded `PREMATURE_SUCCESS` / `validation` / `/operation/state` and no sink call. Catalog events including `not_applicable` SHALL resolve to `not_applicable` without evidence.

#### Scenario: Transaction-bound denied MFA removal without evidence is refused

- **WHEN** a caller emits a denied MFA removal through its named method without an operation handle or direct commit state
- **THEN** the SDK returns `PREMATURE_SUCCESS` / `validation` / `/operation/state` and does not invoke the sink

#### Scenario: Transaction-bound non-success outcomes without evidence are refused

- **WHEN** a caller emits a catalog-allowed failed, partial or cancelled transaction-bound event without an operation handle or direct commit state
- **THEN** the SDK returns the bounded `PREMATURE_SUCCESS` result at `/operation/state` without sink invocation or inferred commit state

#### Scenario: Transaction-bound denial with not-committed evidence is recorded honestly

- **WHEN** a caller passes a same-instance method-bound handle transitioned through `markNotCommitted()` to a named transaction-bound event with outcome `denied`
- **THEN** the SDK accepts the denial and records `commit_state: "not_committed"`

#### Scenario: Non-transaction-bound fixture without evidence retains not-applicable state

- **WHEN** a caller emits an otherwise valid named event whose catalog commit values include `not_applicable`, without an operation handle or direct commit state
- **THEN** the SDK accepts it and records `commit_state: "not_applicable"`
