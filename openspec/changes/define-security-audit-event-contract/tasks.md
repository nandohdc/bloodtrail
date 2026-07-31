## 1. Research and standards comparison

- [x] 1.1 Create a version-pinned primary-source evidence index for NIST SP 800-53 AU controls, OCSF, OpenTelemetry Logs and semantic conventions, CloudEvents, W3C Trace Context, JSON Schema, Semantic Versioning, and OWASP logging guidance; record retrieval date, normative scope, and source URL.
- [x] 1.2 Produce a standards comparison matrix showing which required Bloodtrail semantics each source defines, partially supports, or leaves to the application, without treating guidance as a mandatory external requirement.
- [x] 1.3 Compare the canonical envelope and initial event catalog against OCSF 1.8.0 categories, classes, profiles, objects, status semantics, extensions, and versioning; identify exact matches, extensions, losses, and unresolved gaps.
- [x] 1.4 Compare the canonical model against OpenTelemetry Specification 1.59.0 and Semantic Conventions 1.43.0, including occurrence/observation time, EventName, Resource, InstrumentationScope, Attributes, Body, trace/span fields, privacy, and mapping losses.
- [x] 1.5 Compare CloudEvents 1.0.2 envelope semantics and W3C Trace Context propagation with Bloodtrail event identity, source, type, schema, timestamp, causality, duplicate, trust-boundary, security, and privacy requirements.
- [x] 1.6 Record evidence-backed conclusions and evidence gaps; label recommendations and assumptions separately from facts established by the cited standards.

## 2. Architecture decision records

- [x] 2.1 Complete ADR-001 for a Bloodtrail-owned canonical model versus direct OCSF, including OCSF mapping scope, extension policy, version pin, and acceptable-loss criteria.
- [x] 2.2 Complete ADR-002 for the authoritative schema source, repository layout, JSON Schema dialect or justified equivalent, stable schema URI layout, deterministic generation, and human/machine drift controls.
- [x] 2.3 Complete ADR-003 for event, request, message, operation, transaction, correlation, causation, and original-event identifier formats; retry numbering; timestamp precision; clock-skew policy; and W3C trace-boundary behavior.
- [x] 2.4 Complete ADR-004 for OpenTelemetry representation, Body-versus-Attributes duplication/precedence, native Resource/InstrumentationScope use, and the decision that CloudEvents is optional unless primary evidence justifies a change.
- [x] 2.5 Complete ADR-005 for delivery-class semantics, durability points, idempotency, duplicate handling, buffering, retry, backpressure, shutdown, outage, local queueing, operator alerts, and event-specific fail-open/fail-closed/deferred-completion policy.
- [x] 2.6 Complete ADR-006 for field privacy policy, direct versus transformed identifiers, purpose/tenant-scoped keyed hashing, key-version metadata, retention classes, tenant access, export redaction, and policy assignments that remain blocked pending qualified review.
- [x] 2.7 Complete ADR-007 for actor, authenticated principal, delegation/impersonation, service/workload, credential, tenant hierarchy, cross-tenant/platform, resource-owner, and claimed-value authority rules.
- [x] 2.8 Complete ADR-008 for schema-versioning rules and schema/catalog ownership, Semantic Versioning interpretation, producer/consumer compatibility, additive enum/catalog behavior, extension namespaces, deprecation windows, migration, and unsupported-version handling.

## 3. Canonical contract source and envelope

- [x] 3.1 Create the repository-owned security-audit contract package and designate exactly one authoritative schema/catalog source with deterministic generated-artifact provenance.
- [x] 3.2 Define every canonical envelope field with type, format, cardinality, required/conditional status, authority, trust, allowed source/value, maximum size, privacy classification, validation result, redaction/transformation, and compatibility behavior.
- [x] 3.3 Define the trust-level registry and field-authority matrix, including claimed, authenticated, delegated, impersonated, service/workload, observed-network, client-reported, server-derived, and downstream-enrichment values and their enforcement eligibility.
- [x] 3.4 Define actor, subject, authenticated principal, credential reference, initiator, delegation, impersonation, background job, scheduled process, and external integration structures and invariants.
- [x] 3.5 Define actor tenant, effective tenant, resource-owning tenant, hierarchy, parent/child organization, cross-tenant administration, platform administration, tenantless events, claimed tenant, and conflict-resolution invariants.
- [x] 3.6 Define protected-resource, parent-resource, resource-owner, data-classification, action, operation-type, bulk, export, administration, and security-configuration structures and governed vocabularies.
- [x] 3.7 Define lifecycle phase, outcome, outcome reason, commit state, attempt/completion, asynchronous completion, partial result, cancellation, compensation, and rollback invariants independently from authorization decision.
- [x] 3.8 Define authentication and session contexts, assurance/MFA/credential semantics, recovery/failure taxonomy, and secret-free identifier rules.
- [x] 3.9 Define authorization decision, policy identity/version, capability, enforcement point, reason, tenant/resource context, override, break-glass, and policy-engine correlation semantics.
- [x] 3.10 Define W3C trace/span, request, message, correlation, causation, operation, transaction, retry, and original-event relationships for synchronous, asynchronous, queue, job, retry, fan-out, and multi-step workflows.
- [x] 3.11 Define risk, data classification, retention, integrity-attestation, transport-authentication, and extension structures with bounded claims and non-escalating provenance.

## 4. Machine-readable schema and TypeScript strategy

- [x] 4.1 Implement the canonical JSON Schema or approved equivalent, including stable `$id`/dialect metadata, strict object shapes, formats, bounds, required fields, controlled values, and registered extension namespaces.
- [x] 4.2 Encode catalog-dependent and cross-field constraints where the schema technology supports them and define deterministic semantic-validator rules for authority, tenant/resource consistency, lifecycle/commit combinations, producer identity, and other non-structural invariants.
- [x] 4.3 Define bounded, machine-readable validation error codes that never echo prohibited values or unbounded payload content.
- [x] 4.4 Document a deterministic TypeScript type-generation strategy from the authoritative contract, including generated-file verification and the boundary between compile-time help and runtime validation, without implementing the SDK.
- [x] 4.5 Verify that the schema and type-generation strategy remain language- and transport-neutral and introduce no production TypeScript, JavaScript, middleware, exporter, collector, or instrumentation code.

## 5. Initial event catalog and vocabularies

- [x] 5.1 Create governed registries for event names, categories, actions, actor/resource/operation types, outcomes, lifecycle/commit states, trust levels, reason codes, data/retention classes, delivery classes, and extension namespaces.
- [x] 5.2 Define catalog entries for account registration attempted/completed, authentication succeeded/failed, MFA enrolled/removed, session created/revoked, and password reset requested/completed.
- [x] 5.3 Define catalog entries for authorization allowed/denied, role assigned/removed, privilege elevated, and administrative impersonation started/ended.
- [x] 5.4 Define catalog entries for sensitive resource viewed/created/modified/deleted, sensitive data exported, security configuration changed, and tenant context violation detected.
- [x] 5.5 For every catalog entry, record purpose, trigger and lifecycle phase, required/conditional fields, authoritative producer boundary, actor/tenant/resource/authentication/authorization rules, outcomes/reasons, privacy and retention concerns, delivery class, investigation value, and mapping status.
- [x] 5.6 Add catalog conformance checks proving that every minimum event semantic has exactly one active stable name and complete metadata and that no dynamic or unregistered name/action is accepted.

## 6. Privacy, redaction, and tenant-access policy

- [x] 6.1 Create a complete per-field policy using `allowed`, `conditionally_allowed`, `transform_required`, or `prohibited`, with purpose, privacy classification, retention class, tenant-access boundary, redaction, display, and export rules.
- [x] 6.2 Prohibit passwords, verifier material, raw tokens, API/private keys, session cookies, recovery codes, factor contents, payment-card data, raw secrets, full request/response bodies by default, arbitrary serialized objects, connection strings, and unnecessary high-entropy client attributes in fields, extensions, examples, diagnostics, and mappings.
- [x] 6.3 Define minimization and transformation profiles for observed IP addresses, user agents, email addresses, phone numbers, business identifiers, account/session/credential references, and cross-tenant correlation.
- [x] 6.4 Define purpose- and tenant-scoped keyed-hashing requirements, key rotation/version metadata, direct-identifier exceptions, and a prohibition on representing plain hashes of guessable identifiers as adequate pseudonymization.
- [x] 6.5 Define retention-class semantics and the approval process for actual durations, residency, deletion, legal hold, platform access, cross-tenant access, and external export; leave policy-critical production use blocked where qualified review is missing.
- [x] 6.6 Add automated coverage checks proving that every canonical and extension field has a policy and that no field silently defaults to allowed.

## 7. Validation and misuse resistance

- [x] 7.1 Document compile-time, producer-runtime, CI, ingestion-time, and downstream validation responsibilities and prove that TypeScript types do not replace runtime boundary checks.
- [x] 7.2 Implement contract validation tooling for structural schema, semantic invariants, registry/catalog membership, authority/provenance, tenant/resource consistency, privacy policy, bounds, and transport/payload conflicts; keep it development/contract tooling rather than production SDK code.
- [x] 7.3 Add exact rejection fixtures for missing required actor, missing tenant, tenant/resource conflict, unknown event/action, unsupported schema version, prohibited data, oversized/nested values, client authority escalation, and success before commit.
- [x] 7.4 Verify that validation diagnostics contain only safe bounded metadata and never repeat a rejected secret, full payload, raw request/response, or restricted value.
- [x] 7.5 Define quarantine, operator-alert, and failure-accounting expectations for invalid events at ingestion without claiming that rejected or missing events were delivered.

## 8. Delivery classes and integrity limits

- [x] 8.1 Materialize best-effort, security-significant, transaction-critical, and policy-critical delivery-class contracts with observable delivery, idempotency, duplicate, buffering, retry, outage, backpressure, shutdown, and alert behavior.
- [x] 8.2 Assign exactly one minimum delivery class to every initial catalog event and document reviewed event-specific strengthening or blocked policy-critical decisions.
- [x] 8.3 Define mechanism-neutral acceptance criteria for at-most-once, at-least-once, transactional-outbox-or-equivalent atomic durability, deferred completion, local queueing, and fail-open/fail-closed behavior without selecting infrastructure.
- [x] 8.4 Add scenario fixtures for duplicate redelivery, re-executed operations, collector outage, buffer exhaustion, graceful shutdown, retry exhaustion, atomic business/audit commit, and missing policy-critical failure posture.
- [x] 8.5 Document transport authenticity, producer identity, event-byte integrity, storage integrity, completeness, ordering, truthful application state, and non-repudiation as separate claims with explicit limitations.
- [x] 8.6 Add negative integrity examples proving that valid signing, MACs, authenticated transport, hashes, or chains do not establish truthful or complete reporting by a compromised producer.

## 9. OCSF, OpenTelemetry, and CloudEvents mappings

- [x] 9.1 Create a field- and event-level OCSF 1.8.0 mapping labeled `exact`, `transformed`, `extended`, `unmapped`, or `lossy`, including selected classes/profiles, status/time/metadata treatment, extension ownership, and round-trip limits.
- [x] 9.2 Add OCSF mapping fixtures and conformance tests for every initial catalog event and prohibit unqualified “full OCSF compatibility” claims outside the tested version/event/profile scope.
- [x] 9.3 Create an OpenTelemetry 1.59.0 / Semantic Conventions 1.43.0 mapping for occurrence and observation timestamps, trace/span, EventName, Resource, InstrumentationScope, Attributes, Body, privacy, size, precedence, and loss behavior.
- [x] 9.4 Add OpenTelemetry mapping fixtures and tests that detect duplicate/conflicting authority, prohibited or unbounded Body/Attributes content, missing native trace/timestamp mapping, and unsupported semantic-convention versions.
- [x] 9.5 Record the final CloudEvents decision and, if optional envelope support remains approved, define and test `id`, `source`, `type`, `time`, `dataschema`, `subject`, `data`, extension privacy, `specversion` separation, duplicate identity, and envelope/payload conflict rejection.
- [x] 9.6 Verify that OCSF mapping remains at ingestion/export, OpenTelemetry mapping remains a transport-adapter concern, CloudEvents remains transport-only if used, and none becomes the producer-facing canonical schema.

## 10. Examples, compatibility, and documentation

- [x] 10.1 Add fictional, secret-free positive examples covering every initial catalog event, actor type, tenant scope, outcome/lifecycle combination, synchronous/asynchronous correlation path, and delivery class required by the contract.
- [x] 10.2 Add annotated negative examples for trust escalation, browser/client authority claims, secret leakage, arbitrary objects, dynamic event names, invalid delegation, cross-tenant mismatch, authorization/outcome conflation, premature success, bad causality, and unsupported extensions.
- [x] 10.3 Add producer- and consumer-compatibility fixtures for patch, minor, major, deprecation, catalog addition, enum addition, optional field, required field, changed authority/privacy, and unsupported-version cases.
- [x] 10.4 Add deterministic tests proving positive examples validate, negative examples fail with exact safe codes, prior compatible examples retain interpretation, incompatible examples fail as declared, and generated artifacts match the authoritative source.
- [x] 10.5 Create human-readable contract, authority matrix, catalog, privacy policy, delivery policy, mapping, and migration documentation generated from or cross-checked against the authoritative machine-readable source.
- [x] 10.6 Run a terminology and semantic-coherence sweep across proposal, design, spec, ADRs, schema, catalog, policies, mappings, examples, and tests; resolve contradictions rather than relying on structural validation alone.

## 11. Read-only verification and approval

- [x] 11.1 Perform a read-only verification of completeness, correctness, cross-artifact coherence, catalog coverage, field-policy coverage, authority boundaries, privacy controls, delivery assignments, mapping claims, compatibility evidence, and production-scope exclusions.
- [x] 11.2 Run every contract/schema/mapping/compatibility test, strict OpenSpec validation, Git whitespace checks, and an exact changed-path review proving that no SDK, middleware, exporter, collector, queue, storage, SIEM, analytics, browser telemetry, production instrumentation, or cryptographic log-chaining implementation was added.
- [ ] 11.3 Prepare a stakeholder review packet that identifies exact artifacts, evidence versions, unresolved concerns, assurance limitations, and the exact Git commit to review; do not pre-populate a decision.
- [ ] 11.4 Obtain and record stakeholder feedback from the project owner and any qualified reviewer required by a policy-critical privacy, legal, operational, or security decision; do not treat AI review, PR assignment, or informal messages as approval.
- [ ] 11.5 Resolve review findings, rerun all read-only verification, and obtain explicit reconfirmation for any commit that changes normative semantics, evidence, mappings, privacy, delivery, or authorization boundaries.
- [ ] 11.6 Obtain the project owner's explicit final contract decision bound to the exact reviewed commit and state that project-owner governance is not independent assurance, certification, legal advice, privacy-law approval, or organizational approval.
- [x] 11.7 Report technical completeness, commit readiness, merge readiness, archive readiness, production authorization, and readiness for a separate `implement-security-audit-sdk-core` change without implementing that successor here.
