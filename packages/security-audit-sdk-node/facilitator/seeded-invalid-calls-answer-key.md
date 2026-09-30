# Seeded Invalid-Call Exercise: Facilitator Answer Key

This document is for evaluation facilitators only. It contains the expected error codes, error paths, diagnoses, and validated TypeScript fixes for the 5 calls in the M3 seeded invalid-call diagnostic exercise. Evaluators never receive this document; the kit builder never packages or copies it into the evaluation kit.

---

## Exercise 1: Sensitive Resource Viewed Without Actor

### Expected Error
- **Error Code:** `MISSING_REQUIRED_ACTOR`
- **Error Path:** `/actor`
- **Category:** `validation`

### Diagnosis
Audit events require an authenticated actor. The caller must either provide an actor via `authenticatedHumanActor({ id, displayName })` in the call parameters or wrap the execution in `sdk.runWithContext({ actor, tenant }, ...)`.

### Verified Fix
```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
  authenticatedPrincipal,
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

const actor = authenticatedHumanActor({ id: "actor-1", displayName: "User One" });
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

const principal = authenticatedPrincipal({
  type: "human_user",
  id: "principal-1",
});

const result = await sdk.sensitiveResourceViewed({
  actor,
  tenant,
  resource,
  authorization,
  request: { id: "req-1", method: "GET", route: "/docs/1" },
  authenticated_principal: principal,
});
```

---

## Exercise 2: Account Registration Without Tenant Context

### Expected Error
- **Error Code:** `MISSING_TENANT_CONTEXT`
- **Error Path:** `/tenant`
- **Category:** `validation`

### Diagnosis
Contract 2.1.0 requires an explicit tenant scope on registration events. Bind authoritative tenant context via `authoritativeTenant({ scope: "tenant", actor_tenant_id: ..., effective_tenant_id: ..., resource_tenant_id: ... })`.

### Verified Fix
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

const actor = authenticatedHumanActor({ id: "actor-1", displayName: "New User" });
const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "t-1",
  effective_tenant_id: "t-1",
  resource_tenant_id: "t-1",
});
const source = observedSource({ observed: { address: "198.51.100.5", port: 443 } });

const result = await sdk.accountRegistrationAttempted({
  actor,
  tenant,
  request: { id: "req-reg", method: "POST", route: "/register" },
  source,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000301",
    operation_id: "22222222-2222-4222-8222-000000000302",
  },
});
```

---

## Exercise 3: Premature Resource Creation Without Operation Handle

### Expected Error
- **Error Code:** `PREMATURE_SUCCESS`
- **Error Path:** `/operation/state`
- **Category:** `validation`

### Diagnosis
Modifications to sensitive resources must be guarded by an operation handle to guarantee transactional completion. Start an operation handle with `const op = sdk.beginOperation(...)`, perform the modification, mark it committed via `op.value.markCommitted()`, and supply `operation: op.value` when calling `sdk.sensitiveResourceCreated(...)`.

### Verified Fix
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

const op = sdk.beginOperation({
  operationId: "22222222-2222-4222-8222-000000000322",
  boundEvent: "sensitiveResourceCreated",
  transactional: true,
});
if (!op.ok) {
  throw new Error(`beginOperation failed: ${op.error.code}`);
}
op.value.markCommitted();

const result = await sdk.sensitiveResourceCreated({
  operation: op.value,
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

---

## Exercise 4: Authority Escalation With Plain Object

### Expected Error
- **Error Code:** `AUTHORITY_ESCALATION`
- **Error Path:** `/actor`
- **Category:** `authority`

### Diagnosis
Plain JavaScript objects and type casts cannot forge authoritative context. You must construct actors using the factory functions exported by `@bloodtrail/security-audit-sdk-core`: `authenticatedHumanActor` or `apiCredentialActor`.

### Verified Fix
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

const actor = authenticatedHumanActor({ id: "admin-1", displayName: "Real Admin" });
const tenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "t-1",
  effective_tenant_id: "t-1",
  resource_tenant_id: "t-1",
});

const source = observedSource({ observed: { address: "198.51.100.5", port: 443 } });

const result = await sdk.accountRegistrationAttempted({
  actor,
  tenant,
  request: { id: "req-esc", method: "POST", route: "/register" },
  source,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000331",
    operation_id: "22222222-2222-4222-8222-000000000332",
  },
});
```

---

## Exercise 5: Prohibited Cleartext Credential in Payload

### Expected Error
- **Error Code:** `PROHIBITED_DATA`
- **Error Path:** `/request/password`
- **Category:** `privacy`

### Diagnosis
The SDK automatically scans for prohibited credential keys and token patterns. Never pass raw passwords, secret tokens, or sensitive credentials into audit event payloads. Sanitize or strip credential properties before passing request metadata to the SDK.

### Verified Fix
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

const result = await sdk.passwordResetRequested({
  actor,
  tenant,
  request: {
    id: "req-pwd-reset",
    method: "POST",
    route: "/password-reset",
  },
  source,
  correlation: {
    correlation_id: "22222222-2222-4222-8222-000000000341",
    operation_id: "22222222-2222-4222-8222-000000000342",
  },
});
```
