## ADDED Requirements

### Requirement: Failed authentication carries only a credential target

On `bloodtrail.audit.authentication.failed`, the SDK SHALL refuse every target other than the credential, as the scenarios below enumerate. The refusal SHALL be `SDK_SEMANTIC_VALIDATION_FAILED` / `validation`, SHALL run after every other semantic check on every shared validation path, and SHALL NOT call the sink. The rule is SDK-only, and acceptance SHALL NOT be presented as conformance.

#### Scenario: An account subject is refused
- **WHEN** a failed authentication carries a `subject` of type `account`
- **THEN** named methods, `emit()`, `redeliver()` and free `validateSecurityAuditEvent()` each return `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/subject/type`, and the sink is never called

#### Scenario: A subject identity without a type is refused
- **WHEN** a failed authentication carries a `subject` with an `id` or a `tenant_id` and no `type`
- **THEN** validation returns `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/subject/type`

#### Scenario: A non-credential resource is refused
- **WHEN** a failed authentication carries a `resource` typed `account`
- **THEN** validation returns `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/resource/type`

#### Scenario: A resource identity without a type is refused
- **WHEN** a failed authentication carries a `resource` with an `id` and no `type`
- **THEN** validation returns `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/resource/type`

#### Scenario: A subject display name is refused
- **WHEN** a failed authentication carries a `subject` with a `display_name`, typed or not
- **THEN** validation returns `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/subject/display_name`

#### Scenario: A resource parent is refused
- **WHEN** a failed authentication carries a `resource` with a `parent_type` or a `parent_id`, such as a credential naming its account
- **THEN** validation returns `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/resource/parent_type` or `/resource/parent_id`

#### Scenario: An authorization resource context other than the credential is refused
- **WHEN** a failed authentication carries an `authorization.resource_context` typed other than `credential`, or with an `id` and no `type`
- **THEN** validation returns `SDK_SEMANTIC_VALIDATION_FAILED` / `validation` / `/authorization/resource_context/type`

#### Scenario: An inherited target counts and a credential target overrides it
- **WHEN** a failed authentication inherits an account `subject` from configured or active context
- **THEN** it is refused, and passing a credential `subject` in the call input is accepted

#### Scenario: A subject or resource that names no target is accepted
- **WHEN** a failed authentication carries an empty `subject`, or a `resource` with no type and no identity
- **THEN** this rule does not refuse it

#### Scenario: The approved example and the derived resource are accepted
- **WHEN** a failed authentication carries the contract's approved credential `subject`, credential fields and credential `resource`, or no resource input so that the SDK derives one
- **THEN** it is accepted exactly as before, with its credential fields and actor fields unchanged

#### Scenario: Earlier diagnostics keep precedence
- **WHEN** a failed authentication carrying an account `subject` also fails an earlier semantic check
- **THEN** the earlier check's error is returned

#### Scenario: Other events are unaffected
- **WHEN** an event other than a failed authentication carries an account `subject`
- **THEN** this rule does not refuse it

#### Scenario: Old events get no redelivery exemption
- **WHEN** a failed authentication with an account `subject` is passed to `redeliver()`
- **THEN** it is refused exactly as a new event would be
