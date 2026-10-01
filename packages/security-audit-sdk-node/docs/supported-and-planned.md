# Supported versus Planned Capabilities

This document provides a clear, authoritative separation between capabilities supported in the `@bloodtrail/security-audit-sdk-node` evaluation alpha and planned features reserved for future releases.

---

## 1. Supported vs Planned Feature Matrix

| Domain / Feature | Evaluation Alpha Status | Implementation Details & Architectural Boundary |
| :--- | :--- | :--- |
| **Contract 2.1.0 Named Events** | **Supported** | All 24 named audit event methods implemented in `@bloodtrail/security-audit-sdk-core` with authoritative context, schema verification, and lifecycle states. |
| **Node.js Platform Runtime** | **Supported** | First-party `@bloodtrail/security-audit-sdk-node` binding, providing `createNodeSecurityAuditSdk`, `nodeContextProvider` (backed by `node:async_hooks`), and unref-safe shutdown timers. |
| **HTTP Delivery Sink** | **Supported** | `createHttpAuditSink`, over `createFetchHttpExchange`: one HTTP `POST` attempt per event to an ingestion endpoint, with caller-owned headers such as a bearer token, and a timeout bound. This is the alpha's whole delivery guarantee: one attempt, no retry, no queue, no ordering, and no delivery-class conformance. |
| **Authoritative Context Binding** | **Supported** | Request-scoped context isolation across asynchronous promises (`AsyncLocalStorage`), preventing cross-request identity leaks. |
| **Bounded Delivery Retry** (`createBoundedDeliveryRetry`) | **Frozen export, outside the evaluated path** | An in-process, bounded retry schedule over the single-attempt handoff. The HTTP audit sink does not use it, and the evaluation does not exercise it. It is not the alpha's delivery. |
| **Bounded Delivery Backpressure** (`createBoundedDeliveryBackpressure`) | **Frozen export, outside the evaluated path** | An in-flight capacity gate for any async delivery operation. The HTTP audit sink does not use it, and the evaluation does not exercise it. |
| **OCSF Export** | **Planned (Not Implemented)** | Open Cybersecurity Schema Framework (OCSF) v1.1+ schema mapping and automatic event export. The Contract 2.1.0 specification documents mapping rules, but no runtime exporter exists in the evaluation alpha. |
| **OpenTelemetry Transport** | **Planned (Not Implemented)** | Native OpenTelemetry OTLP trace and log transport integration. Events cannot currently be exported directly via OpenTelemetry collectors or gRPC/OTLP channels without custom sink code. |
| **CloudEvents Envelopes** | **Planned (Not Implemented)** | Standard CloudEvents v1.0 JSON event wrapping. The evaluation alpha emits native Bloodtrail Contract 2.1.0 event envelopes only. |
| **Retries** | **Planned (Not Implemented)** | Retrying a failed delivery, in process or durably across a crash or restart. The alpha's delivery makes one attempt per event and never retries. The bounded retry primitive above is outside the evaluated path. |
| **Persistent Queues & Buffers** | **Planned (Not Implemented)** | Distributed queue integration (e.g., Apache Kafka, AWS SQS, RabbitMQ, Redis Streams). The evaluation alpha includes no durable queuing or disk buffering. |
| **Framework Adapters** | **Planned (Not Implemented)** | Automatic middleware plugins for web frameworks (e.g., Express, Fastify, Next.js, NestJS, Koa). Evaluators must manually bind request lifecycle and invoke SDK methods within existing handlers. |

---

## 2. Evaluation Alpha Envelope Boundaries

To ensure safe and bounded evaluation during the alpha program:

1. **No Planned Feature is Implemented in Alpha:**
   Features marked as "Planned" are explicitly out of scope for the evaluation alpha release. Evaluators should not attempt to locate, configure, or rely upon OCSF exporters, OpenTelemetry wire protocols, CloudEvents formatters, disk-backed queuing, or framework-level middleware automations.

2. **One Delivery Attempt:**
   The alpha delivers each event in one attempt. It does not retry, queue or order events, and it makes no delivery-class conformance claim. A delivery that fails is reported to the caller and not tried again.

3. **Non-Production Testing Envelope:**
   The evaluation alpha is intended strictly for local development, architectural evaluation, and synthetic testing. It does not carry production delivery guarantees or durable persistence semantics.

4. **Sink Extension Points:**
   While framework adapters and durable queues are planned for subsequent milestones, the SDK provides the standard `AuditEventSink` and `HttpExchange` interfaces if evaluators wish to experiment with custom in-house routing.
