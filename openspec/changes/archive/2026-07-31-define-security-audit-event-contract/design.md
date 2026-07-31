## Context

See `proposal.md` for the motivation and scope and `specs/security-audit-event-contract/spec.md` for normative behavior. This design describes how the apply phase will materialize a repository-owned contract; it does not implement an SDK or runtime path.

The repository currently contains OpenSpec planning and isolated browser-telemetry research, not an established production service topology or application schema. The design therefore uses logical responsibility boundaries—authoritative producer, trusted transport boundary, ingestion, storage, and consumer—without claiming that concrete components already exist. Names such as “authentication component” and “tenant authority” mean the future component that owns that state, not an invented current service.

The prior browser-telemetry conclusion remains a hard trust boundary: browser-generated data is optional, attacker-controlled context. It is not identity, device identity, authentication evidence, authorization evidence, committed business state, or proof of human activity. This change neither reopens that research nor creates `continue-browser-telemetry-poc`.

### Assumptions

1. Future server components can resolve authenticated principal, effective tenant, resource ownership, transaction state, and authorization result from authoritative server-side context. If a component cannot do so, its event must express the missing or claimed state honestly rather than inventing authority.
2. Audit events are immutable facts about an occurrence or observation. Later completion, compensation, correction, and enrichment produce linked records; they do not rewrite history.
3. The first machine-readable representation will be JSON-compatible because the future SDK target is Node.js/TypeScript, but the semantic contract is not JavaScript-specific.
4. No retention duration, legal basis, data-residency rule, or fail-closed production policy currently exists in the repository. The contract can define policy classes and required decision fields, but actual durations and legally driven choices require explicit project-owner and, where applicable, qualified review before production use.
5. A single repository-owned schema/catalog source will drive human documentation, examples, compatibility tests, and later generated types. The exact generation tool is deliberately not selected by this proposal.

### Proposal-stage standards evidence

The following primary sources informed this design. Apply tasks must preserve a version-pinned comparison and executable mapping fixtures before any compatibility claim or final approval.

- NIST SP 800-53 Rev. 5 AU-2, AU-3, AU-5, AU-8, AU-9, AU-11, and AU-12: selected event types, “what/when/where/source/outcome/identity” content, failure response, timestamps, protection, retention, and generation. Official catalog source: <https://github.com/usnistgov/oscal-content/tree/main/nist.gov/SP800-53/rev5>.
- OCSF 1.8.0: an implementation-agnostic normalized cybersecurity event schema with categories, event classes, profiles, attributes, and extensions. Stable release: <https://github.com/ocsf/ocsf-schema/releases/tag/1.8.0>.
- OpenTelemetry Specification 1.59.0 Logs Data Model: occurrence and observed timestamps, W3C trace/span context, resource, instrumentation scope, attributes, body, and event name. <https://github.com/open-telemetry/opentelemetry-specification/blob/v1.59.0/specification/logs/data-model.md>.
- OpenTelemetry Semantic Conventions 1.43.0 events guidance: event names identify stable structures, contain no dynamic values, and occurrence time differs from observation time. <https://github.com/open-telemetry/semantic-conventions/blob/v1.43.0/docs/general/events.md>.
- CloudEvents 1.0.2: a vendor-neutral event envelope whose `source` plus `id` identifies duplicates, whose extension attributes have no intrinsic semantics, and whose context attributes may be visible to intermediaries. <https://github.com/cloudevents/spec/blob/ce%40v1.0.2/cloudevents/spec.md>.
- W3C Trace Context: standardized `trace-id`, `parent-id`/span relationship, propagation, privacy, and untrusted-caller considerations. <https://www.w3.org/TR/trace-context/>.
- JSON Schema Draft 2020-12 core and validation specifications: schema dialect, canonical schema identifiers, references, and validation. <https://json-schema.org/draft/2020-12/>.
- Semantic Versioning 2.0.0: incompatible, backward-compatible feature, and backward-compatible fix version categories, applied here only after defining the contract’s public compatibility surface. <https://semver.org/spec/v2.0.0.html>.
- OWASP Logging Cheat Sheet: application-event selection, “when/where/who/what” context, sanitization, and data to exclude. <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.

These sources are inputs, not automatic Bloodtrail requirements. The normative Bloodtrail contract and version-pinned mapping tests remain authoritative for this project.

## Goals / Non-Goals

**Goals:**

- Materialize one canonical semantic model and one governed catalog source from which JSON validation, documentation, examples, mappings, compatibility fixtures, and later TypeScript types can be derived or checked.
- Make authority, provenance, privacy, lifecycle, delivery, and integrity limitations explicit enough that future SDK code cannot silently choose them.
- Permit OCSF export and OpenTelemetry transport without coupling application producers to either schema.
- Give reviewers concrete negative cases for trust escalation, tenant confusion, secret leakage, premature success, incompatible schema evolution, and delivery ambiguity.
- Keep every decision independent of a particular framework, broker, collector, SIEM, storage engine, or cloud vendor.

**Non-Goals:**

- Select SDK libraries, middleware APIs, queue products, storage technology, collector topology, SIEM, policy engine, or cryptographic mechanism.
- Define threat-detection or fraud-scoring rules.
- Guarantee legal compliance, independent assurance, global total ordering, complete event capture under producer compromise, or truthful reporting by a compromised application.
- Assign production retention durations or authorize collection of real-user browser telemetry.
- Produce runtime TypeScript, JavaScript, exporters, collectors, infrastructure, or instrumentation in this change.

## Decisions

### 1. Bloodtrail owns the canonical application-facing contract

**Decision:** The canonical contract is a Bloodtrail-owned, versioned application model. OCSF is a downstream normalization/export mapping, OpenTelemetry is an optional transport representation, and CloudEvents is an optional transport envelope only. None is the application-facing source of truth.

**Rationale:**

- OCSF provides useful security normalization but cannot by itself decide Bloodtrail tenant authority, application transaction commit, delivery class, or exact domain catalog.
- OpenTelemetry provides a strong logical log/event transport model but deliberately leaves application semantic conventions to the producer domain.
- CloudEvents describes event context and serialization, not the complete audit payload or trust model.
- A stable internal contract lets each mapping evolve and be version-pinned without forcing all producers to track a downstream ecosystem.

**Mapping location:**

- Canonical validation occurs at the producer boundary and again at ingestion.
- An OpenTelemetry transport adapter adjacent to a future SDK maps canonical records into OTLP LogRecords/Events when OTLP is selected. A collector may validate and route but does not reinterpret authority or invent missing canonical semantics.
- OCSF mapping occurs at ingestion or export, where downstream normalization belongs and OCSF version changes can be isolated from producers.
- A CloudEvents adapter, if a later transport needs it, wraps the canonical event as `data`; it does not replace the canonical event. Conflicting envelope and payload values are rejected.

**Alternatives:** Direct OCSF, OpenTelemetry, CloudEvents, free-form JSON, and SIEM schemas were considered in `proposal.md` and rejected as canonical sources.

### 2. Contract artifacts have one authoritative source

**Decision:** The apply phase will create one repository-owned contract package, provisionally under `contracts/security-audit/`, containing:

- canonical schema source and generated/bundled JSON Schema;
- field and vocabulary registry;
- event catalog;
- authority/trust matrix;
- privacy-field policy;
- delivery-class policy;
- OCSF and OpenTelemetry mappings;
- CloudEvents decision and optional mapping;
- positive and negative examples;
- compatibility fixtures and tests;
- architecture decision records;
- human-readable contract documentation.

The authoritative source format may be JSON, YAML, or a schema definition language selected by ADR-002. Generated files must carry a generated notice and deterministic provenance. CI must fail when generated and hand-authored representations diverge.

**Rationale:** Multiple manually synchronized tables would drift. A generated-or-cross-validated package gives both humans and tools a reviewable source.

**Alternative:** Hand-maintained TypeScript types are rejected because they would make an unimplemented SDK language the schema authority and would not validate untyped boundary input.

### 3. Trust is typed, provenance is immutable, and enforcement use is constrained

Trust is not a claim that data is universally true. It states which boundary produced or verified a value and what conclusions are permitted.

| Trust label | Meaning | Typical source | Enforcement use |
|---|---|---|---|
| `authoritative_server` | State owned by the producing server component and read after the relevant decision or commit point | account/session/tenant/resource owner, transaction coordinator | Eligible only for the documented purpose under a separately approved policy; not a substitute for live authorization |
| `verified_assertion` | Assertion validated from a configured trust relationship, audience, issuer, signature, time, and replay policy | identity provider, workload federation, delegated credential | Eligible within the assertion’s validated scope and lifetime |
| `observed_transport` | Fact directly observed at a trusted server or proxy boundary | peer network address, TLS peer, ingress route | Corroborating context; not identity or proof of human/device ownership |
| `derived_server` | Reproducible derivation from identified inputs using a named algorithm/version | session age, bounded risk classification, tenant hierarchy resolution | Eligible only to the extent allowed for the derivation and its inputs |
| `downstream_enrichment` | Analysis added after the canonical event left the producer | geolocation, threat intelligence, investigation labels | May support later detection under separate policy; cannot rewrite original facts or prove the original decision |
| `client_claim` | User-, browser-, request-, or externally supplied value not independently verified for the asserted meaning | claimed tenant, forwarded identifier from an untrusted hop, client user agent field | Never sole authoritative evidence or sole enforcement basis |
| `unknown` | Origin or verification cannot be established | malformed legacy payload | Not eligible; reject or quarantine where required |

A field carries authority implicitly through its contract path and, when multiple source classes are allowed, explicitly through `provenance`. Enrichment appends a namespaced value and provenance record. It never overwrites a producer value or raises its trust level.

#### Field-authority matrix

| Field category | Authoritative producer | Allowed source | Validation | Enrichment location | User-controlled contribution | Downstream enforcement |
|---|---|---|---|---|---|---|
| Event identity and catalog classification | canonical producer library/boundary using approved registry | server-generated only | ID format/uniqueness; exact registered name/category/action/version | none | no | routing/deduplication only; classification is not authorization |
| Occurrence lifecycle, outcome, commit state | component owning the operation/transaction | server state after the relevant phase | allowed phase/outcome/commit combinations | none | no | investigation and later policy only; never retroactive authorization |
| Observation timestamp | first trusted observation boundary | trusted producer/ingestion clock | timestamp format, skew policy, monotonic pipeline stage rules | each pipeline stage appends its own timestamp | no | no direct enforcement |
| Producer/service/deployment | authenticated runtime configuration plus transport identity | trusted configuration and authenticated channel | registered producer; payload/transport identity match | ingestion may add its own stage identity | no | routing and producer policy only |
| Claimed identity | request input | client or external input | type/size/sanitization; always `client_claim` until verified | none | yes | prohibited as sole evidence |
| Authenticated identity | authentication authority | validated session/token/assertion context; never raw credential | issuer/audience/time/session binding and stable ID | none | source credential is user-presented, resolved value is not user-selected | eligible within validated scope |
| Delegated/impersonated principal | delegation/impersonation authority and enforcing component | validated server-side delegation record | actor, subject, scope, reason, expiry, policy, chain | none | reason text may be user-entered but code/scope are server-controlled | eligible only within recorded delegation scope |
| Service/workload identity | workload identity authority or server configuration | verified runtime identity | issuer, subject, audience, workload binding | none | no | eligible within validated scope |
| Credential reference | authentication authority | server-resolved non-secret reference/fingerprint | type allowlist; no credential material | none | credential presented by caller but reference generated server-side | corroborating; live credential state must be rechecked for enforcement |
| Tenant context and hierarchy | tenancy authority, authenticated scope, resource owner | trusted route/auth/resource state | cross-check actor/effective/resource tenant and hierarchy | none | claimed tenant may be retained separately | authoritative context eligible; claimed tenant prohibited |
| Resource identity/ownership/classification | resource-owning component or registry | committed server state | resource type/ID/owner/classification consistency | classification service may append versioned enrichment if designated | resource locator may begin as request input but must be resolved | eligible after authoritative resolution |
| Authentication context | authentication authority | verified authentication transaction/session | controlled methods, assurance, MFA, time, IdP, failure reasons | none | no raw factors or secrets; claimed method stays claimed | eligible within current validated context only |
| Authorization context | policy decision point and enforcement point | direct decision response plus enforcement result | policy ID/version, capability, tenant/resource, decision, override | downstream may add analysis but not alter decision | request asks for action but does not choose decision | decision evidence; not a reusable authorization grant |
| Observed source/destination network | trusted ingress/egress boundary | direct socket/TLS/proxy observation from allowlisted hops | canonical address, proxy-chain trust, minimization | geolocation/threat intel downstream | forwarding headers may be client-controlled until trusted-hop validation | corroborating only |
| Client-reported context | request payload/header/browser | client | allowlist, size, privacy, `client_claim` | none | yes | never sole enforcement basis |
| Request and trace context | trusted request/message boundary | validated W3C/header/message metadata | format, trusted-hop rules, no PII, no authority escalation | pipeline may append stage IDs | incoming trace values can be attacker supplied | correlation only |
| Operation/transaction/causation IDs | component owning each lifecycle | server-generated or validated internal message | format, relationship, retry stability | none | external message ID may be claimed until boundary validates it | correlation/deduplication only |
| Risk context | named server derivation or downstream engine | identified inputs and algorithm/version | bounds, provenance, reason-code registry | producer or downstream namespace | client inputs allowed only as labeled inputs | only under separately approved risk policy; never client value alone |
| Data classification/retention/delivery class | resource classification authority plus contract catalog | registry and authoritative resource metadata | allowed class and catalog minimum | downstream may strengthen but not silently weaken | no | controls handling, not user authorization |
| Integrity metadata | attester/verifier at its boundary | mechanism output | algorithm/format/key ID/canonicalization/scope/result | each boundary appends separate record | no key or secret material | verification gates transport/storage handling only |
| Extensions | registered extension owner | source allowed by extension schema | namespace/schema/authority/privacy/size | designated owner only | only when declared | cannot exceed source eligibility or redefine canonical enforcement fields |

### 4. Canonical JSON envelope is structured and bounded

The logical shape uses lower-case `snake_case` property names, nested context objects, RFC 3339 UTC timestamps with sufficient precision, and strings for opaque identifiers. Event names use dot-delimited, fully qualified constants such as `bloodtrail.audit.authentication.succeeded`. IDs are opaque and must not encode PII, tenant, account, network, or secret data.

The exact JSON Schema dialect and identifier format are confirmed by ADR-002 and ADR-003 before contract approval. The proposed baseline is JSON Schema Draft 2020-12 and UUID-compatible opaque event IDs, but no runtime library is selected here.

#### Field notation

- Requirement: `R` = required on every event; `C` = conditionally required by event/catalog/context; `O` = optional when allowed.
- Compatibility: `stable` = incompatible type/meaning/authority/requiredness changes require a major version; `registry` = allowed values are versioned in a governed registry; `additive` = an optional field may be added only under the compatibility policy; `extension` = governed namespace rules apply.
- Privacy: `public_metadata`, `internal`, `confidential`, or `restricted`. Prohibited data has no canonical field.

#### Event, schema, producer, and deployment fields

| Path | Type / requirement | Authority and allowed values / validation | Privacy / redaction | Compatibility |
|---|---|---|---|---|
| `event.id` | opaque string, R | `authoritative_server`; globally collision-resistant; immutable; same ID on retry | internal; never derive from PII | stable |
| `event.name` | string, R | registered `bloodtrail.audit.*` constant; no dynamic segments | public_metadata | registry |
| `event.category` | enum, R | registered category consistent with catalog entry | public_metadata | registry |
| `event.action` | enum, R | registered action consistent with event/resource | public_metadata | registry |
| `event.lifecycle_phase` | enum, R | `attempted`, `completed`, or `compensating`; catalog-constrained | internal | registry |
| `event.outcome` | enum, R | `success`, `failure`, `denied`, `partial`, `unknown`, `cancelled`; phase-constrained | internal | stable registry |
| `event.outcome_reason.code` | controlled string, C | cataloged reason code; no secrets or dynamic text | internal/confidential by catalog | registry |
| `event.outcome_reason.message` | bounded string, O | sanitized display text; must not be sole machine decision input | confidential; redact for tenant/export views as policy requires | additive |
| `event.commit_state` | enum, C | `not_applicable`, `not_started`, `pending`, `committed`, `not_committed`, `partially_committed`, `compensated`, `unknown`; valid combination required | internal | registry |
| `event.timestamp` | RFC 3339 UTC string, R | operation owner’s occurrence clock; immutable; precision documented | internal | stable |
| `event.observed_at` | RFC 3339 UTC string, R | first trusted observation clock; skew evaluated, not rewritten | internal | stable |
| `event.delivery_class` | enum, R | catalog minimum: `best_effort`, `security_significant`, `transaction_critical`, `policy_critical` | internal | registry |
| `schema.name` | URI or registered string, R | fixed canonical schema identity | public_metadata | stable |
| `schema.version` | SemVer string, R | exact released version; supported registry entry required | public_metadata | stable |
| `producer.name` | registered string, R | authenticated producer identity must match transport/configuration | internal | registry |
| `producer.version` | SemVer/build version string, R | trusted build metadata; bounded | internal | stable |
| `producer.instance_id` | opaque string, O | runtime-assigned, non-PII, bounded | confidential; short retention/display suppression | additive |
| `environment.name` | enum/string, R | registered environment such as development/test/staging/production; no free-form tenant value | internal | registry |
| `service.name` | registered string, R | trusted runtime configuration | internal | registry |
| `service.version` | version string, C | trusted build metadata | internal | stable |
| `service.instance_id` | opaque string, O | trusted runtime metadata; no hostname if policy prohibits | confidential; redact on external export | additive |
| `deployment.id` | opaque string, C | deployment authority; no secrets | internal | stable |
| `deployment.region` | controlled string, O | trusted deployment metadata | internal/confidential by topology policy | additive |
| `deployment.zone` | controlled string, O | trusted deployment metadata | confidential; external export may coarsen | additive |

#### Tenant, actor, subject, delegation, and credential fields

| Path | Type / requirement | Authority and allowed values / validation | Privacy / redaction | Compatibility |
|---|---|---|---|---|
| `tenant.scope` | enum, R | `tenant`, `cross_tenant`, `platform`, `tenantless`; catalog/context constrained | internal | registry |
| `tenant.actor_tenant_id` | opaque string, C | authentication/tenancy authority | confidential; pseudonymize on approved export | stable |
| `tenant.effective_tenant_id` | opaque string, C | server routing/authorization context | confidential; pseudonymize on approved export | stable |
| `tenant.resource_tenant_id` | opaque string, C | resource owner | confidential; pseudonymize on approved export | stable |
| `tenant.parent_tenant_id` | opaque string, O | tenancy hierarchy authority | confidential | additive |
| `tenant.claimed_tenant_id` | opaque string, O | always `client_claim`; only retain when cataloged and necessary | restricted; short retention/pseudonymize | additive |
| `actor.type` | enum, R | catalog-supported actor type | internal | registry |
| `actor.id` | opaque string, C | stable server-resolved identifier; absent for genuine anonymous actor | confidential; pseudonymize for exports as policy requires | stable |
| `actor.tenant_id` | opaque string, C | tenancy authority; consistent with tenant context | confidential | stable |
| `actor.display_name` | bounded string, O | display only; never identity authority | restricted; redact/pseudonymize by view | additive |
| `actor.provenance` | trust/provenance object, C | required when authority is not implicit or a verified assertion is used | internal | stable |
| `subject.type` | registered string, C | catalog-defined affected entity type | internal | registry |
| `subject.id` | opaque string, C | authoritative affected-entity ID | confidential | stable |
| `subject.tenant_id` | opaque string, C | owning tenancy authority | confidential | stable |
| `subject.display_name` | bounded string, O | display only | restricted; redact by view | additive |
| `authenticated_principal.type` | enum, C | authentication authority | internal | registry |
| `authenticated_principal.id` | opaque string, C | verified principal ID | confidential | stable |
| `authenticated_principal.issuer` | URI/registered string, C | verified issuer | internal | stable |
| `delegation.mode` | enum, C | `delegated` or `impersonation`; explicit server authorization required | internal | registry |
| `delegation.principal_id` | opaque string, C | delegation authority | confidential | stable |
| `delegation.scope` | bounded controlled array, C | validated capability/resource scope; no arbitrary objects | confidential; external export may summarize | stable registry |
| `delegation.reason_code` | controlled string, C | server-selected approved reason | confidential | registry |
| `delegation.expires_at` | RFC 3339 UTC string, C | delegation authority | confidential | stable |
| `delegation.chain` | bounded array of principal references, O | each hop validated; maximum depth declared | restricted; tenant views filtered | additive |
| `credential.type` | enum, C | password/session/API credential/workload/federated/etc.; no contents | internal | registry |
| `credential.reference` | opaque server reference or keyed fingerprint, O | authentication authority; never raw credential | restricted; purpose-scoped transformation | stable |
| `credential.key_id` | non-secret key/version reference, O | transformation/verification authority | internal | additive |
| `initiator.type` | enum, R | `application`, `service`, `workload`, `background_job`, `scheduled_process`, `external_integration`, or interactive client class | internal | registry |
| `initiator.id` | registered/opaque string, R | trusted runtime/integration registry; client app claim kept separate | confidential | stable |
| `initiator.version` | bounded version string, O | trusted configuration when known | internal | additive |

#### Session, authentication, and authorization fields

| Path | Type / requirement | Authority and allowed values / validation | Privacy / redaction | Compatibility |
|---|---|---|---|---|
| `session.id` | opaque reference, C | session authority; not a cookie/token | restricted; purpose-scoped keyed transform where direct ID unnecessary | stable |
| `session.created_at` | RFC 3339 UTC string, O | session authority | confidential | additive |
| `session.age_seconds` | non-negative integer, O | `derived_server`; bounded and consistent with trusted time | confidential | additive |
| `session.assurance_level` | controlled string, O | authentication/session authority | confidential | registry |
| `authentication.method` | controlled string, C | authentication authority | confidential | registry |
| `authentication.assurance_level` | controlled string, C | authentication authority or validated IdP assertion | confidential | registry |
| `authentication.mfa_state` | enum, C | `not_used`, `required`, `satisfied`, `failed`, `not_applicable`, `unknown`; transaction-specific | restricted | registry |
| `authentication.credential_type` | enum, C | authentication authority; must agree with credential context | confidential | registry |
| `authentication.authenticated_at` | RFC 3339 UTC string, C | authentication authority | confidential | stable |
| `authentication.identity_provider` | URI/registered string, O | verified issuer/configuration | confidential | stable |
| `authentication.account_recovery` | typed object, O | controlled flow/state/reason only; no recovery contents | restricted; tenant/external views redact | stable/additive subfields |
| `authentication.failure_reason` | controlled string, C for failure | non-enumerating reason taxonomy | restricted; coarse external display | registry |
| `authentication.delegated` | boolean, R when authentication exists | derived from validated context | confidential | stable |
| `authentication.impersonated` | boolean, R when authentication exists | derived from validated context | restricted | stable |
| `authorization.decision` | enum, C | `allow`, `deny`, `not_applicable`, `indeterminate`, `error`; decision point authority | confidential | stable registry |
| `authorization.policy_id` | registered/opaque string, C | decision point | confidential | stable |
| `authorization.policy_version` | version string, C | decision point | confidential | stable |
| `authorization.capability` | controlled string, C | decision point; no dynamic IDs | confidential | registry |
| `authorization.enforcement_point` | registered string, C | enforcement component | internal | registry |
| `authorization.decision_reason` | controlled string, C | decision point; sanitized optional message separate | restricted | registry |
| `authorization.resource_context` | bounded typed reference, C | authoritative resource resolution | restricted | stable |
| `authorization.tenant_context` | bounded typed reference, C | tenancy authority | restricted | stable |
| `authorization.override` | boolean, C | enforcement/override authority | restricted | stable |
| `authorization.break_glass` | boolean, C | break-glass authority; implies heightened catalog rules | restricted | stable |
| `authorization.policy_correlation_id` | opaque string, O | policy engine; non-secret | confidential | additive |

#### Source, destination, resource, request, correlation, risk, data, integrity, and extension fields

| Path | Type / requirement | Authority and allowed values / validation | Privacy / redaction | Compatibility |
|---|---|---|---|---|
| `source.observed.address` | canonical IP/network string, O | trusted ingress observation; proxy-chain validation required | restricted; coarsen/pseudonymize/short retention by policy | stable |
| `source.observed.port` | integer 0–65535, O | trusted socket/proxy observation | confidential | stable |
| `source.observed.proxy_chain` | bounded typed array, O | only trusted hops promoted; untrusted values remain claims | restricted; minimize | stable |
| `source.client_reported` | bounded typed object, O | always `client_claim`; allowlisted keys only | restricted; transform or omit | extension-like additive |
| `destination.service` | registered string, C | trusted route/configuration | internal | registry |
| `destination.address` | canonical network/service address, O | trusted egress/routing observation | confidential; redact topology on external export | stable |
| `destination.port` | integer 0–65535, O | trusted egress observation | confidential | stable |
| `resource.type` | controlled string, C | resource registry/owner | internal | registry |
| `resource.id` | opaque string, C | authoritative resource owner | restricted; pseudonymize on export as required | stable |
| `resource.parent_type` | controlled string, O | resource registry | internal | registry |
| `resource.parent_id` | opaque string, O | authoritative resource owner | restricted | additive |
| `resource.owning_tenant_id` | opaque string, C for tenant resource | resource owner; must match tenant context unless valid cross-tenant path | restricted | stable |
| `resource.data_classification` | enum, C | classification authority/catalog minimum | restricted | registry |
| `resource.operation_type` | enum, R | `create`, `read`, `update`, `delete`, `execute`, `export`, `administer`, `configure`, or catalog extension | internal | registry |
| `resource.bulk` | typed object, O | bounded count/scope; no unbounded ID list | restricted; aggregate/minimize | stable/additive subfields |
| `request.id` | opaque string, C for request-driven event | trusted request boundary; incoming claim validated/replaced per boundary | confidential | stable |
| `request.method` | controlled protocol operation string, O | trusted request parser; no raw request line | internal | additive |
| `request.route` | normalized route template, O | server router; never raw URL/query by default | confidential; strip parameters | additive |
| `request.user_agent` | bounded/parsed value, O | client claim; catalog purpose required | restricted; minimize, parse/coarsen, short retention | additive |
| `request.message_id` | opaque string, C for message-driven event | trusted messaging boundary | confidential | stable |
| `correlation.trace_id` | W3C 16-byte/32-hex ID, O | propagated untrusted context validated structurally; correlation only | confidential; no PII; boundary restart policy | stable |
| `correlation.span_id` | W3C 8-byte/16-hex ID, O | requires trace ID; current span | confidential | stable |
| `correlation.correlation_id` | opaque string, C | operation boundary; cross-system correlation | confidential | stable |
| `correlation.causation_id` | opaque event/message ID, C for caused event | parent event/message relationship | confidential | stable |
| `correlation.operation_id` | opaque string, C | business/workflow operation owner | confidential | stable |
| `correlation.transaction_id` | opaque string, C for transactional event | transaction owner; no database secrets | restricted; external export transform | stable |
| `correlation.request_id` | opaque string, C for request-driven event | trusted request boundary | confidential | stable |
| `correlation.message_id` | opaque string, C for message-driven event | trusted message boundary | confidential | stable |
| `correlation.retry_attempt` | non-negative integer, C on retry | delivery boundary; bounded | internal | stable |
| `correlation.original_event_id` | opaque event ID, C for retry/compensation/correction | authoritative relationship | confidential | stable |
| `risk.level` | controlled enum, O | named producer/downstream derivation | restricted | registry |
| `risk.score` | bounded decimal/integer, O | algorithm-specific bounds and version required | restricted | stable within algorithm version |
| `risk.reason_codes` | bounded controlled array, O | named derivation; no arbitrary text | restricted | registry |
| `risk.model` | name/version object, C when risk present | trusted configuration/provenance | confidential | stable |
| `data.classification` | enum, R | maximum sensitivity represented by event fields and resource | restricted | registry |
| `data.retention_class` | enum, R | catalog minimum/policy; downstream may strengthen | restricted | registry |
| `data.field_policy_version` | version string, R | privacy registry | internal | stable |
| `integrity.attestations` | bounded array, O | attester records mechanism, scope, canonicalization, key ID, signer, verification; no key material | restricted | additive records; mechanism registry |
| `integrity.transport_authentication` | typed observation, O | trusted receiving boundary, not producer self-claim | restricted | additive |
| `extensions` | map of registered namespace to typed object, O | extension schema and authority rules; unknown namespace rejected/quarantined | maximum child classification; field-level rules apply | extension |

No full request/response body, arbitrary serialized object, credential material, payment-card data, or secret receives a field. Its appearance anywhere is a contract violation, not an extension opportunity.

### 5. Actor model separates six roles that are often conflated

A conforming event can identify:

1. **Performing actor:** runtime entity that executed the action.
2. **Subject:** person, account, resource, credential, role, or other entity affected.
3. **Authenticated principal:** identity established by the authentication authority.
4. **Delegated or impersonated principal:** authority on whose behalf the actor operates, with explicit mode and chain.
5. **Credential reference:** non-secret reference to the credential class/instance used.
6. **Initiator:** application, service, workload, background job, scheduled process, or external integration that initiated execution.

| Actor type | Required interpretation |
|---|---|
| Authenticated human | stable authenticated principal and actor IDs; session/authentication context required |
| Anonymous user | `actor.type=anonymous`; no fabricated ID/principal; request/source context allowed under privacy policy |
| Service account | service account is actor; authenticated principal and initiating service remain distinguishable |
| Workload identity | verified workload identity plus service/deployment context |
| API credential | credential is not the actor by itself; actor/owner and non-secret credential reference are separate |
| Administrator | human/service actor plus administrator capability and authorization context; role label alone is insufficient |
| Delegated actor | performing actor plus delegated principal, validated scope, reason, and expiry |
| Impersonating actor | real performing administrator plus impersonated subject; UI-visible identity never replaces real actor |
| Background job | job identity, initiating service, schedule/operation context, and original causation where applicable |
| Scheduled process | registered schedule/process identity and execution instance |
| External integration | registered integration identity, verified credential/assertion, and owning tenant where applicable |

### 6. Tenant model prevents attribution by request parameter

The canonical tenant object records four distinct concepts: actor tenant, effective tenant, resource-owning tenant, and optional parent tenant. `scope` makes platform, tenantless, and cross-tenant cases explicit.

Resolution order is authoritative resource ownership and verified principal scope, then trusted routing context. A tenant ID in a URL, header, body, browser value, or message is a claim until matched to trusted context. A mismatch is never resolved by choosing the client value; it becomes a denied/failed operation and/or `bloodtrail.audit.tenant.context_violation.detected` linked to the attempt.

Cross-tenant administration requires platform or delegated authority, explicit target and owner tenants, authorization policy/version, enforcement point, and reason. Tenantless is an allowlisted catalog property, not a fallback for missing data.

### 7. Resource, action, and event vocabularies are registries

Event names use `bloodtrail.audit.<domain>.<semantic>` and never contain values. Initial categories are:

- `account`
- `authentication`
- `session`
- `authorization`
- `privilege`
- `administration`
- `data_access`
- `security_configuration`
- `tenant_security`

Actions are stable verbs or verb phrases registered with descriptions, for example `register`, `authenticate`, `enroll_mfa`, `remove_mfa`, `create_session`, `revoke_session`, `request_password_reset`, `complete_password_reset`, `evaluate_authorization`, `assign_role`, `remove_role`, `elevate_privilege`, `start_impersonation`, `end_impersonation`, `view`, `create`, `modify`, `delete`, `export`, `change_security_configuration`, and `detect_tenant_violation`.

Resource types are also registered. Unknown business resource types are not accepted as arbitrary strings; a catalog update or registered extension is required. Bulk events carry bounded aggregate scope/count and a catalog rule for child events. Export events record classification and volume metadata, never exported content.

### 8. Outcome is a statement about one lifecycle phase

`event.outcome` answers “what was the result of this event’s phase?” It does not combine authorization and business state.

| Outcome | Meaning |
|---|---|
| `success` | The phase achieved its documented result; for `completed` transactional events, required commit state is `committed` |
| `failure` | The phase failed for a non-authorization reason and did not achieve its intended result |
| `denied` | An authorization, tenancy, security, or policy control intentionally prevented the action |
| `partial` | A bounded subset completed and exact aggregate/child semantics are available |
| `unknown` | The producer cannot authoritatively determine the result; it must not guess |
| `cancelled` | Work ended through an explicit cancellation path before the intended result |

`authorization.decision=allow` can coexist with operation `failure`. `authorization.decision=deny` normally produces event outcome `denied`, not `failure`. An attempt `success` means the attempt was accepted or initiated, not that the operation eventually committed. A completed event cannot say `success` with `pending` or `not_committed` commit state.

Asynchronous operations emit separate attempt/acceptance and completion events. Compensation emits a new `compensating` event linked to the committed event; successful compensation sets its own result and references the earlier state. Immutable history is preserved.

### 9. Authentication and authorization contexts remain separate

Authentication context records how and when a principal was established and at what assurance, while authorization context records the specific policy decision and enforcement. Neither is inferred from the other or from an HTTP status.

Authentication failure reasons must support investigation without account enumeration or factor disclosure. No password, token, key, cookie, recovery code, factor value, challenge response, or secret-derived verifier is allowed.

Authorization context requires decision point, policy and version, capability, resource, tenant, reason, enforcement point, and override state. Break-glass and impersonation are explicit events and context flags with elevated delivery, not opaque “admin” labels.

### 10. Correlation IDs each answer one question

| Identifier | Question answered | Generation/propagation rule |
|---|---|---|
| `event.id` | Which immutable audit record is this? | unique per occurrence/phase; unchanged for redelivery |
| `trace_id` | Which W3C distributed trace includes this processing? | propagate valid W3C context; correlation only; may be absent or restarted at trust boundary |
| `span_id` | Which W3C span was active? | present only with trace ID; never reused as event ID |
| `correlation_id` | Which broad conversation/investigation chain groups related work? | server-generated at trusted boundary if absent; stable across related services |
| `causation_id` | Which event or message directly caused this event? | points to immediate causal parent, not every ancestor |
| `operation_id` | Which logical business/workflow operation spans attempts and completion? | generated by operation owner; stable through async steps |
| `transaction_id` | Which atomic transaction boundary applies? | generated by transaction owner; changes for a new transaction or compensation |
| `request_id` | Which synchronous request instance? | trusted request boundary; changes for a new request/retry unless protocol defines otherwise |
| `message_id` | Which message instance/delivery unit? | trusted messaging boundary; original plus redelivery policy documented |
| `retry_attempt` | Which delivery/execution attempt is this? | zero or one based by ADR; increments with bounded integer; does not create a new event for pure redelivery |
| `original_event_id` | Which earlier event is retried, corrected, completed, or compensated? | required by the applicable lifecycle relationship |

Fan-out gives each child its own event ID and immediate causation link while preserving operation/correlation context. Retransmitting identical event bytes keeps the event ID. Re-executing an operation is a new occurrence and therefore a new event ID, linked to the original operation/event.

Occurrence and observation timestamps remain separate so clock skew and pipeline delay are visible. Validation records skew; it does not rewrite source history. Trace identifiers must contain no PII and incoming trace flags are not trusted policy instructions.

### 11. Schema governance separates producer and consumer compatibility

The contract uses Semantic Versioning only after defining its public API as field paths, types, authority, requiredness, vocabularies, catalog semantics, privacy behavior, validation results, and mapping guarantees.

| Change | Version treatment |
|---|---|
| Clarification that does not change accepted data or interpretation; test/documentation correction | patch |
| Optional additive field with a default absence meaning; new catalog entry; new registered reason/action; non-breaking mapping extension | minor, provided old valid events retain interpretation and support behavior is explicit |
| Add required field; narrow accepted values for existing version; change type/meaning/authority/privacy; remove/rename field or value; alter lifecycle/delivery/integrity guarantee | major |
| Deprecate a field/event without removal | minor; original meaning remains stable through support window |
| Remove deprecated field/event | major |

**Producer compatibility:** A producer declares the exact schema/catalog version it emits and only uses names and values registered there. Existing events valid under a prior compatible version remain valid and retain meaning under the newer version.

**Consumer compatibility:** A consumer declares a supported version range. It must ignore only optional fields that the major-version policy marks safe to ignore. It must not invent a meaning for an unknown event name, enum, extension, or newer incompatible version; it rejects or quarantines unsupported semantics.

Adding a catalog event can be a minor contract change even though an older consumer may not process that new event. The older consumer’s required behavior is explicit unsupported-event handling, not false acceptance. Mapping compatibility is versioned separately and states losses.

Released names and meanings are never reused. Deprecation records replacement, first deprecated version, minimum support window, removal version, producer migration, and consumer fallback. Every release includes compatibility fixtures.

### 12. Privacy policy is allowlist-first

Field policy values are:

| Policy | Meaning |
|---|---|
| `allowed` | Necessary for cataloged purpose in canonical form under declared access/retention |
| `conditionally_allowed` | Present only for named event purposes and conditions; absence is preferred otherwise |
| `transform_required` | Raw value must not enter event; approved coarsening, tokenization, or purpose-scoped keyed transform required |
| `prohibited` | Must not appear in canonical fields, extensions, examples, validation diagnostics, mappings, or transport envelopes |

Minimum prohibited content: passwords; password verifiers; raw access, refresh, identity, recovery, or API tokens; API keys; private keys; session cookies; recovery codes; authentication-factor contents; payment-card data; raw secrets; full request/response bodies by default; arbitrary serialized objects; database connection strings; and unnecessary high-entropy client attributes.

- **IP addresses:** only trusted observations for cataloged security purposes; classify restricted; minimize precision or transform when exact address is unnecessary; assign short/explicit retention.
- **User agents:** client claims; omit by default; if needed, bound length and prefer parsed/coarsened family/version over raw string.
- **Email/phone:** direct values only when a cataloged investigation purpose requires them; otherwise purpose-scoped keyed transform. Plain hashes of guessable values are not adequate pseudonymization.
- **Business identifiers:** stable opaque IDs may be allowed if required; display labels are separate and more restricted.
- **Session/credential identifiers:** use server references or purpose-scoped keyed fingerprints, never bearer values.
- **Cross-tenant correlation:** prohibited by default. A transform key is tenant- and purpose-scoped unless a reviewed platform-security use case explicitly authorizes broader scope.

Retention classes have semantic names but no invented durations:

- `operational_short`
- `security_standard`
- `security_elevated`
- `policy_governed`

Actual durations, residency, deletion, tenant access, and legal-hold behavior are approval inputs before production instrumentation.

### 13. Validation has six layers

| Layer | Responsibility |
|---|---|
| Contract authoring | meta-schema, registry references, no collisions, field policy coverage, catalog completeness |
| Type generation / compile time | deterministic types/builders and controlled constants; developer feedback only |
| Producer runtime | structural schema, catalog, lifecycle combinations, authority source, tenant/resource consistency, prohibited data, size bounds before enqueue |
| CI | all schemas, generated drift, examples, negative fixtures, mapping fixtures, compatibility across supported versions |
| Ingestion | authenticated producer, declared version, duplicate identity, structural/semantic revalidation, prohibited content, size/tenant/authority checks, transport/payload conflicts |
| Downstream | supported-version gate, provenance preservation, tenant access, mapping-loss awareness, no enforcement from ineligible fields |

TypeScript types cannot establish trust at runtime and cannot protect payloads from other languages or deserialization. Semantic validators therefore supplement JSON Schema for checks involving producer identity, resource ownership, commit state, registries, and provenance.

#### Required misuse behavior

| Condition | Producer boundary | Ingestion boundary | Required safe result |
|---|---|---|---|
| Required actor missing | reject unless catalog explicitly allows anonymous | quarantine/reject legacy payload | `MISSING_REQUIRED_ACTOR` |
| Required tenant missing | reject | quarantine/reject | `MISSING_TENANT_CONTEXT` |
| Resource owner conflicts with tenant | reject and signal tenant violation | quarantine and alert | `TENANT_RESOURCE_CONFLICT` |
| Unknown event name/action | reject | quarantine | `UNKNOWN_CATALOG_VALUE` |
| Invalid/unsupported schema version | reject | quarantine | `UNSUPPORTED_SCHEMA_VERSION` |
| Prohibited key/value | reject before serialization where possible | reject/quarantine without echo | `PROHIBITED_DATA` |
| Size/nesting/cardinality limit exceeded | reject or explicit field-specific transform | reject | `FIELD_LIMIT_EXCEEDED` |
| Client value labeled authoritative | reject | quarantine/alert | `AUTHORITY_ESCALATION` |
| Success before commit | reject lifecycle combination | quarantine | `PREMATURE_SUCCESS` |
| Event cannot reach durability boundary | apply delivery class response | alert/delay accounting | class-specific delivery failure code |

Diagnostics include event name if safe, producer, schema version, field path, and code; never the rejected secret or full payload.

### 14. Four delivery classes avoid a false universal guarantee

| Class | Baseline semantic | Durability/retry/idempotency | Outage/backpressure/shutdown | Business failure posture |
|---|---|---|---|---|
| `best_effort` | at-most-once acceptable; loss explicitly tolerated | in-memory or direct attempt allowed; no unbounded retry; ID still unique | bounded buffer/drop counters; no shutdown delay beyond configured bound | fail open; health signal records loss estimate |
| `security_significant` | at-least-once after accepted by required producer boundary | durable or bounded protected queue required by later implementation; same event ID on retry; consumer dedupe | retry with jitter/bounds, backpressure and outage alert, bounded graceful flush/handoff | normally fail open for business availability, but event-specific policy may strengthen; never silent loss |
| `transaction_critical` | audit durability is atomic with successful business commit; downstream delivery at least once | transactional outbox or equivalent atomic mechanism required by behavior, not by product name; dedupe by event ID | committed outbox survives collector outage; backlog thresholds/alerts; shutdown leaves durable handoff | fail closed before business commit if event cannot reach atomic durability point; after commit, delivery is deferred/retried rather than reversing truth |
| `policy_critical` | explicit legal/operational policy decides atomicity and availability | at least security-significant; may require transaction-critical behavior and extra retention/integrity controls | policy-defined queue, outage, escalation, and recovery | no default; production blocked until exact fail-open/fail-closed/deferred policy and owner are approved |

No queue, collector, or outbox is implemented here. Later architecture must prove equivalent behavior. Local queueing, if selected, requires bounded capacity, access control, encryption policy, crash recovery, observability, and secret-free content.

Validation failure, enqueue failure, buffer exhaustion, retry exhaustion, delayed delivery, and collector outage generate separate operational health signals. They must not recursively depend on the broken audit path or claim that the missing event was delivered.

### 15. Integrity metadata records limited evidence, not truth

| Property | What can establish it | What remains unproven |
|---|---|---|
| Transport authenticity | authenticated channel and receiver-side peer verification | that payload facts are truthful or complete |
| Producer identity | authenticated workload/service plus registry | that an authorized but compromised producer behaved correctly |
| Event-byte integrity | canonicalization plus signature/MAC/hash verification | correctness of pre-signing application state or timestamp |
| Storage integrity | access controls, immutable storage, checksums/attestation | records omitted before storage |
| Completeness | only bounded reconciliation against an independent authoritative sequence/outbox can provide scoped evidence | global completeness under compromised producer or unavailable independent source |
| Ordering | per-producer sequence/transaction/queue evidence within a documented scope | global causal or wall-clock total order across services |
| Truthful application state | independent state reconciliation and trustworthy producer logic may provide evidence | cannot be proven by signing alone |
| Non-repudiation | requires legal, identity, key-control, process, and jurisdictional analysis outside this contract | contract conformance or a signature is not by itself legal non-repudiation |

The contract supports an optional bounded attestation list but does not implement signing or chaining. A compromised producer can sign false or selectively omitted records; valid cryptography proves only the documented cryptographic statement.

### 16. Interoperability is explicit, version-pinned, and tested

#### OCSF

OCSF 1.8.0 is the initial comparison target. The mapping will select the closest class/category/profile per catalog event, map normalized status/time/metadata/actor/resource fields, and use a registered Bloodtrail extension only where necessary. Every row declares `exact`, `transformed`, `extended`, `unmapped`, or `lossy`. The internal contract does not expose OCSF numeric class/activity IDs to application code.

Because OCSF evolves independently, mapping occurs at ingestion/export and has its own supported source/target matrix. “OCSF compatible” is permitted only with a named version, event subset, profile/extension, and passing fixtures.

#### OpenTelemetry

OpenTelemetry Specification 1.59.0 and Semantic Conventions 1.43.0 are the initial targets:

| Canonical | OpenTelemetry |
|---|---|
| `event.timestamp` | `Timestamp` |
| `event.observed_at` | `ObservedTimestamp` at the stage that observes/exports; later stages do not overwrite canonical occurrence |
| trace/span IDs | native `TraceId` / `SpanId` |
| `event.name` | `EventName` |
| service/deployment/producer stable context | `Resource` and `InstrumentationScope` according to pinned conventions |
| selected bounded query/routing fields | namespaced `Attributes` |
| canonical event payload | structured `Body` only if the chosen OTLP representation and privacy/size policy require it; no arbitrary or prohibited body |

The mapping avoids duplicating authoritative values across Body and Attributes unless a documented precedence and equality check exists. OTLP transport is optional; OpenTelemetry does not become schema owner.

#### CloudEvents

CloudEvents is **not required** for the canonical contract. It is allowed only as an optional transport envelope when a later messaging architecture needs protocol-neutral routing. The mapping is:

- `id` = canonical `event.id`;
- `source` = registered producer URI, not a user-controlled value;
- `type` = canonical `event.name`;
- `time` = canonical occurrence timestamp;
- `dataschema` = immutable canonical schema URI;
- `subject` = omitted by default or a non-sensitive resource reference approved for routing;
- `data` = canonical event;
- extension context attributes = no sensitive actor, tenant, token, session, resource, or authorization data.

CloudEvents `specversion` is separate from Bloodtrail `schema.version`. Conflicts reject the message. This optional decision is recorded by ADR-004 so later implementations cannot introduce an envelope casually.

### 17. Initial catalog

“Core” below means every `R` field plus context required by its actor/tenant/request model. Delivery and retention are proposed minimums; the apply phase must test them and ADR-005/ADR-006 must approve them before final contract approval.

| Event name | Purpose and trigger | Additional required context | Authoritative producer | Outcomes | Privacy / retention | Delivery | Investigation value |
|---|---|---|---|---|---|---|---|
| `bloodtrail.audit.account.registration.attempted` | Record an accepted, rejected, or failed registration attempt; does not assert account creation | claimed/anonymous actor, request, source policy, operation ID, target tenant if resolved, reason | server registration boundary | `success`, `failure`, `denied`, `cancelled`; phase `attempted` | account claims restricted; `security_standard` | `security_significant` | abuse patterns, denied attempts, correlation to completion |
| `bloodtrail.audit.account.registration.completed` | Record final committed registration result | subject account, effective/owner tenant, operation/causation, commit state, resource | account transaction owner | `success`, `failure`, `partial`, `cancelled` | account IDs restricted; `security_elevated` | `transaction_critical` | provenance of account creation and failed completion |
| `bloodtrail.audit.authentication.succeeded` | Record authoritative successful authentication | authenticated principal, method, assurance, MFA, IdP, credential type/ref, session, source | authentication authority | `success` | identity/session/source restricted; `security_standard` | `security_significant` | account access, assurance, session linkage |
| `bloodtrail.audit.authentication.failed` | Record failed authentication without secret/account enumeration leakage | claimed/anonymous actor, method if known, controlled reason, source, operation/request | authentication authority | `failure` | claims/source restricted; `security_standard` | `security_significant` | brute force, credential abuse, recovery issues |
| `bloodtrail.audit.authentication.mfa.enrolled` | Record committed enrollment of an MFA method without factor contents | actor, subject, tenant, authentication, authorization, factor type, resource, commit | MFA/account authority | `success`, `failure`, `denied` | factor metadata restricted; `security_elevated` | `transaction_critical` | account-security posture change |
| `bloodtrail.audit.authentication.mfa.removed` | Record committed or denied MFA removal | actor, subject, tenant, authentication, authorization, factor type, reason, commit | MFA/account authority | `success`, `failure`, `denied` | factor metadata/recovery restricted; `security_elevated` | `transaction_critical` | takeover/recovery investigation |
| `bloodtrail.audit.session.created` | Record creation of an authenticated session | principal, authentication, non-secret session ref, tenant, source, expiration policy ref | session authority | `success` | session/identity/source restricted; `security_standard` | `security_significant` | session provenance and login correlation |
| `bloodtrail.audit.session.revoked` | Record committed session revocation | actor, subject session/account, tenant, authorization, reason, commit, original session/create link | session authority | `success`, `failure`, `denied` | session/identity restricted; `security_elevated` | `transaction_critical` | containment, logout/admin revocation history |
| `bloodtrail.audit.account.password_reset.requested` | Record reset request handling without revealing account existence externally | anonymous/actor claim, subject only if safely resolved, source, request/operation, controlled reason | recovery authority | `success`, `failure`, `denied` | recovery/identity/source restricted; `security_standard` | `security_significant` | reset abuse and precursor correlation |
| `bloodtrail.audit.account.password_reset.completed` | Record committed password reset without credential contents | actor/subject, tenant, recovery context, authentication, session impact, commit, causation | account/recovery transaction owner | `success`, `failure`, `denied` | recovery/identity restricted; `security_elevated` | `transaction_critical` | takeover and credential lifecycle |
| `bloodtrail.audit.authorization.allowed` | Preserve a policy allow decision independently of operation result | actor/principal, tenant, resource, full authorization context, request/operation | policy decision/enforcement point | `success` with decision `allow` | policy/resource/identity restricted; `operational_short` or catalog override | `best_effort` minimum; sensitive/break-glass cases strengthen | explain access path and policy version |
| `bloodtrail.audit.authorization.denied` | Preserve a policy deny decision and attempted action | actor/claim, tenant/resource, authorization context, source/request | policy decision/enforcement point | `denied` | policy/resource/identity restricted; `security_standard` | `security_significant` | attack/access-control investigation |
| `bloodtrail.audit.authorization.role.assigned` | Record committed role assignment | admin actor, subject, tenant, role resource, authorization, reason, commit | identity/authorization transaction owner | `success`, `failure`, `denied` | role/identity restricted; `security_elevated` | `transaction_critical` | privilege provenance |
| `bloodtrail.audit.authorization.role.removed` | Record committed role removal | admin actor, subject, tenant, role resource, authorization, reason, commit | identity/authorization transaction owner | `success`, `failure`, `denied` | role/identity restricted; `security_elevated` | `transaction_critical` | privilege revocation history |
| `bloodtrail.audit.authorization.privilege.elevated` | Record temporary/permanent privilege elevation or break-glass use | real actor, subject/delegation, tenant, capability/scope, authorization, reason, expiry, commit | privilege authority/enforcement point | `success`, `failure`, `denied` | highly restricted; `policy_governed` | `policy_critical` | high-value escalation and abuse evidence |
| `bloodtrail.audit.administration.impersonation.started` | Record start of approved administrative impersonation | real admin actor, impersonated subject, both tenants, scope, reason, policy, session/expiry, commit | impersonation authority | `success`, `failure`, `denied` | highly restricted; `policy_governed` | `policy_critical` | accountability during impersonation |
| `bloodtrail.audit.administration.impersonation.ended` | Record termination/expiry of impersonation | real actor/process, impersonated subject, original start/session, reason, commit | impersonation/session authority | `success`, `failure` | highly restricted; `policy_governed` | `policy_critical` | close accountability interval |
| `bloodtrail.audit.data.sensitive_resource.viewed` | Record successful, denied, or failed read of cataloged sensitive resource | actor/principal, tenant, resource/classification, authorization, request, outcome | resource access/enforcement owner | `success`, `failure`, `denied` | resource/identity restricted; `security_elevated` | `security_significant` | inappropriate access and disclosure investigation |
| `bloodtrail.audit.data.sensitive_resource.created` | Record committed creation of sensitive resource | actor, tenant/owner, resource/classification, authorization, operation/transaction, commit | resource transaction owner | `success`, `failure`, `denied` | resource metadata restricted; `security_elevated` | `transaction_critical` | creation provenance |
| `bloodtrail.audit.data.sensitive_resource.modified` | Record committed modification of sensitive resource | actor, tenant/owner, resource/classification, authorization, bounded change categories, commit | resource transaction owner | `success`, `failure`, `denied`, `partial` | no before/after body; restricted; `security_elevated` | `transaction_critical` | tampering/change investigation |
| `bloodtrail.audit.data.sensitive_resource.deleted` | Record committed deletion of sensitive resource | actor, tenant/owner, resource/classification, authorization, deletion mode, commit | resource transaction owner | `success`, `failure`, `denied`, `partial` | no deleted content; restricted; `security_elevated` | `transaction_critical` | destructive action/accountability |
| `bloodtrail.audit.data.sensitive_data.exported` | Record export attempt/completion without exported data | actor, tenant, resource/scope/classification, authorization, bounded counts/size class, destination class, commit | export transaction owner | `success`, `failure`, `denied`, `partial`, `cancelled` | highly restricted; `policy_governed` | `policy_critical` | exfiltration, compliance, business investigation |
| `bloodtrail.audit.security.configuration.changed` | Record committed change to security-relevant configuration | actor, tenant/platform scope, config resource, authorization, controlled change category, commit | configuration transaction owner | `success`, `failure`, `denied`, `partial` | configuration metadata restricted; `security_elevated` | `transaction_critical` | control-plane change history |
| `bloodtrail.audit.tenant.context_violation.detected` | Record mismatch, spoofing, or prohibited cross-tenant attempt | actor/claim, authoritative and claimed tenants, resource owner, request/source, authorization, reason | tenancy/resource/enforcement boundary | `denied`, `failure`, `unknown` | tenant/identity/source highly restricted; `security_elevated` | `security_significant` | isolation failures and attack detection |

Catalog event names describe semantics, not a guarantee that every listed event is immediately instrumented. Production instrumentation requires later changes and readiness review.

### 18. Architecture decision records are approval prerequisites

The apply phase must create and resolve these ADRs before final contract approval:

1. **ADR-001 — Canonical model versus direct OCSF:** confirm Bloodtrail canonical ownership, OCSF 1.8.0 mapping scope, extension policy, and loss criteria.
2. **ADR-002 — Authoritative schema source and JSON Schema dialect:** select source format, Draft 2020-12 or justified alternative, schema URI/version layout, code generation boundary, and deterministic build.
3. **ADR-003 — Identifier, timestamp, and causality formats:** select event/operation/correlation ID formats, retry numbering, timestamp precision, skew thresholds, and W3C trust-boundary behavior.
4. **ADR-004 — OpenTelemetry and CloudEvents representation:** pin OTel versions, map native fields, decide Body/Attributes duplication policy, confirm CloudEvents remains optional or document a justified change.
5. **ADR-005 — Delivery classes and failure posture:** approve class semantics, event assignments, durability boundary, dedupe, outage/backpressure/shutdown behavior, and events blocked pending a policy-critical decision.
6. **ADR-006 — Privacy, pseudonymization, and retention classes:** approve field policy, transformation key scope/rotation metadata, tenant access, export redaction, and the process for assigning actual retention durations.
7. **ADR-007 — Actor, tenant, and resource authority:** approve resolution order, cross-tenant/platform semantics, delegation/impersonation chain, and authority-escalation rejection.
8. **ADR-008 — Schema evolution and compatibility:** approve SemVer interpretation, producer/consumer matrix, catalog/enum additions, deprecation windows, and migration fixtures.

Each ADR records primary evidence, alternatives, decision, consequences, unresolved implementation choices, owner, date, and exact approved contract commit where applicable.

### 19. Unresolved decisions that must be closed during this change

These are not deferred to the SDK. They are explicit apply tasks and approval blockers:

- authoritative source format and exact JSON Schema dialect/tooling;
- event/correlation identifier formats, timestamp precision, retry base, and acceptable skew policy;
- exact field size, list cardinality, object depth, and message limits;
- exact controlled vocabularies and stable reason-code taxonomy;
- OCSF 1.8.0 class/profile/extension mapping for every initial event and acceptable losses;
- OpenTelemetry Body-versus-Attributes representation and supported OTLP mapping scope;
- confirmation that CloudEvents remains optional and exact conflict handling;
- transformation algorithms, key scoping/rotation metadata, and which fields require direct values versus pseudonyms;
- actual retention-duration decision process and which catalog entries remain blocked pending privacy/legal or operational policy;
- final delivery class for each catalog event, policy-critical fail posture, queue/durability behavioral acceptance criteria, and alert thresholds;
- whether a single catalog/schema version is sufficient or a separately versioned catalog is necessary;
- exact stakeholder review packet and final owner approval record.

No SDK implementation may choose these implicitly.

## Risks / Trade-offs

- **[Broad envelope encourages collection]** → Default-deny field registry, catalog-specific conditional fields, prohibited-data scanning, bounded examples, and no arbitrary object escape hatch.
- **[Strict controlled vocabularies slow new event delivery]** → Lightweight reviewed catalog/extension process and compatibility-tested minor releases; unknown semantics remain safer than silent drift.
- **[One schema becomes too coupled to TypeScript]** → JSON-compatible semantic source, language-neutral tests, and runtime validation independent of generated TypeScript.
- **[Authority labels create false confidence]** → Labels describe provenance and permitted conclusions, not universal truth; integrity-limit documentation and negative fixtures remain normative.
- **[Transaction-critical delivery harms availability]** → Apply only to cataloged events whose evidence must be atomic; best-effort/security-significant classes preserve proportionate behavior.
- **[Policy-critical class is underspecified without legal/operational input]** → Block production for those events until a named policy and owner approve fail posture, retention, and access; do not invent a default.
- **[At-least-once delivery creates duplicates]** → Immutable event IDs, retry stability, idempotent consumers, and duplicate fixtures.
- **[Clock skew damages timelines]** → Preserve occurrence and observation timestamps, record skew, correlate causally, and avoid claiming total order.
- **[Mappings lose canonical semantics]** → Version-pin, enumerate losses, use explicit extensions, test fixtures, and avoid “full compatibility” claims.
- **[Pseudonyms enable unintended cross-tenant tracking]** → Purpose- and tenant-scoped keyed transforms by default, access controls, key-version metadata, and explicit review for broader scope.
- **[Audit storage becomes a new sensitive dataset]** → Data minimization, tenant boundaries, retention classes, export redaction, and separate production privacy/security review.
- **[Current repository lacks production context]** → Keep responsibility boundaries logical, label assumptions, and require later implementation changes to define concrete components and validate architecture-specific constraints.

## Migration Plan

There is no runtime migration in this change.

1. Complete the research comparison and ADRs.
2. Materialize the canonical registry/schema, catalog, policies, mappings, examples, and negative fixtures under a repository-owned contract path.
3. Run schema, semantic, privacy, mapping, and compatibility tests in read-only verification mode.
4. Reconcile human-readable and machine-readable artifacts and run strict OpenSpec validation.
5. Obtain stakeholder review and an explicit project-owner final contract decision bound to the exact reviewed commit. Technical checks alone do not approve the contract.
6. Merge and archive this change only after the governed lifecycle permits it.
7. Propose `implement-security-audit-sdk-core` separately. That change consumes the approved contract and selects implementation dependencies; it does not redefine basic semantics.
8. Propose collector, transport, storage, SIEM, analytics, and production instrumentation separately as needed.

Before approval, rollback means removing or revising proposal artifacts; no runtime state exists. After approval, a contract mistake follows the versioning/deprecation policy rather than silently rewriting released meaning.

## Open Questions

None are safely deferrable beyond contract approval. The unresolved decisions above are explicit tasks and approval blockers within this change.
