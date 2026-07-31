# Project-owner authorization to apply the SDK-core change

- **Decision:** Authorize implementation of the objectively verifiable tasks in the OpenSpec change `implement-security-audit-sdk-core`.
- **Project owner:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Date:** July 31, 2026
- **Proposal baseline:** `94dc6e3bcc74beecd1fca2832948b139167fdd3b`
- **Authoritative contract:** Bloodtrail Security Audit Event Contract version `1.0.0`
- **Normative technical contract target:** `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993`

## Authorized implementation

This authorization permits implementation of an isolated, framework-independent Node.js and TypeScript SDK core, including:

- contract-derived TypeScript generation;
- runtime schema and semantic validation;
- authority-specific context models;
- `AsyncLocalStorage` context propagation;
- named builders for the 24 approved event types;
- transaction-aware operation handling;
- prohibited-data and extension enforcement;
- safe structured errors;
- transport-neutral sink interfaces;
- in-memory and capturing test sinks;
- development-time generation and validation tooling;
- unit, integration, fixture, compatibility, and compile-time tests;
- SDK documentation and architecture decision records.

The implementation must conform to contract version `1.0.0` and must not modify or silently reinterpret the approved contract.

## Explicit exclusions

This authorization does not permit:

- production deployment;
- production event collection;
- real-user data processing;
- application or framework instrumentation;
- Express, Fastify, NestJS, or other middleware;
- OpenTelemetry or OTLP export;
- Kafka, queues, transactional outboxes, or durable delivery;
- collector infrastructure;
- storage or SIEM integration;
- detection rules or analytics;
- browser telemetry;
- cryptographic audit-log chaining;
- changes to approved contract semantics hidden inside the SDK implementation.

A genuine defect in Security Audit Event Contract version `1.0.0` must use a separate contract-governance change rather than being silently corrected by the SDK.

## Lifecycle boundary

This decision authorizes the implementation phase only. It is not final SDK approval and does not authorize production use. Implementation must stop before final owner approval, merge, production authorization, or archival. The final technical implementation commit—not the proposal baseline—must be the SDK review target.
