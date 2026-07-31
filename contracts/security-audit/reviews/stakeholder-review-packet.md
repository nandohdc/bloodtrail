# Security Audit Event Contract Stakeholder Review Packet

## Review target

- Contract commit reviewed: `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993` (Contract Commit A)
- Review packet prepared: 2026-07-31
- Contract version: 1.0.0
- Contract status at review request: proposed, not approved
- OpenSpec progress at review request: 68/72

The proposal commit is not the review target. Contract Commit A is the exact commit that contains the machine-readable contract and technical evidence.

## Material to review

The review covers the following material exactly as stored in Contract Commit A under `contracts/security-audit/`:

- authoritative source: `source/contract.source.json`;
- Draft 2020-12 schema: `schema/security-audit-event.schema.json`;
- controlled registries and 24-event catalog: `registries/registries.json` and `catalog/catalog.json`;
- field-authority and privacy policy: `policies/field-policy.json` and generated policy/authority documentation;
- delivery-class, integrity, compatibility, and migration contracts and fixtures;
- OCSF 1.8.0, OpenTelemetry Specification 1.59.0 / Semantic Conventions 1.43.0, and optional CloudEvents 1.0.2 mappings and conflict fixtures;
- eight ADRs in `adr/`;
- all positive and negative examples;
- deterministic artifact generator, semantic validator, AJV-based Draft 2020-12 test harness, and package lockfile;
- human-readable documentation in `docs/` and the package `README.md`;
- OpenSpec proposal, design, specification, and tasks for `define-security-audit-event-contract`.

## Evidence versions

The authoritative source records the retrieval date, source URL, normative scope, support classification, and Bloodtrail design decision for:

- NIST SP 800-53 Release 5.2.0 AU controls;
- OCSF 1.8.0;
- OpenTelemetry Specification 1.59.0;
- OpenTelemetry Semantic Conventions 1.43.0;
- CloudEvents 1.0.2;
- W3C Trace Context Recommendation 2021;
- JSON Schema Draft 2020-12;
- Semantic Versioning 2.0.0;
- OWASP Logging Cheat Sheet.

## Technical verification supplied to the reviewer

Before Contract Commit A was staged:

- deterministic generation confirmed 79 generated artifacts were current;
- the semantic validator passed;
- a standards-compliant AJV Draft 2020-12 engine accepted all 24 positive fixtures;
- all 21 negative fixtures failed with their exact bounded safe error codes;
- catalog, field-authority, privacy-policy, controlled-registry, mapping, compatibility, delivery, and integrity coverage checks passed;
- strict OpenSpec validation, npm audit, Git whitespace, final-newline, exact changed-path, and production-scope checks passed;
- tasks 11.3–11.6 remained unchecked;
- no production SDK or runtime implementation was present.

This technical verification is evidence for review. It is not stakeholder approval or independent assurance.

## Required project-owner review scope

The project owner must review at least:

- event semantics and lifecycle/operation outcome separation;
- identity, credential, delegation, impersonation, tenant, and resource authority;
- privacy policy, prohibited data, transformations, retention, and future qualified-review gates;
- controlled vocabularies and catalog ownership;
- delivery classes and unapproved policy-critical failure postures;
- integrity claims and explicit limitations;
- schema compatibility and migration policy;
- OCSF, OpenTelemetry, and CloudEvents mapping boundaries and losses;
- unresolved implementation decisions;
- production and SDK implementation blockers.

## Unresolved decisions and conditions before future production work

- Exact policy-critical fail-open, fail-closed, or deferred-completion postures remain unapproved.
- Actual retention durations, residency, deletion, legal-hold, tenant/platform access, cross-tenant access, and external-export policy require later qualified review where applicable.
- Runtime SDK architecture, framework integration, transport, buffering, queue/outbox, storage, operational alerting, and deployment are outside this contract change.
- Cryptographic chaining and browser telemetry are outside scope.
- Contract approval, if granted, does not authorize production data collection or deployment.

## Project-owner feedback and decision

- Reviewer: Fernando Homem da Costa (`nandohdc`), Bloodtrail project owner and implementer
- Role: project owner and implementer
- Review type: project-owner self-review
- Date: 2026-07-31
- Commit reviewed: `8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993` (Contract Commit A)
- Decision: approve Bloodtrail Security Audit Event Contract version 1.0.0 as the authoritative design basis for future Bloodtrail security-audit instrumentation and SDK development
- Requested technical changes: none
- Conditions: approval is limited to the contract as a design basis and grants none of the production, real-user-data, runtime, SDK, infrastructure, integration, analytics, cryptographic-chaining, or browser-telemetry authorizations listed below
- Concerns: no blocking contradiction, unsupported requirement, or required technical correction was identified
- Reconfirmation: Contract Commit A is explicitly reconfirmed because no normative technical material changed after review

The project-owner review covered:

- the canonical audit-event envelope;
- actor, subject, principal, credential, delegation, and impersonation semantics;
- tenant attribution and cross-tenant validation;
- resource, action, outcome, and transaction-state semantics;
- authentication and authorization contexts;
- correlation, causation, retry, redelivery, and asynchronous-workflow semantics;
- controlled registries and the event catalog;
- field authority, provenance, privacy, retention, and redaction policies;
- schema validation, compatibility, evolution, and deprecation rules;
- delivery classes and their required guarantees;
- integrity and trust limitations;
- OCSF, OpenTelemetry, and CloudEvents mapping boundaries;
- positive and negative examples;
- architecture decision records; and
- production and SDK authorization blockers.

The owner found that the contract adequately preserves these boundaries:

- client-provided identity or tenant claims are not authoritative;
- authorization decisions are distinct from business-operation outcomes;
- transactional success requires committed state;
- retry, redelivery, and asynchronous causality remain distinguishable;
- secrets, tokens, credentials, arbitrary payload objects, and unsafe transport overrides are prohibited;
- delivery requirements vary by event class;
- cryptographic or transport protection does not establish event truthfulness or completeness;
- Bloodtrail owns the canonical application-facing model;
- OCSF is a downstream mapping;
- OpenTelemetry is an optional transport representation; and
- CloudEvents is optional envelope support.

No technical changes were requested or required. The full read-only verification must be rerun before the governance record is committed. Because the reviewed normative contract remains byte-for-byte the contract in Contract Commit A, the owner explicitly reconfirms Contract Commit A rather than approving an obsolete or later administrative commit.

## Final contract decision

Bloodtrail Security Audit Event Contract version 1.0.0 is approved as the authoritative design basis for a future, separately reviewed SDK change.

This approval does not authorize production instrumentation, runtime data collection, Node.js or TypeScript SDK deployment, framework middleware, exporters, collectors, brokers, queues, transactional outboxes, storage, SIEM integration, analytics, detection rules, production delivery policies, cryptographic audit-log chaining, browser telemetry, or any processing of real-user data.

The following remain unresolved and must be decided before relevant production use:

- retention durations;
- data residency;
- legal-hold handling;
- policy-critical failure posture;
- alert and backlog thresholds;
- concrete infrastructure products;
- released-schema removal windows; and
- applicable privacy and legal requirements.

A separate reviewed OpenSpec change may propose `implement-security-audit-sdk-core`. That future change must implement version 1.0.0 without silently changing its semantics. Any required contract change must first follow the contract's schema-governance and compatibility process.

## Assurance limitation

This review is to be performed by the project owner and implementer. It documents project governance but does not constitute independent security, privacy, legal, or technical assurance. It is not certification, legal advice, privacy-law approval, or organizational approval.

## Authorization boundary

Current contract approval: yes, version 1.0.0 as the design basis, bound to Contract Commit A (`8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993`).

Current production authorization: none.

Current SDK implementation authorization: none.

This approval establishes the canonical contract as the design basis for a separate SDK change. It does not authorize production instrumentation, data collection, delivery infrastructure, storage, SIEM integration, analytics, or runtime SDK deployment.

## Administrative storage note

The later governance-record commit stores this already-issued owner decision, updates task status, and separates this hand-authored packet from deterministic technical generation. It does not replace the reviewed commit, alter the canonical contract, change technical evidence or findings, or expand any authorization boundary.
