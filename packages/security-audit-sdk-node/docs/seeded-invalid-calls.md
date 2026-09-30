# Seeded Invalid-Call Diagnostic Exercise

This exercise measures evaluation metric **M3: Diagnosis of 5 seeded invalid calls from the error output and catalog alone**.

---

## Exercise Rules (Metric M3)

1. **Information Sources:** You must diagnose each failure using **only** the SDK's returned `SafeAuditError` error output (its `code`, `category`, and `path`) and `docs/error-catalog.md`.
2. **Unassisted:** Do not consult external search engines, AI assistants, or project facilitators during the exercise.
3. **Target Threshold:** To pass M3, an evaluator must correctly diagnose at least 4 out of the 5 failures.
4. **Recording:** Record your diagnosis and proposed remediation for each call in `docs/evaluation-questionnaire.md`.

---

## Error Output Structure

When an SDK operation is rejected by validation or authority checks, named methods return an `AuditResult` failure (`{ ok: false, error }`). The error shape is the exported `SafeAuditError`:

```typescript
import type { AuditErrorCategory } from "@bloodtrail/security-audit-sdk-core";

export interface SafeAuditError {
  readonly code: string;
  readonly category: AuditErrorCategory;
  readonly path?: string;
  readonly eventName?: string;
  readonly eventId?: string;
}
```

Use `error.code` and `error.path` to look up the entry in `docs/error-catalog.md`.

---

## Exercise 1: Sensitive Resource Viewed Without Actor

An engineer attempts to record a sensitive resource view without binding an actor in context or supplying one in parameters:

```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
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

// Invalid Call: No actor bound in context or supplied in parameters
const result = await (sdk.sensitiveResourceViewed as Function)({
  tenant,
  resource,
  authorization,
  request: { id: "req-1", method: "GET", route: "/docs/1" },
  authenticated_principal: principal,
});
```

---

## Exercise 2: Account Registration Without Tenant Context

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

---

## Exercise 3: Premature Resource Creation Without Operation Handle

An engineer emits `sensitiveResourceCreated` without providing an operation handle:

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

---

## Exercise 4: Authority Escalation With Plain Object

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

---

## Exercise 5: Prohibited Cleartext Credential in Payload

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
