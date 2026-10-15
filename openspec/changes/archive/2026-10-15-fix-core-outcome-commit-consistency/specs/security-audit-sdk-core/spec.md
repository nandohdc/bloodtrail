## ADDED Requirements

### Requirement: Outcome and commit state agree with operation evidence

The SDK SHALL refuse contradictory outcomes on every shared semantic validation path before sink handoff. Completed success requires committed or not_applicable; compensating success requires compensated. Denied SHALL NOT assert committed, partially_committed or compensated. The success rule SHALL run with commit checks first; the SDK-only denial rule SHALL run last after derived-field provenance. Existing public types, exports and error codes SHALL remain unchanged.

#### Scenario: Completed success requires commit evidence
- **WHEN** a catalog-allowed `completed` event asserts `success` with a state other than `committed` or `not_applicable`
- **THEN** validation returns exactly `PREMATURE_SUCCESS` / `validation` / `/event/commit_state` and never calls the sink

#### Scenario: Compensating success requires compensation evidence
- **WHEN** a catalog-allowed `compensating` event asserts `success` with a state other than `compensated`
- **THEN** validation returns exactly `PREMATURE_SUCCESS` / `validation` / `/event/commit_state` and never calls the sink

#### Scenario: Denial cannot assert committed work
- **WHEN** an otherwise valid event asserts `denied` with `committed`, `partially_committed` or `compensated`
- **THEN** the SDK returns exactly `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/event/outcome` and never calls the sink
- **AND** this additional denial rule does not change frozen contract `2.1.0`

#### Scenario: All public validation paths agree
- **WHEN** a contradictory pair enters a named method with a same-instance bound handle, `emit()`, `redeliver()` or free `validateSecurityAuditEvent()`
- **THEN** the same shared rule returns its exact safe diagnostic without sink handoff

#### Scenario: Contract diagnostic precedence remains authoritative
- **WHEN** `deny` + `success` + `not_committed` also conflicts with authorization
- **THEN** first-position commit validation returns `PREMATURE_SUCCESS`
- **AND** `authorization-outcome-conflation` still returns `AUTHORIZATION_OUTCOME_CONFLICT`
- **AND** an otherwise authorization-valid `denied` + `committed` event with defective derived-field provenance returns the provenance diagnostic before the SDK-only denial rule

#### Scenario: Unjudged outcomes and defaults remain accepted
- **WHEN** catalog-valid `failure`, `partial` or `cancelled` is paired with any catalog commit state, or `denied` with `not_committed`, `not_started`, `not_applicable` or `unknown`, or `success` in another phase
- **THEN** these rules impose no additional judgement
- **AND** sanctioned terminal handle transitions including `markCancelled()` with omitted caller outcome retain accepted derived defaults

#### Scenario: Existing handle refusals and valid success remain unchanged
- **WHEN** a transaction-bound named call has no handle or has a pending handle and requests success
- **THEN** it retains `PREMATURE_SUCCESS` / `validation` / `/operation/state`
- **AND** catalog-valid completed `committed` or `not_applicable` success and compensating `compensated` success remain accepted

#### Scenario: Historical events receive no redelivery exemption
- **WHEN** a complete event emitted before the correction is redelivered with a contradictory pair
- **THEN** `redeliver()` refuses it under the same rule without sink handoff or historical-event grandfathering
