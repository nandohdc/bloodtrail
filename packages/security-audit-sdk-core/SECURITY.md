# Security and misuse guidance

This document defines SDK-core trust boundaries. It does not authorize production use, real-user processing, framework instrumentation, collection, or delivery infrastructure.

## Boundary summary

- The application establishes authoritative identity, tenancy, resource ownership, authentication, authorization, and transaction state at its own trusted server boundaries.
- Client/browser values remain claims even when syntactically valid.
- SDK constructors create immutable runtime-branded values and SDK validation checks contract structure and semantics.
- SDK validation cannot prove that a configured producer or application authority told the truth.
- A sink result describes only the configured sink boundary. Future transport, collector, durability, storage, and operational policy remain separate responsibilities and require separate governance.

## Prohibited patterns and safe alternatives

| Prohibited pattern | Why it is unsafe | Safe alternative |
| --- | --- | --- |
| Cast a plain object to `AuthoritativeActorContext`, `TenantAuthorityContext`, `ResourceAuthorityContext`, authentication/authorization evidence, or another branded type | A TypeScript assertion does not authenticate input or create the module-private runtime brand; JavaScript callers can bypass compile-time checking | Resolve the fact at an application-owned trusted boundary, then call the matching constructor such as `authenticatedHumanActor`, `authoritativeTenant`, `authoritativeResource`, `authenticationEvidence`, or `authorizationEvidence` |
| Treat browser, mobile, or other client identity as authenticated identity | Client identity fields can be forged and are not proof of authentication | Keep them in `claimedActor`, client-reported source, or request fields; use an authoritative server authentication result to construct the actor and principal |
| Trust caller-provided tenant IDs as effective tenant or resource ownership | A caller can select another tenant or create a confused-deputy path | Preserve the value with `claimedTenant`; resolve effective tenant and resource owner from trusted routing, authentication scope, tenancy authority, or the resource record, then use `authoritativeTenant` and `authoritativeResource` |
| Emit transactional success before business commit | It creates a false completed-success record for state that may roll back | Start an SDK operation, let the real transaction boundary call `markCommitted()`, then emit success; call `markNotCommitted`, `markPartiallyCommitted`, or `markCancelled` for other outcomes |
| Pass a plain operation object, snapshot, copied/spread/serialized snapshot, fake handle, or foreign-instance handle to a named method | Structural values can claim commit state, identifiers, or event binding without sanctioned SDK evidence | Pass only the exact handle returned by `beginOperation()` on the same SDK instance; treat `snapshot()` output as inspection data only |
| Race two terminal-success calls for one operation or automatically loop after a sink failure | Without an operation-scoped reservation, overlapping calls can create duplicate success records; automatic retries can create ungoverned delivery behavior | Let the SDK's same-instance atomic reservation reject concurrent/sequential duplicates with `SDK_DUPLICATE_SUCCESS`; after a rejected, unknown, thrown, or rejected-promise sink result settles and releases the reservation, make any explicit retry decision in application policy |
| Use authorization `allow` as proof of business success | Policy permission and execution outcome are different facts; allowed work can fail or be cancelled | Record authoritative authorization evidence separately and report the operation's actual outcome/commit state through the operation handle |
| Put passwords, verifier material, raw tokens, cookies, API/private keys, factor/recovery contents, payment-card values, connection strings, full bodies, serialized objects, or other secrets in event fields or extensions | Audit records and diagnostics can propagate widely; transformation after exposure is not a safe cure | Emit only non-secret references and approved bounded metadata; reject prohibited values before hooks, errors, or sinks; use field-policy-approved external pseudonymization where required |
| Build a generic arbitrary object and pass it as an event | It can bypass named required-context guidance and encourages caller-controlled names, actions, versions, delivery classes, and semantics | Use one of the 24 named methods. Use `emit` only for an already complete canonical `SecurityAuditEvent` that still passes runtime validation; use `redeliver` only for the same immutable validated record |
| Use `createCapturingAuditSink` or `createInMemoryAuditSink` in production | They have no durability, access-control, retention, rotation, retry, operational failure, or delivery guarantee | Keep test sinks in tests and local development only. A production sink/transport requires a separate OpenSpec change, privacy/security review, and explicit production authorization |
| Treat `{ status: "accepted" }` as durable delivery | The result means only that the configured sink accepted the call; downstream loss or rejection can still occur | Define durability, retries, queues/outboxes, collector acceptance, storage, monitoring, and fail-open/fail-closed policy in separately governed future infrastructure |
| Interpret transport authentication, signatures, attestations, or cryptographic integrity as proof that event claims are truthful | Integrity can show who sent bytes or whether bytes changed, but a compromised or incorrect producer can still emit false facts | Use integrity only for its stated transport/attestation scope; retain producer-truth limitations and validate application authority at the source |
| Edit `src/generated/*`, copied validator output, catalog constants, or generated types by hand | Manual edits create silent divergence from the approved version `1.0.0` contract | Change no canonical semantics in this SDK. Run `npm run generate` from approved inputs and `npm run check:generated`; propose a separate governed contract version for genuine semantic changes |

## Authority-provider responsibility

“Authority provider” describes application-owned server logic that resolves a fact before calling an SDK authority constructor. It is not a callback that relabels arbitrary request JSON. Examples include:

- an authentication service result used to construct an authenticated actor/principal;
- trusted tenancy routing or a database ownership lookup used to construct tenant/resource context;
- a policy decision produced by the actual enforcement point and passed to `authorizationEvidence`;
- a transaction manager callback used to transition an operation handle.

The SDK validates provenance combinations and conflicts. It cannot determine whether compromised application logic intentionally lied. Keep the smallest authority surface, reject conflicts, and preserve claims separately.

## Authentication and authorization

Never include raw credentials. `credentialReference` accepts a non-secret reference and optional key/version metadata, not authentication material. `sessionEvidence` carries a non-secret session reference and bounded assurance metadata, not a session cookie.

`authenticationEvidence` and `authorizationEvidence` are facts supplied by application authorities. The SDK does not authenticate a user, evaluate policy, or infer a decision from HTTP status. An authorization denial is not a generic operation failure, and an authorization allow may coexist with a later `failure` and `not_committed` state.

## Tenant and resource authority

Represent actor tenant, effective tenant, claimed tenant, resource-owning tenant, parent tenant, cross-tenant scope, platform scope, and tenantless scope separately. Cross-tenant scope requires authoritative target/resource context and authoritative authorization evidence. The dedicated tenant-violation event may preserve a conflicting claim but never treats the claim as authorization.

## Transaction and causality

An operation handle records an application-reported state transition; it does not open or inspect a database transaction and does not make business state atomic with the sink. Mark a transition only after the trusted transaction boundary knows it. Named methods resolve identity, state, and immutable event binding from SDK-instance-private weak state. Snapshots and copies carry no authority, and an operation from one SDK instance is rejected by another.

For terminal success, the SDK synchronously reserves the same-instance operation/event completion key before sink handoff. Only one overlapping call can reserve it; another receives bounded `SDK_DUPLICATE_SUCCESS` without another sink call. Acceptance marks completion. Every non-accepted or thrown sink outcome releases the in-flight reservation for a later explicit retry, without automatic retry or a durability claim. The current retained completion state has no F-08 expiry/eviction policy yet and must not be interpreted as a final lifetime-global deduplication horizon.

This control prevents structural forgery through the sanctioned named-operation path. It does not make generic `emit()` or `redeliver()` an oracle for application truth, and it cannot prove that compromised trusted application code is honest.

Pure redelivery retains one immutable event ID. A retry or re-execution is a new occurrence with a new ID and a positive retry relationship to the original event. Required asynchronous completion also carries causation and original-event identity. Do not fabricate links or reuse IDs to make unrelated work look continuous.

## Transformations

Transformation hooks receive only one policy-approved string, purpose, and optional effective tenant. They are synchronous and immutable after initialization. They must not log, export, retain, or return raw input elsewhere. Hook output is scanned and validated again. The optional `key_id` is non-secret version metadata; key material stays outside the SDK. Do not use plain hashes of guessable identifiers as pseudonymization.

## Extensions

Only generated registered namespaces and fields are accepted. The version `1.0.0` enrichment namespace has `downstream_enrichment` provenance and is non-authoritative. Extensions cannot introduce alternate event names, actors, tenants, resource ownership, authorization, outcomes, schema versions, delivery classes, or arbitrary payloads.

## Safe errors

Handle `AuditResult` without appending the original rejected input or caught sink error to logs. Public errors deliberately contain only stable codes, categories, bounded paths, and already-safe event identifiers when available. Do not wrap them with complete request/event payloads. General diagnostic logging is outside this package.

## Production and legal limits

Passing SDK verification does not establish:

- producer truthfulness or event completeness;
- downstream ingestion acceptance;
- delivery or durability;
- legal or privacy compliance;
- non-repudiation;
- production authorization;
- permission to process real-user data.

Framework adapters, application instrumentation, production transports/exporters, collectors, reliable delivery/outbox, storage/SIEM, analytics/detection, cryptographic chaining, and any real-user-data use each require separately reviewed changes and explicit authorization.
