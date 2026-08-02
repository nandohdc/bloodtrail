# API reference

This reference describes the supported exports of `@bloodtrail/security-audit-sdk-core` candidate version `0.1.0`. It is not a production integration or deployment guide.

## Factory and configuration

```ts
import {
  createSecurityAuditSdk,
  type SecurityAuditSdkConfiguration,
} from "@bloodtrail/security-audit-sdk-core";

const configuration: SecurityAuditSdkConfiguration = {
  contractVersion: "1.0.0",
  producer: { name: "synthetic-producer", version: "0.1.0" },
  service: { name: "synthetic-service", version: "0.1.0" },
  environment: { name: "test" },
  sink,
  authoritativeContext: {},
  transformations: [],
  clock,
  identifiers,
  shutdownTimeoutMs: 5_000,
};

const audit = createSecurityAuditSdk(configuration);
```

Required configuration:

- `contractVersion`: exactly `"1.0.0"`; other values fail with `SDK_UNSUPPORTED_CONTRACT_VERSION` before readiness.
- `producer`: canonical producer name and version established by the application.
- `service`: canonical service identity.
- `environment`: deployment environment label.
- `sink`: a transport-neutral `AuditEventSink`.

Optional configuration:

- `deployment`: deployment ID, region, and zone metadata.
- `authoritativeContext`: immutable base context used by every call.
- `transformations`: initialization-only field-scoped synchronous hooks.
- `clock`: one fixed `AuditClock`; defaults to the system clock.
- `identifiers`: one fixed `AuditIdentifierProvider`; defaults to collision-resistant UUID generation.
- `shutdownTimeoutMs`: bounded `0..60000` wait; default `5000`.

Normalization is field-aware rather than one recursive clone/freeze operation:

- The SDK creates and shallow-freezes the normalized top-level envelope. It copies and freezes supported plain-value records, scalar options, authoritative base context, the transformations array, and each transformation registration path.
- `sink`, `clock`, `identifiers`, and each transformation hook object are caller-owned dependency-injected capabilities. The SDK retains the exact object identity and does not clone, freeze, bind, proxy, recursively traverse, redefine, or otherwise mutate the collaborator or its nested state.
- Provider and hook methods are invoked through the retained object, preserving class prototypes, native private fields, method identity, and expected `this` receiver behavior.
- Replacing properties on the caller's original top-level configuration after initialization cannot replace the normalized references or copied options. A collaborator remains a live external capability and may maintain mutable queues, maps, sets, counters, or other state.
- Callers own collaborator lifecycle and concurrency safety. Freezing a collaborator before passing it is the caller's decision and works only when that collaborator's own implementation supports frozen instances.

Configuration immutability therefore protects SDK-owned configuration without transferring ownership of external capabilities. The SDK factory returns one ready instance; it does not expose reinitialization.

## Clock and identifier providers

`AuditClock.now()` must return a valid `Date`. `AuditIdentifierProvider` supplies `eventId`, `operationId`, `correlationId`, `causationId`, `requestId`, `messageId`, and `transactionId`. Event IDs must be lowercase RFC 4122 UUIDs accepted by contract validation. Other generated identifiers must be non-empty, bounded printable values. Reuse of an event or operation ID where uniqueness is required fails safely.

Inject deterministic providers only at initialization and normally only in tests. An injected provider changes repeatability, not causality or uniqueness requirements. Stateful class providers are supported; their methods retain the original receiver, and the caller remains responsible for coordinating their mutable state across concurrent SDK calls.

## Authority-specific context construction

Public context constructors create immutable values with module-private runtime brand registration. A TypeScript assertion changes only a compile-time type and cannot create that registration.

### Actor and identity

- `authenticatedHumanActor`
- `serviceAccountActor`
- `workloadIdentityActor`
- `apiCredentialActor`
- `administratorActor`
- `backgroundJobActor`
- `scheduledProcessActor`
- `externalIntegrationActor`
- `authoritativeActor`
- `anonymousActor` and `claimedActor` for explicitly non-authoritative claims
- `authenticatedPrincipal`
- `authoritativeSubject`
- `credentialReference`
- `delegationContext`, `delegatedActorContext`, `impersonationContext`, and `impersonatingActorContext`

The application must invoke authoritative constructors only after server-side authentication or equivalent trusted resolution. Browser identity, headers, form fields, tokens, and caller JSON remain claims; the SDK does not authenticate them.

### Tenant and resource

- `authoritativeTenant` represents resolved tenant, cross-tenant, platform, or tenantless scope.
- `claimedTenant` preserves a caller claim separately.
- `authoritativeResource` represents stable resource identity, operation, classification, ownership, and optional parent/bulk/export/change metadata.

The application resolves tenant routing and resource ownership. The SDK cross-validates actor, effective, resource-owning, authorization, claimed, platform, and cross-tenant roles. A caller-provided tenant never becomes ownership evidence.

### Authentication and authorization

- `authenticationEvidence` preserves method, assurance, MFA, credential category, identity-provider, recovery, delegation, and impersonation facts established by the application authority.
- `sessionEvidence` preserves non-secret session references and assurance metadata.
- `authorizationEvidence` preserves policy decision, policy/version, capability, enforcement point, reason, resource/tenant context, override/break-glass flags, and policy correlation.

Authorization `allow` proves only that the recorded policy evaluation allowed an attempt. It is not a successful business outcome and does not mark a transaction committed.

### Other context

- `observedSource` and `destinationContext`
- `serviceWorkload`
- `dataPolicyContext`, `riskContext`, and `integrityContext`
- `registeredEnrichmentExtension`
- plain bounded request and correlation values in `AuditContextFrame`

`observedSource` records what a trusted server boundary observed. Client-reported user-agent data remains client-reported. Transport authentication or cryptographic attestations do not prove that the event's business claims are truthful.

## AsyncLocalStorage context

`audit.runWithContext(frame, callback)` and `runWithAuditContext(frame, callback)` establish a validated immutable `AuditContextFrame` in Node `AsyncLocalStorage`. `currentAuditContext()` reads the current frame. `createAuditContextFrame()` validates a standalone frame.

A child scope inherits its parent, merges only explicit child slots, merges request/correlation members field-by-field, and restores the parent on normal return, rejection, or throw. Concurrent promise/timer continuations created inside different scopes remain isolated on Node 24 and 26. Explicit propagation is required when an integration creates work outside the intended scope or crosses a process/thread/transport boundary.

Direct named-method input overrides the same slot from base or active context. The SDK never invents missing actor, tenant, request, trace, or authorization evidence.

## Named event API

Each method derives event name, category, action, lifecycle constraints, and minimum delivery class from generated catalog metadata. Callers supply contexts and permissible outcome details, not canonical identity overrides.

| Method | Canonical event name |
| --- | --- |
| `accountRegistrationAttempted` | `bloodtrail.audit.account.registration.attempted` |
| `accountRegistrationCompleted` | `bloodtrail.audit.account.registration.completed` |
| `authenticationSucceeded` | `bloodtrail.audit.authentication.succeeded` |
| `authenticationFailed` | `bloodtrail.audit.authentication.failed` |
| `mfaEnrolled` | `bloodtrail.audit.authentication.mfa.enrolled` |
| `mfaRemoved` | `bloodtrail.audit.authentication.mfa.removed` |
| `sessionCreated` | `bloodtrail.audit.session.created` |
| `sessionRevoked` | `bloodtrail.audit.session.revoked` |
| `passwordResetRequested` | `bloodtrail.audit.account.password_reset.requested` |
| `passwordResetCompleted` | `bloodtrail.audit.account.password_reset.completed` |
| `authorizationAllowed` | `bloodtrail.audit.authorization.allowed` |
| `authorizationDenied` | `bloodtrail.audit.authorization.denied` |
| `roleAssigned` | `bloodtrail.audit.authorization.role.assigned` |
| `roleRemoved` | `bloodtrail.audit.authorization.role.removed` |
| `privilegeElevated` | `bloodtrail.audit.authorization.privilege.elevated` |
| `impersonationStarted` | `bloodtrail.audit.administration.impersonation.started` |
| `impersonationEnded` | `bloodtrail.audit.administration.impersonation.ended` |
| `sensitiveResourceViewed` | `bloodtrail.audit.data.sensitive_resource.viewed` |
| `sensitiveResourceCreated` | `bloodtrail.audit.data.sensitive_resource.created` |
| `sensitiveResourceModified` | `bloodtrail.audit.data.sensitive_resource.modified` |
| `sensitiveResourceDeleted` | `bloodtrail.audit.data.sensitive_resource.deleted` |
| `sensitiveDataExported` | `bloodtrail.audit.data.sensitive_data.exported` |
| `securityConfigurationChanged` | `bloodtrail.audit.security.configuration.changed` |
| `tenantContextViolationDetected` | `bloodtrail.audit.tenant.context_violation.detected` |

Every method returns `Promise<AuditResult<AuditDeliveryResult>>`. The public `emit(event)` validates a complete canonical `SecurityAuditEvent`; it is not an arbitrary-object escape hatch and should not replace named construction. `redeliver(event)` accepts an already validated canonical record and preserves its immutable identity for a modeled pure redelivery.

## Transaction-aware operations

```ts
const operation = audit.beginOperation({
  boundEvent: "sensitiveResourceModified",
});
if (!operation.ok) throw new Error(operation.error.code);

// Call only after the application's trusted transaction boundary reports commit.
const committed = operation.value.markCommitted();
if (!committed.ok) throw new Error(committed.error.code);

const result = await audit.sensitiveResourceModified({
  actor,
  tenant,
  resource,
  authorization,
  operation: operation.value,
});
```

An operation starts in `started` and is transactional by default. Valid terminal transitions are `markCommitted`, `markNotCommitted`, `markPartiallyCommitted`, or `markCancelled`; a committed operation may later `markCompensated`. Repeating the same transition is idempotent; incompatible transitions fail with `SDK_INVALID_OPERATION_TRANSITION`.

Named methods accept only the exact opaque handle returned by `beginOperation()` from that same SDK instance. Runtime authority is stored in an instance-private weak identity map; operation, transaction, correlation, state, and event-binding values are resolved from that private record. Plain structural objects, fake `snapshot()` methods, snapshots, object spreads, manual copies, `structuredClone`, JSON round trips, and handles issued by another SDK instance fail with bounded `SDK_INVALID_OPERATION_TRANSITION` diagnostics at `/operation` and never invoke the sink. Hostile caller-selected identifiers in rejected values are not included in diagnostics or event correlation.

`snapshot()` returns an immutable observational value for inspection only. It is a `GeneratedOperationContext` representation, not completion evidence, and copying or modifying it cannot preserve or create authority. Event binding is immutable private evidence: deleting or replacing `bound_event` in copied data cannot unbind or rebind the operation. TypeScript named-method signatures require `AuditOperationHandle`; generated structural operation contexts remain available for canonical event representation but are not named-method inputs.

The handle does not inspect a database, open a transaction, create an outbox, or make audit emission atomic with business state. Transactional success before `markCommitted()` fails with `PREMATURE_SUCCESS` and the sink is not called. A bound operation cannot complete through a different named method. Only sanctioned handle transitions can establish committed or other terminal operation state.

Terminal-success deduplication is atomic within one SDK instance for the SDK-issued operation ID plus cataloged event name. Absence is `idle`; a call synchronously acquires `reserved` before sink handoff, and sink acceptance promotes it to `completed`. A concurrent or later terminal-success call observing either state returns the existing bounded `SDK_DUPLICATE_SUCCESS` result without running transformation/validation hooks or invoking the sink. Rejected, unknown, synchronously thrown, and rejected-promise sink outcomes release `reserved`, so a later non-concurrent caller may explicitly retry; a caller rejected while the first attempt is in flight must retry after that attempt settles. The core performs no automatic retry, and sink acceptance is not durable delivery. Retention and the final SDK-local deduplication horizon remain subject to the separately governed F-08 remediation; this correction adds no expiry or eviction policy.

This provenance rule is specific to named construction. Generic `emit()` and `redeliver()` continue to validate complete canonical events at the trusted-producer boundary; the SDK cannot determine whether compromised trusted application logic intentionally constructed a false but canonical complete event.

## Causality, asynchronous completion, retry, and redelivery

- Correlation, operation, transaction, request, message, trace, span, causation, event, and original-event identifiers remain distinct.
- Completion events whose contract semantics require an original attempt must carry both `correlation.causation_id` and `correlation.original_event_id`.
- Re-execution calls the named API again with `retry: { retry_attempt, original_event_id, causation_id }`; the SDK creates a new event ID.
- Pure redelivery calls `redeliver(validatedEvent)`; it preserves the same event ID and bytes and implements no queue or retry policy.
- Self-causation and a positive retry without original-event identity fail safely.

## Privacy transformations

A transformation registration identifies one canonical field-policy path and a synchronous function:

```ts
const transformations = [{
  path: "actor.id",
  transform: ({ value, tenantId, purpose }) => ({
    value: pseudonymizeOutsideTheSdk(value, tenantId, purpose),
    key_id: "synthetic-key-version-1",
  }),
}] as const;
```

The application owns any key and transformation implementation. The SDK supplies only the bounded field value, effective tenant when available, and event purpose. It pre-scans input, permits only policy-eligible paths, rejects promises and invalid output, applies the transformed string, then reruns prohibited-data, authority, schema, semantic, and bounds validation. The hook cannot overwrite event identity, schema, tenant scope, authorization decision, delivery class, or trust level. A plain unkeyed hash of guessable identifiers is not adequate pseudonymization.

## Registered extensions

`registeredEnrichmentExtension()` currently accepts only the generated `bloodtrail.audit.enrichment.v1` namespace and its allowed provenance/risk fields. Runtime validation rejects unknown namespaces/fields, excessive values, prohibited data, canonical shadowing, or authoritative trust. Extension provenance is `downstream_enrichment`; it is never authentication or authorization evidence.

## Sink and lifecycle

```ts
export interface AuditEventSink {
  emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult>;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

A sink receives one fully validated frozen event per SDK handoff. `accepted` means only accepted at that sink boundary. `rejected` and `unknown` become bounded safe SDK failures. Synchronously thrown and rejected-promise causes are untrusted, become `SDK_SINK_FAILURE`, and are not serialized.

`audit.flush()` invokes optional sink flush while ready or shutting down. `audit.shutdown()` prevents new emission, waits for tracked in-flight calls up to the configured bound, calls optional flush then shutdown at most once, and moves to `shut_down`. It does not establish durable handoff.

No production sink is included. `createCapturingAuditSink` and `createInMemoryAuditSink` from `./testing` are deterministic test utilities with no network or filesystem behavior. The in-memory sink's capacity is bounded and eviction is not delivery.

## Error and result model

Expected runtime outcomes use:

```ts
type AuditResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SafeAuditError };
```

`SafeAuditError` contains a stable code, category, optional bounded path, and only already-safe event identity metadata. It never serializes rejected raw values, full events, payloads, arbitrary sink/hook causes, or stacks. Invalid initialization throws `SecurityAuditSdkError`; `toJSON()` remains bounded and safe.

Contract codes are exported as `CONTRACT_ERROR_CODES`; SDK lifecycle/package codes are exported as `SDK_ERROR_CODES`. Additions, meaning changes, and removals follow [MIGRATION.md](./MIGRATION.md).

## Testing utilities and compilable examples

`@bloodtrail/security-audit-sdk-core/testing` exports:

- `createCapturingAuditSink({ failWith? })`, exposing immutable captured events and deterministic rejection/throw injection;
- `createInMemoryAuditSink({ capacity? })`, a bounded in-memory test buffer;
- test-facing clock, identifier, sink, and delivery-result types.

The following functions in [`examples/scenarios.ts`](./examples/scenarios.ts) are compiled against only `.` and `./testing`, then executed by repository verification:

| Required scenario | Function |
| --- | --- |
| Authentication success | `authenticationSuccess` |
| Authorization denial | `authorizationDenial` |
| Cross-tenant denial | `crossTenantDenial` |
| Role assignment | `roleAssignment` |
| Administrative impersonation | `administrativeImpersonation` |
| Sensitive-resource modification | `sensitiveResourceModification` |
| Sensitive-data export | `sensitiveDataExport` |
| Asynchronous completion | `asynchronousCompletion` |
| Retry/re-execution | `retryReexecution` |
| Transaction-aware success | `transactionAwareSuccess` |
| Operation failure after authorization allow | `authorizationAllowThenFailure` |
| Privacy transformation | `privacyTransformation` |
| Registered extension | `registeredExtension` |
| Concurrent AsyncLocalStorage contexts | `concurrentContexts` |
| Deterministic testing | `deterministicTesting` |

All identifiers, addresses, host names, and times in those examples are synthetic.

## Supported-runtime verification

The canonical repository command is `npm run verify` on one declared runtime. It auto-selects the current OpenSpec lifecycle. Explicit repository gates may run `npm run verify -- --mode active`, `npm run verify -- --mode governed`, or `npm run verify -- --mode archived`; the completed original SDK archive is selected with `npm run verify -- --mode archived --change implement-security-audit-sdk-core`. Archived mode validates the canonical capability and repository rather than invoking strict validation for a deleted active change.

Independent exact-runtime evidence uses the same clean package matrix on Node `24.2.0` and `26.5.0`:

```sh
repo="$(git rev-parse --show-toplevel)"
for version in 24.2.0 26.5.0; do
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp/home \
    -v "$repo:/work" \
    -w /work/packages/security-audit-sdk-core \
    "node:${version}-bookworm" \
    sh -lc 'rm -rf node_modules dist dist-tests dist-examples && npm ci --ignore-scripts --no-audit --no-fund && npm run test:matrix'
done
```

This runtime procedure does not replace lifecycle-appropriate strict OpenSpec, changed-path ownership, package-audit, mutation, or Git-index checks in `npm run verify`. The lifecycle repair changes repository verification only; it does not change the SDK runtime API or Security Audit Event Contract `1.0.0` compatibility.
