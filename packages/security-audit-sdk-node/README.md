# @bloodtrail/security-audit-sdk-node

Provisional first-party Node.js platform binding for Bloodtrail security audit events.

## API Stability: Provisional and Unfrozen

> **PROVISIONAL STATUS NOTICE (PLAN-047):**
> The public API surface of this package is **explicitly provisional and unfrozen**. It is designed to implement concrete Node.js host capabilities for `@bloodtrail/security-audit-sdk-core` while the SDK vertical delivery contracts (#102–#109) are materialized. Final freezing of this surface is governed by issue #111.

## Overview

Following the platform-neutral extraction of `@bloodtrail/security-audit-sdk-core` (issue #86), this package supplies concrete Node.js built-in implementations of all Core platform Service Provider Interfaces (SPIs):

- **Clock (`nodeClock`):** Implements `AuditClock` using `new Date()`.
- **Identifiers (`nodeIdentifiers`):** Implements `AuditIdentifierProvider` using `node:crypto.randomUUID()`.
- **Byte Length (`nodeByteLength`):** Implements `AuditByteLengthProvider` using `Buffer.byteLength(val, "utf8")`.
- **Timers (`nodeTimers`):** Implements `AuditTimerProvider` supporting `unref()` handles without registering process signal handlers or recurring intervals.
- **Context (`nodeContextProvider`):** Implements `ContextProvider` using `node:async_hooks.AsyncLocalStorage` for strict asynchronous execution isolation.
- **Schema Runtime (`nodeSchemaRuntime`):** Implements `AuditSchemaRuntime` delegating to canonical contract schema validation.

## Package Boundaries

Per ADR 0009:
- Standalone workspace topology with dedicated `package.json` and `package-lock.json`.
- Private, unlicensed (`private: true`, `license: "UNLICENSED"`).
- **Zero third-party runtime dependencies**; depends strictly on first-party `@bloodtrail/security-audit-sdk-core`.
- Supported engines: Node `>=24 <25 || >=26 <27`.

## Usage

```typescript
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import { CONTRACT_VERSION } from "@bloodtrail/security-audit-sdk-core";

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { id: "auth-service", name: "Authentication Service" },
  service: { id: "auth-svc", name: "Auth Svc", version: "1.0.0" },
  environment: { name: "production", region: "us-east-1" },
  sink: {
    async emit(event) {
      // Custom sink emission logic
      return { ok: true, value: { eventId: event.event.id, status: "delivered" } };
    },
  },
});
```
