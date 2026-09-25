# Privacy and Data Protection Guidance

This document defines privacy principles, data sanitization obligations, and transformation hook integration for the `@bloodtrail/security-audit-sdk-node` evaluation alpha.

---

## 1. Identifiers Must Never Contain Secrets or Personal Data

Security audit events are designed to be immutable, verifiable records distributed across long-term retention and monitoring infrastructure. Consequently, **identifiers must never contain secrets, credentials, or unprotected personal data (PII)**.

Prohibited in identifier fields:
- Passwords, API tokens, session tokens, or bearer credentials.
- Raw personal data including email addresses, phone numbers, government identification numbers (e.g., SSN), credit card numbers, or physical addresses.
- Plaintext internal secrets or sensitive query parameters.

If an entity identifier is naturally derived from sensitive attributes (such as an email address or external account ID), it must be pseudonymous, anonymized, or cryptographically transformed before being passed to the SDK.

---

## 2. Contract 2.1.0 Transform-Required Fields

In the Bloodtrail event contract (version 2.1.0), specific fields are classified as `transform_required`. These fields represent identifiers or context attributes that carry privacy risk across organizational boundaries and must undergo cryptographic transformation or pseudonymization if exposed across trust domains.

The contract specifies the following 21 fields with policy `transform_required`:

| Field Path | Registry Family | Privacy Classification | Description |
| :--- | :--- | :--- | :--- |
| `tenant.actor_tenant_id` | `tenant_context` | `confidential` | Tenant ID associated with the initiating actor. |
| `tenant.effective_tenant_id` | `tenant_context` | `confidential` | Authoritative tenant ID executing the operation. |
| `tenant.resource_tenant_id` | `tenant_context` | `confidential` | Tenant ID owning target resources. |
| `tenant.parent_tenant_id` | `tenant_context` | `confidential` | Parent tenant hierarchy identifier. |
| `tenant.claimed_tenant_id` | `claimed_identity` | `restricted` | Unauthenticated caller claim of tenant identity. |
| `actor.id` | `authenticated_identity` | `confidential` | Primary authenticated identity identifier. |
| `actor.tenant_id` | `tenant_context` | `confidential` | Tenant boundary for the actor. |
| `subject.id` | `resource_context` | `confidential` | Target subject identifier for account/credential actions. |
| `subject.tenant_id` | `resource_context` | `confidential` | Tenant boundary for the target subject. |
| `authenticated_principal.id` | `authenticated_identity` | `confidential` | Underlying authenticated principal in delegation chains. |
| `delegation.principal_id` | `delegation_impersonation` | `confidential` | Intermediary principal performing delegated action. |
| `credential.reference` | `authenticated_identity` | `restricted` | Safe opaque reference to a credential (never raw material). |
| `session.id` | `authenticated_identity` | `restricted` | Opaque session identifier. |
| `authorization.resource_context.id` | `authorization_context` | `restricted` | Resource context evaluated during authorization. |
| `authorization.tenant_context.effective_tenant_id` | `authorization_context` | `restricted` | Tenant context evaluated during authorization. |
| `source.observed.address` | `network_observation` | `restricted` | Network client IP or observed peer network address. |
| `resource.id` | `resource_context` | `restricted` | Target resource identifier. |
| `resource.parent_id` | `resource_context` | `restricted` | Parent container or collection identifier. |
| `resource.owning_tenant_id` | `resource_context` | `restricted` | Tenant owner of the target resource. |
| `correlation.transaction_id` | `correlation_causality` | `restricted` | Business transaction correlation identifier. |
| `integrity.transport_authentication.peer` | `integrity_metadata` | `restricted` | Transport peer identity verified at edge. |

---

## 3. Registering a Transformation Hook

Transformation hooks allow producers to intercept transformable fields during event synthesis, applying cryptographic pseudonymization (e.g., HMAC-SHA256) or tokenization with controlled key material.

Hooks are configured via the `transformations` option when initializing `createNodeSecurityAuditSdk`.

### Transformation Hook Example

```typescript
import {
  createNodeSecurityAuditSdk,
  createHttpAuditSink,
} from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  type AuditFieldTransformationHook,
  type AuditTransformationInput,
} from "@bloodtrail/security-audit-sdk-core";
import { createHmac } from "node:crypto";

// Synthetic key material for HMAC-based pseudonymization
const SYNTHETIC_KEY_MATERIAL = "synthetic-evaluation-alpha-key-material-2026";

// Register an authoritative transformation hook for actor.id
const actorIdPseudonymizer: AuditFieldTransformationHook = {
  path: "actor.id",
  transform(input: AuditTransformationInput) {
    const hmac = createHmac("sha256", SYNTHETIC_KEY_MATERIAL);
    hmac.update(input.value);
    const digest = hmac.digest("hex").slice(0, 16);
    return {
      value: `pseudo-actor-${digest}`,
      key_id: "eval-synthetic-key-v1",
    };
  },
};

const sink = createHttpAuditSink({
  origin: "http://127.0.0.1:3000",
  path: "/v1/security-audit",
  timeoutMs: 5000,
  headers: {
    authorization: "Bearer eval-fixture-token",
  },
});

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "evaluation-producer", version: "1.0.0" },
  service: { name: "evaluation-service", version: "1.0.0" },
  environment: { name: "synthetic" },
  sink,
  transformations: [actorIdPseudonymizer],
});
```

When `sdk.recordAccountAuthenticationSuccess` or another named event method emits an event with an `actor.id`, the SDK automatically runs the registered hook before final serialization and schema validation, preserving audit integrity without leaking plain user identifiers.

---

## 4. Heuristic Prohibited-Data Value Scan

The SDK includes a built-in pre-emission scanner (`validateNoProhibitedData`) that checks event payloads for common sensitive tokens, prohibited object keys, and illicit data types.

### Scanner Behavior
- **Key Inspection:** Scans object property names for known prohibited terms (`password`, `secret`, `token`, `credential`, `private_key`).
- **Value Pattern Inspection:** Performs regular expression matching for well-known credential formats:
  - Private key headers (`BEGIN PRIVATE KEY`)
  - Common bearer token patterns (`Bearer [token]`, `sk-[key]`)
  - Hardcoded canary secret patterns

### Critical Limitation Notice
> **IMPORTANT:** The prohibited-data value scan is **heuristic and will not catch every secret**.
>
> The scanner cannot detect:
> - High-entropy arbitrary tokens without known prefixes.
> - Custom API keys, connection strings, or database URLs formatted irregularly.
> - Encrypted or base64-encoded secrets.
> - Personal identifiable data formatted as generic strings (e.g., plaintext emails, names, phone numbers).
>
> **The SDK is not a Data Loss Prevention (DLP) engine.** Calling applications are strictly responsible for sanitizing input data and ensuring no unauthorized secrets or PII enter the audit pipeline.
