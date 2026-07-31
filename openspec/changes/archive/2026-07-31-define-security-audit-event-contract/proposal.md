## Why

Bloodtrail does not yet have one authoritative contract for security- and business-relevant audit events. Defining that server-generated contract before any SDK, collector, storage, analytics, or production instrumentation prevents each producer from inventing incompatible semantics, trusting client claims, or leaking sensitive data.

This change establishes the reviewable semantic and governance boundary now, while no runtime implementation constrains the design. It keeps audit evidence distinct from diagnostic logs, observability telemetry, browser analytics, threat-detection rules, and SIEM-specific schemas.

## What Changes

### Problem and motivation

Bloodtrail needs consistent records for authentication and session activity, authorization decisions, privilege and administrative changes, sensitive-resource access, security-configuration changes, fraud-relevant business operations, multi-tenant activity, and distributed-service correlation. Without a canonical contract, producers and consumers can disagree about who acted, which tenant and resource were involved, whether authorization was granted, whether an operation committed, what information is trustworthy, and how an event may be delivered or retained.

### Scope

- Define the authoritative server-generated security audit event contract and its canonical envelope.
- Define field authority, provenance, trust, validation, enrichment, privacy, redaction, retention, and enforcement-use rules.
- Define actor, subject, authenticated principal, delegation/impersonation, credential, service/workload, session, tenant, resource, action, authentication, authorization, outcome, correlation, causality, risk, integrity, and extension semantics.
- Define controlled event/action vocabularies and an initial security audit event catalog.
- Define schema ownership, versioning, compatibility, deprecation, extension namespaces, machine-readable validation, examples, and negative examples.
- Define different delivery classes and their idempotency, retry, buffering, outage, backpressure, shutdown, fail-open/fail-closed, deferred-completion, and operator-alerting expectations.
- Define interoperability boundaries and testable mappings for OCSF, OpenTelemetry, and, if justified, CloudEvents without making a vendor or SIEM schema the application-facing source of truth.
- Define integrity claims the contract can support and the claims it cannot support about completeness, ordering, truthful application state, or non-repudiation.

### Non-goals

This change does **not** implement or authorize:

- a Node.js or TypeScript SDK, framework middleware, or production runtime behavior;
- OpenTelemetry exporters, collectors, Kafka or queue infrastructure, transactional-outbox infrastructure, storage, SIEM integration, dashboards, or fraud/threat-detection rules;
- browser telemetry, frontend analytics, metrics, traces, or general diagnostic logging;
- production instrumentation, cryptographic log chaining, or a claim of legal/regulatory compliance;
- one universal delivery guarantee for every event;
- client-reported identity, device identity, authentication evidence, or proof of human activity as authoritative evidence.

All implementation and production-integration work requires later OpenSpec changes after this contract is approved.

### Stakeholders

- Bloodtrail project owner and maintainer, as contract owner and final approver;
- future application and platform teams that produce, transport, validate, store, or consume audit events;
- security, fraud, incident-response, privacy, and tenant-administration consumers;
- future SDK maintainers and schema-mapping maintainers.

Bloodtrail is currently a personal open-source project. References to teams describe future responsibility boundaries, not existing organizational staffing or production architecture. Project-owner approval is documented project governance, not independent assurance, certification, legal advice, or organizational approval.

### Value

- Stable application semantics before SDK and infrastructure choices become expensive to reverse.
- Explicit separation of authoritative server facts from claims and downstream enrichment.
- Consistent multi-tenant attribution, authorization evidence, outcomes, and distributed causality.
- Privacy-by-contract controls that reject secrets and constrain high-risk fields before ingestion.
- Portable mappings to external ecosystems without coupling producers to one transport, collector, SIEM, or vendor.
- Testable compatibility and misuse-resistance requirements for future implementations.

### Alternatives considered

- **Let each service emit its own JSON:** rejected because semantic drift, uncontrolled vocabulary, inconsistent trust, and privacy failures would become consumer problems.
- **Use OCSF directly as the internal application contract:** retained as an unresolved comparison, but not selected without proving that its category/class model preserves Bloodtrail actor, tenant, authorization, causality, delivery, and application-domain semantics.
- **Use OpenTelemetry Logs as the canonical schema:** retained as a transport/mapping option, but the log data model alone does not decide Bloodtrail event authority, vocabulary, privacy policy, or delivery class.
- **Use CloudEvents as the canonical schema:** retained as an envelope option, but its context attributes do not by themselves define the security audit data model.
- **Implement the SDK first and infer the contract from code:** rejected because implementation convenience would silently choose security, privacy, versioning, and reliability semantics.
- **Adopt a SIEM/vendor schema:** rejected as the application-facing source of truth because it would couple producers to a downstream product and may lose domain semantics.

### Risks

- An envelope that is too broad could encourage arbitrary data capture; allowlists, size limits, typed extensions, and prohibited-field validation must constrain it.
- An envelope that is too narrow could force incompatible extensions; the design must define governed extension namespaces and evolution rules.
- Incorrect authority labels could allow user-controlled values to influence enforcement or investigations.
- Ambiguous success, authorization, and transaction timing could create false evidence about committed state.
- Strong delivery guarantees could harm availability if applied indiscriminately; weak guarantees could omit critical evidence.
- Interoperability claims could exceed tested mappings or change as external standards evolve.
- Audit data may contain personal or sensitive information; approval of this contract does not establish a legal basis, retention schedule, or production authorization.

### Success criteria

The proposal is successful when the approved contract:

1. defines every required semantic area with normative, testable requirements;
2. provides a field-authority matrix and initial event catalog with controlled names and actions;
3. identifies user-controlled and client-reported data and prevents it from becoming authoritative by relabeling;
4. separates authorization decision, attempted action, committed business outcome, asynchronous completion, compensation, and rollback;
5. defines a machine-readable schema strategy, compatibility policy, examples, negative examples, and CI/runtime/ingestion validation responsibilities;
6. defines privacy-field policy and rejects prohibited secret or payload content;
7. assigns explicit delivery classes rather than one universal policy;
8. documents integrity and completeness limitations without overstating signing or producer trust;
9. defines bounded, testable OCSF and OpenTelemetry mappings and resolves whether CloudEvents is used as an envelope;
10. leaves no basic event-semantics decision for a future SDK change to invent silently.

### Relationship to future SDK work

A later change such as `implement-security-audit-sdk-core` may generate or consume TypeScript types, validators, catalog constants, and producer APIs from the approved machine-readable contract. That later change must implement this contract rather than reopen its basic semantics, and it must separately justify runtime dependencies, middleware, transports, buffering, delivery mechanisms, and production instrumentation.

## Capabilities

### New Capabilities

- `security-audit-event-contract`: Authoritative server-side security audit event semantics, trust and tenant boundaries, canonical envelope, controlled catalog, privacy and validation policy, schema governance, interoperability mappings, integrity limitations, and delivery-class expectations.

### Modified Capabilities

None. The repository has no existing OpenSpec capability specifications to modify.

## Impact

This proposal affects only OpenSpec planning artifacts and future contract artifacts explicitly created by its tasks, such as a canonical machine-readable schema, catalog, mapping documents, examples, and compatibility tests. It introduces a new internally observable platform contract for future producers and consumers but changes no current code, API, dependency, service, infrastructure, customer traffic, or production behavior.

No existing production architecture is assumed. Producer, collector, ingestion, storage, and consumer responsibilities remain logical boundaries until separately approved implementation changes define concrete components.
