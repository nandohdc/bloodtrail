# Supported versus Planned Capabilities

This document provides a clear, authoritative separation between capabilities supported in the `@bloodtrail/security-audit-sdk-node` evaluation alpha and planned features reserved for future releases.

---

## 1. Supported vs Planned Feature Matrix

| Domain / Feature | Evaluation Alpha Status | Implementation Details & Architectural Boundary |
| :--- | :--- | :--- |
| **Contract 2.1.0 Named Events** | **Supported** | All 24 named audit event methods implemented in `@bloodtrail/security-audit-sdk-core` with authoritative context, schema verification, and lifecycle states. |
| **Node.js Platform Runtime** | **Supported** | First-party `@bloodtrail/security-audit-sdk-node` binding, providing `createNodeSecurityAuditSdk`, `nodeContextProvider` (backed by `node:async_hooks`), and unref-safe shutdown timers. |
| **HTTP Delivery Sink** | **Supported** | `createHttpAuditSink` and `createFetchHttpExchange` for direct HTTP/1.1 POST delivery to an ingestion endpoint with bearer token authorization and timeout bounds. |
| **Authoritative Context Binding** | **Supported** | Request-scoped context isolation across asynchronous promises (`AsyncLocalStorage`), preventing cross-request identity leaks. |
| **In-Memory Delivery Primitives** | **Supported** | Ephemeral, in-memory retry (`createBoundedDeliveryRetry`) and backpressure concurrency limiting (`createBoundedDeliveryBackpressure`) for demonstration and bounded testing. |
| **OCSF Export** | **Planned (Not Implemented)** | Open Cybersecurity Schema Framework (OCSF) v1.1+ schema mapping and automatic event export. The Contract 2.1.0 specification documents mapping rules, but no runtime exporter exists in the evaluation alpha. |
| **OpenTelemetry Transport** | **Planned (Not Implemented)** | Native OpenTelemetry OTLP trace and log transport integration. Events cannot currently be exported directly via OpenTelemetry collectors or gRPC/OTLP channels without custom sink code. |
| **CloudEvents Envelopes** | **Planned (Not Implemented)** | Standard CloudEvents v1.0 JSON event wrapping. The evaluation alpha emits native Bloodtrail Contract 2.1.0 event envelopes only. |
| **Durable Retries** | **Planned (Not Implemented)** | Out-of-process, crash-resilient durable retries with disk spooling or persistent backing stores. The evaluation alpha provides only in-memory retry bounded within process lifecycle. |
| **Persistent Queues & Buffers** | **Planned (Not Implemented)** | Distributed queue integration (e.g., Apache Kafka, AWS SQS, RabbitMQ, Redis Streams). The evaluation alpha includes no durable queuing or disk buffering. |
| **Framework Adapters** | **Planned (Not Implemented)** | Automatic middleware plugins for web frameworks (e.g., Express, Fastify, Next.js, NestJS, Koa). Evaluators must manually bind request lifecycle and invoke SDK methods within existing handlers. |

---

## 2. Evaluation Alpha Envelope Boundaries

To ensure safe and bounded evaluation during the alpha program:

1. **No Planned Feature is Implemented in Alpha:**
   Features marked as "Planned" are explicitly out of scope for the evaluation alpha release. Evaluators should not attempt to locate, configure, or rely upon OCSF exporters, OpenTelemetry wire protocols, CloudEvents formatters, disk-backed queuing, or framework-level middleware automations.

2. **Non-Production Testing Envelope:**
   The evaluation alpha is intended strictly for local development, architectural evaluation, and synthetic testing. It does not carry production delivery guarantees or durable persistence semantics.

3. **Sink Extension Points:**
   While framework adapters and durable queues are planned for subsequent milestones, the SDK provides the standard `AuditEventSink` and `HttpExchange` interfaces if evaluators wish to experiment with custom in-house routing.
