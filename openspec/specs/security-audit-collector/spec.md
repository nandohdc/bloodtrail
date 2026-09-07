# security-audit-collector Specification

## Purpose

Bounded, non-production collector ingress semantics for the collector boundary of the Bloodtrail delivery chain: authentication-first ordering, contract-derived size bounds, generated-validator structural validation, explicit supported-version enforcement, bounded secret-free diagnostics and metrics, admission-only acceptance, and the non-production scope boundary.

## Requirements

### Requirement: Authentication precedes every other ingress stage

The collector ingress SHALL authenticate every submission before reading, sizing, parsing, or validating any part of its body. A submission with missing, malformed, or invalid authentication SHALL be rejected before any body byte is parsed, and the rejection SHALL be provable by instrumentation of the parse stage, not by code inspection. Authentication SHALL identify a sender and SHALL NOT establish evidence truth, trust, or integrity: an authenticated sender is identified, never believed.

#### Scenario: Missing authentication is rejected before parse
- **WHEN** a submission with a schema-valid body carries no authentication
- **THEN** the ingress rejects it with an authentication diagnostic and the parse stage is never invoked

#### Scenario: Malformed authentication is rejected before parse
- **WHEN** a submission carries authentication material that is not well formed
- **THEN** the ingress rejects it with an authentication diagnostic and the parse stage is never invoked

#### Scenario: Invalid authentication is rejected before parse
- **WHEN** a submission carries well-formed authentication that the configured authenticator does not accept
- **THEN** the ingress rejects it with an authentication diagnostic and the parse stage is never invoked

#### Scenario: Authentication never promotes trust
- **WHEN** a submission passes authentication
- **THEN** the ingress records only the sender identity claimed at the authentication boundary and derives no trust, authority, or truth claim from it

### Requirement: Size limits are derived from the frozen contract bounds

The collector ingress SHALL enforce the frozen contract bounds by derivation, not configuration: `event_max_bytes` 65536, `object_max_depth` 8, `default_string_max` 256, `display_string_max` 128, `message_string_max` 512, `array_max_items` 32, `extension_max_namespaces` 4, `retry_attempt_max` 1000. A submission exceeding any derived bound SHALL be rejected with a bounded size diagnostic before structural validation runs. The ingress SHALL NOT accept a submission the producer could not have emitted, and SHALL NOT reject a valid one through a looser or stricter self-configured limit.

#### Scenario: Oversized body is rejected before schema validation
- **WHEN** an authenticated submission exceeds the derived `event_max_bytes` limit
- **THEN** the ingress rejects it with a size diagnostic and the schema stage is never invoked

#### Scenario: Bounds come from the contract
- **WHEN** the ingress enforces a size, depth, string, array, namespace, or retry bound
- **THEN** the enforced value equals the corresponding frozen contract bound and no independently configured limit is consulted

### Requirement: Structural validation runs the generated validator artifact

The collector ingress SHALL validate structurally with the exact standalone generated validator produced from the frozen contract (`schema-validator.generated.cjs`), carried as a byte-identical vendored copy inside the collector package. A drift gate SHALL recompute byte identity against the canonical artifact so producer and collector cannot disagree about what is valid. The ingress SHALL NOT reimplement structural validation or validate against a different schema source. A schema-invalid submission SHALL be rejected with the generated validator's bounded diagnostic, before admission, terminally and non-retryably.

#### Scenario: Schema-invalid body is rejected with the generated diagnostic
- **WHEN** an authenticated, size-bounded submission fails the generated validator
- **THEN** the ingress rejects it before admission with a bounded machine-readable validation code derived from the validator's diagnostic, and no admission capacity is consumed

#### Scenario: Vendor copy stays byte-identical
- **WHEN** the collector drift gate compares the vendored validator against the canonical generated artifact
- **THEN** the comparison succeeds only when both are byte-identical, and any divergence fails the gate

### Requirement: The version stage enforces an explicitly enumerated finite supported set

The collector ingress SHALL enforce the ratified asymmetric version policy: a supported set that is an explicitly enumerated finite set of canonical contract versions, read from the submission's declared contract version (`schema.version`), separate from and never broadening producer `EXACT_ONE` binding. A submission declaring a version outside the supported set SHALL be rejected with a distinct version diagnostic that is distinguishable from a schema rejection. The supported set for this package SHALL be the single canonical version `1.0.0` until the policy's recorded revisit conditions authorize another member.

#### Scenario: Unsupported version is rejected distinctly
- **WHEN** an authenticated, size-bounded, schema-valid submission declares a contract version outside the enumerated supported set
- **THEN** the ingress rejects it with the version diagnostic, and the rejection is distinguishable from a schema rejection of the same body

#### Scenario: Supported version proceeds
- **WHEN** a submission declares a version inside the enumerated supported set
- **THEN** the version stage passes and does not alter, downgrade, coerce, or reinterpret the declared version

### Requirement: Ingress order is fixed and every stage fails closed

The collector ingress SHALL execute the stages in exactly this order: authenticate, size, parse, schema, version, accept. Each stage SHALL fail closed: a rejection at any stage SHALL terminate processing before any later stage runs, before admission, and before any capacity is consumed. An unreadable, malformed, or unexpected input at any stage SHALL produce a rejection, never a pass.

#### Scenario: Rejection at an early stage prevents later stages
- **WHEN** a submission is rejected by the authenticate, size, or parse stage
- **THEN** no later stage runs and the submission is not admitted

#### Scenario: Acceptance requires passing every stage
- **WHEN** a submission is admitted
- **THEN** it passed authenticate, size, parse, schema, and version in that order, and admission capacity is consumed only at accept

### Requirement: Rejection diagnostics and metrics are bounded and disclose nothing

Every rejection diagnostic SHALL be a bounded stable triple of code, category, and path, carrying no caller data, payload bytes, secrets, or unbounded strings. Operational counters SHALL be bounded counts keyed by stable, non-secret labels; no metric SHALL carry tenant identifiers, payload content, credentials, or any material that would leak submission content. No rejection SHALL emit an audit event, and no failure SHALL create a recursive audit-event loop.

#### Scenario: Diagnostics carry no payload
- **WHEN** a rejection diagnostic is inspected
- **THEN** it contains only code, category, and a bounded path, and no submission payload or secret material

#### Scenario: Metrics stay non-secret
- **WHEN** operational counters are inspected after any mix of accepted and rejected submissions
- **THEN** every counter is keyed by stable non-secret labels and no label or value carries payload or credential content

### Requirement: Acceptance is admission only

Acceptance at the ingress SHALL mean admission: the occurrence enters the delivery model's `admitted` state with its event identity and attempt identity assigned, and nothing more. The ingress SHALL NOT claim durability, delivery, retry, storage, at-least-once delivery, or downstream acceptance. A validation-failed occurrence SHALL never become `admitted`. Idempotency and deduplication semantics are out of scope for this change.

#### Scenario: Admitted occurrence carries identity only
- **WHEN** a submission is accepted
- **THEN** the ingress records its admission with the occurrence's event identity, consumes admission capacity, and makes no delivery, durability, or downstream claim

#### Scenario: Rejected occurrence is never admitted
- **WHEN** a submission fails any ingress stage
- **THEN** the occurrence never enters the `admitted` state and no admission capacity is consumed

### Requirement: Only non-production authentication is shipped

The collector package SHALL ship exactly one authenticator implementation, explicitly named and documented as non-production, verifying mock or synthetic credentials against test fixtures only. The package SHALL define an authentication interface but SHALL NOT select, implement, or configure any production credential system, secret management, infrastructure, or network service. The package SHALL NOT authorize production collection, deployment, publication, or real-user data processing.

#### Scenario: Shipped authenticator is non-production by declaration
- **WHEN** the collector package surface is inspected
- **THEN** the single shipped authenticator is documented as non-production with synthetic fixtures, and no production credential or infrastructure mechanism exists

### Requirement: The collector is a declared, zero-runtime-dependency package

The collector implementation SHALL live in the dedicated package `packages/security-audit-collector`, private and UNLICENSED, declared in the repository's package-discovery completeness list, wired into the repository CI the same way as the other packages, and with zero third-party runtime dependencies. The canonical generated validator SHALL be the package's only non-authored runtime artifact, vendored byte-identically with its drift gate. The package SHALL NOT modify `packages/security-audit-sdk-core`, the frozen contract, or any generated SDK artifact.

#### Scenario: Package discovery is complete
- **WHEN** the repository's package-discovery completeness check runs
- **THEN** `packages/security-audit-collector` is among the declared packages and the check passes

#### Scenario: No producer or contract surface is touched
- **WHEN** the change range is inspected
- **THEN** no file under `packages/security-audit-sdk-core`, `contracts/security-audit`, or `research/` is modified
