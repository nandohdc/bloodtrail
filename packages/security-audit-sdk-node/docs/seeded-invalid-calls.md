# Seeded Invalid-Call Diagnostic Exercise

This exercise is used to measure evaluation metric **M3: Diagnosis of 5 seeded invalid calls from the error output and catalog alone**. Evaluators are presented with 5 code snippets that fail validation at runtime. To pass M3, an evaluator must diagnose at least 4 out of 5 failures using only the SDK's returned `AuditResult` error output and `docs/error-catalog.md`.

---

## Overview

When an SDK operation is rejected by validation or invariant checks, it does not throw unhandled exceptions. Instead, it returns an `AuditResult` failure object:

```typescript
export interface DiagnosticAuditError {
  readonly code: string;
  readonly category: string;
  readonly path: string;
  readonly message: string;
}
```

Evaluators should use `error.code` and `error.path` to look up the issue in `docs/error-catalog.md`.

---

## Exercise 1: Sensitive Resource Viewed Without Actor

### Code Snippet
An engineer attempts to record a sensitive resource view without binding an actor in context or supplying one in parameters:

```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authoritativeTenant,
  authoritativeResource,
  authorizationEvidence,
} from "@bloodtrail/security-audit-sdk-core";

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-svc", version: "1.0.0" },
  service: { name: "eval-svc", version: "1.0.0" },
  environment: { name: "synthetic" },
  sink,
});

const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "t-1",
  effective_tenant_id: "t-1",
  resource_tenant_id: "t-1",
});

const resource = authoritativeResource({
  type: "sensitive_record",
  id: "doc-1",
  owning_tenant_id: "t-1",
  data_classification: "confidential",
  operation_type: "read",
  change_categories: ["content"],
});

const authorization = authorizationEvidence({
  decision: "allow",
  policy_id: "policy.1",
  policy_version: "1.0",
  capability: "read",
  enforcement_point: "pep",
  decision_reason: "accepted",
  resource_context: { type: "sensitive_record", id: "doc-1" },
  tenant_context: { effective_tenant_id: "t-1" },
});

// Invalid Call: No actor bound in context or supplied in parameters
const result = await (sdk.sensitiveResourceViewed as Function)({
  tenant,
  resource,
  authorization,
  request: { id: "req-1", method: "GET", route: "/docs/1" },
});
```

### Diagnostic Output
- **Error Code:** `MISSING_REQUIRED_ACTOR`
- **Error Path:** `/actor`
- **Category:** `validation`

### Fix & Explanation
Audit events require an authenticated actor. The caller must either provide an actor via `authenticatedHumanActor({ id, displayName })` in the call or wrap the execution in `sdk.runWithContext({ actor, tenant }, ...)`.

---

## Exercise 2: Account Registration Without Tenant Context

### Code Snippet
An engineer attempts to emit an account registration attempt without tenant context:

```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-svc", version: "1.0.0" },
  service: { name: "eval-svc", version: "1.0.0" },
  environment: { name: "synthetic" },
  sink,
});

const actor = authenticatedHumanActor({ id: "actor-1", displayName: "New User" });
const source = observedSource({ observed: { address: "198.51.100.5", port: 443 } });

// Invalid Call: Tenant context is omitted
const result = await (sdk.accountRegistrationAttempted as Function)({
  actor,
  request: { id: "req-reg", method: "POST", route: "/register" },
  source,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000301",
    operation_id: "22222222-2222-4222-8222-000000000302",
  },
});
```

### Diagnostic Output
- **Error Code:** `MISSING_TENANT_CONTEXT`
- **Error Path:** `/tenant`
- **Category:** `validation`

### Fix & Explanation
Contract 2.1.0 requires an explicit tenant scope on registration events. Bind authoritative tenant context via `authoritativeTenant({ scope: "tenant", actor_tenant_id: ..., effective_tenant_id: ..., resource_tenant_id: ... })`.

---

## Exercise 3: Premature Resource Creation Without Operation Handle

### Code Snippet
An engineer emits `sensitiveResourceCreated` without providing a committed operation handle:

```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  authoritativeTenant,
  authoritativeResource,
  authorizationEvidence,
} from "@bloodtrail/security-audit-sdk-core";

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-svc", version: "1.0.0" },
  service: { name: "eval-svc", version: "1.0.0" },
  environment: { name: "synthetic" },
  sink,
});

const actor = authenticatedHumanActor({ id: "actor-1", displayName: "Creator" });
const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "t-1",
  effective_tenant_id: "t-1",
  resource_tenant_id: "t-1",
});

const resource = authoritativeResource({
  type: "sensitive_record",
  id: "rec-1",
  owning_tenant_id: "t-1",
  data_classification: "confidential",
  operation_type: "create",
  change_categories: ["metadata"],
});

const authorization = authorizationEvidence({
  decision: "allow",
  policy_id: "policy.1",
  policy_version: "1.0",
  capability: "create",
  enforcement_point: "pep",
  decision_reason: "accepted",
  resource_context: { type: "sensitive_record", id: "rec-1" },
  tenant_context: { effective_tenant_id: "t-1" },
});

// Invalid Call: Omits an operation handle for a modifying state-change event
const result = await (sdk.sensitiveResourceCreated as Function)({
  actor,
  tenant,
  resource,
  authorization,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000321",
    operation_id: "22222222-2222-4222-8222-000000000322",
  },
});
```

### Diagnostic Output
- **Error Code:** `PREMATURE_SUCCESS`
- **Error Path:** `/operation/state`
- **Category:** `validation`

### Fix & Explanation
Modifications to sensitive resources must be guarded by an operation handle to guarantee transactional completion. Call `const op = sdk.beginOperation(...)`, perform the modification, call `op.commit()`, and pass `op` into `sdk.sensitiveResourceCreated(op, ...)`.

---

## Exercise 4: Authority Escalation With Plain Object

### Code Snippet
An engineer constructs an actor using an unbranded, plain JavaScript object:

```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authoritativeTenant,
  observedSource,
  type authenticatedHumanActor,
} from "@bloodtrail/security-audit-sdk-core";

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-svc", version: "1.0.0" },
  service: { name: "eval-svc", version: "1.0.0" },
  environment: { name: "synthetic" },
  sink,
});

const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "t-1",
  effective_tenant_id: "t-1",
  resource_tenant_id: "t-1",
});

const source = observedSource({ observed: { address: "198.51.100.5", port: 443 } });

// Invalid Call: Plain unbranded object passed as actor
const forgedActor = {
  type: "administrator",
  id: "forged-admin",
  provenance: { trust_level: "authoritative_server", source: "untrusted" },
} as unknown as ReturnType<typeof authenticatedHumanActor>;

const result = await sdk.accountRegistrationAttempted({
  actor: forgedActor,
  tenant,
  request: { id: "req-esc", method: "POST", route: "/register" },
  source,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000331",
    operation_id: "22222222-2222-4222-8222-000000000332",
  },
});
```

### Diagnostic Output
- **Error Code:** `AUTHORITY_ESCALATION`
- **Error Path:** `/actor`
- **Category:** `authority`

### Fix & Explanation
Plain JavaScript objects and type casts cannot forge authoritative context. You must construct actors using the factory functions exported by `@bloodtrail/security-audit-sdk-core`: `authenticatedHumanActor` or `apiCredentialActor`.

---

## Exercise 5: Prohibited Cleartext Credential in Payload

### Code Snippet
An engineer includes a cleartext password in the request metadata:

```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  authoritativeTenant,
  observedSource,
} from "@bloodtrail/security-audit-sdk-core";

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-svc", version: "1.0.0" },
  service: { name: "eval-svc", version: "1.0.0" },
  environment: { name: "synthetic" },
  sink,
});

const actor = authenticatedHumanActor({ id: "actor-1", displayName: "User One" });
const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "t-1",
  effective_tenant_id: "t-1",
  resource_tenant_id: "t-1",
});
const source = observedSource({ observed: { address: "198.51.100.5", port: 443 } });

// Invalid Call: 'password' field included in request object
const result = await (sdk.passwordResetRequested as Function)({
  actor,
  tenant,
  request: {
    id: "req-pwd-reset",
    method: "POST",
    route: "/password-reset",
    password: "cleartext-secret-value",
  },
  source,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000341",
    operation_id: "22222222-2222-4222-8222-000000000342",
  },
});
```

### Diagnostic Output
- **Error Code:** `PROHIBITED_DATA`
- **Error Path:** `/request/password`
- **Category:** `privacy`

### Fix & Explanation
The SDK automatically scans for prohibited credential keys and token patterns. Never pass raw passwords, secret tokens, or sensitive credentials into audit event payloads. Sanitize or strip credential properties before passing request metadata to the SDK.
