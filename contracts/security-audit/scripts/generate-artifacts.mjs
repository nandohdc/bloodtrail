#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "source/contract.source.json");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const check = process.argv.includes("--check");
const generated = [];

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function emit(path, content) {
  const full = resolve(root, path);
  generated.push(path);
  if (check) {
    const existing = await readFile(full, "utf8");
    assert.equal(existing, content, `${path} is stale; run npm run generate`);
    return;
  }
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content);
}

function title(text) {
  return text.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replaceAll("\n", "<br>")).join(" | ")} |`)
  ].join("\n");
}

// Renders a Markdown bullet list. Extracted so the validation document's emitter
// does not nest a template literal inside its own template literal, which is what
// the line this change already had to touch would otherwise inherit. The identical
// pattern on the emitters this change does not touch is deliberately left alone:
// rewriting them would widen a frozen-contract diff beyond this correction.
function bulletList(values) {
  return values.map((value) => `- ${value}`).join("\n");
}

function generatedHeader(label) {
  return `# ${label}\n\n> ${source.metadata.generated_artifact_notice}\n\n`;
}

function enumValues(name) {
  if (name === "event_names") return source.catalog.map((e) => e.name);
  return source.registries[name] ?? [];
}

// String formats a field may declare, keyed by its `fmt`. validate-contract.mjs
// interprets the same names, so the schema and the canonical validator agree.
const SCHEMA_FORMATS = Object.freeze({
  "date-time": "date-time",
  uri: "uri"
});
const SCHEMA_PATTERNS = Object.freeze({
  uuid: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
  "uuid-v4": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
  semver: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$",
  "w3c-trace-id": "^(?!0{32})[0-9a-f]{32}$",
  "w3c-span-id": "^(?!0{16})[0-9a-f]{16}$"
});

function schemaForField(field) {
  const schema = {};
  if (field.t === "integer") {
    schema.type = "integer";
    schema.minimum = 0;
    if (typeof field.max === "number") schema.maximum = field.max;
  } else if (field.t === "number") {
    schema.type = "number";
    schema.minimum = 0;
    if (typeof field.max === "number") schema.maximum = field.max;
  } else if (field.t === "boolean") {
    schema.type = "boolean";
  } else if (field.t === "array") {
    schema.type = "array";
    schema.maxItems = typeof field.max === "number" ? field.max : source.bounds.array_max_items;
    schema.items = schemaForArrayItem(field.items);
  } else {
    schema.type = "string";
    schema.minLength = 1;
    schema.maxLength = field.max ?? source.bounds.default_string_max;
    if (Object.hasOwn(SCHEMA_FORMATS, field.fmt)) schema.format = SCHEMA_FORMATS[field.fmt];
    if (Object.hasOwn(SCHEMA_PATTERNS, field.fmt)) schema.pattern = SCHEMA_PATTERNS[field.fmt];
  }
  if (field.enum) schema.enum = enumValues(field.enum);
  return schema;
}

function schemaForArrayItem(item) {
  if (item?.t === "string") {
    const schema = { type: "string" };
    if (typeof item.min === "number") schema.minLength = item.min;
    if (typeof item.max === "number") schema.maxLength = item.max;
    return schema;
  }
  return { type: ["string", "object"], additionalProperties: true };
}

function markRequired(node, part) {
  node.required ??= [];
  if (!node.required.includes(part)) node.required.push(part);
}

function addField(rootSchema, field) {
  const parts = field.p.split(".");
  const parent = parts.slice(0, -1).reduce((node, part) => {
    node.properties ??= {};
    node.properties[part] ??= { type: "object", additionalProperties: false, unevaluatedProperties: false, properties: {}, required: [] };
    return node.properties[part];
  }, rootSchema);
  parent.properties ??= {};
  parent.properties[parts.at(-1)] = schemaForField(field);
  if (field.r === "required") markRequiredPath(rootSchema, parts, requiredFromDepth(field, parts));
}

// A required member of an optional object makes every intermediate object
// between that anchor and the member required too, so a present anchor can
// never omit a nested object whose members the contract requires. Without an
// anchor only the member itself is required, in its own parent.
function requiredFromDepth(field, parts) {
  return field.required_with ? field.required_with.split(".").length : parts.length - 1;
}

function markRequiredPath(rootSchema, parts, fromDepth) {
  let node = rootSchema;
  parts.forEach((part, depth) => {
    if (depth >= fromDepth) markRequired(node, part);
    node = node.properties[part];
  });
}

function buildSchema() {
  const schema = {
    "$schema": source.metadata.schema_dialect,
    "$id": source.metadata.schema_id,
    "$comment": source.metadata.generated_artifact_notice,
    title: "Bloodtrail Security Audit Event",
    type: "object",
    additionalProperties: false,
    unevaluatedProperties: false,
    required: ["event", "schema", "producer", "environment", "service", "tenant", "actor", "initiator", "resource", "correlation", "data"],
    properties: {}
  };
  for (const field of source.fields) addField(schema, field);
  schema.properties.extensions = {
    type: "object",
    additionalProperties: false,
    maxProperties: source.bounds.extension_max_namespaces,
    properties: {
      "bloodtrail.audit.enrichment.v1": {
        type: "object",
        additionalProperties: false,
        unevaluatedProperties: false,
        required: ["provenance"],
        properties: {
          provenance: {
            type: "object",
            additionalProperties: false,
            unevaluatedProperties: false,
            required: ["trust_level", "source", "version"],
            properties: {
              trust_level: { const: "downstream_enrichment" },
              source: { type: "string", minLength: 1, maxLength: 128 },
              version: { type: "string", pattern: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$" }
            }
          },
          risk: {
            type: "object",
            additionalProperties: false,
            unevaluatedProperties: false,
            properties: {
              level: { enum: source.registries.risk_levels },
              reason_codes: { type: "array", maxItems: 16, items: { enum: source.registries.reason_codes } }
            }
          }
        }
      }
    }
  };
  return schema;
}

function iso(n) {
  return `2026-07-31T12:${String(n).padStart(2, "0")}:00.000Z`;
}

function id(n) {
  return `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
}

function tenant(scope) {
  if (scope === "tenantless") return { scope };
  if (scope === "platform") return { scope, actor_tenant_id: "tenant_platform" };
  if (scope === "cross_tenant") return { scope, actor_tenant_id: "tenant_platform", effective_tenant_id: "tenant_beta", resource_tenant_id: "tenant_beta", claimed_tenant_id: "claimed_tenant_alpha" };
  return { scope, actor_tenant_id: "tenant_alpha", effective_tenant_id: "tenant_alpha", resource_tenant_id: "tenant_alpha" };
}

function actor(type, scope) {
  const base = { type, provenance: { trust_level: type === "anonymous" ? "client_claim" : "authoritative_server", source: type === "anonymous" ? "request_boundary" : "authentication_authority" } };
  if (type !== "anonymous") {
    base.id = `${type}_001`;
    base.tenant_id = scope === "cross_tenant" || scope === "platform" ? "tenant_platform" : "tenant_alpha";
  }
  return base;
}

// From 2.0.0 every risk result lists its material inputs. The second fixture derives from a
// client_claim input and so declares client_claim: the floor admits a truthful lower claim.
function fixtureRisk(entry, index) {
  const clientDerived = index === 1;
  const policyCritical = entry.delivery === "policy_critical";
  return {
    level: policyCritical ? "high" : "low",
    score: policyCritical ? 80 : 15,
    reason_codes: ["policy_baseline"],
    model: {
      name: "fixture-risk",
      version: "1.0.0",
      provenance: {
        trust_level: clientDerived ? "client_claim" : "derived_server",
        derived_from: clientDerived ? ["event.name", "request.user_agent"] : ["event.name", "event.outcome"]
      }
    }
  };
}

// From 2.1.0 a record may carry one bounded v1 client-evidence reference. Every
// value comes from the closed registries, so the fixture tracks the source.
function clientEvidenceReference() {
  const registries = source.registries;
  return {
    interaction_id: "11111111-1111-4111-8111-111111111111",
    interaction_kind: "button_click",
    envelope_version: registries.client_evidence_envelope_versions[0],
    provenance: {
      source: registries.client_evidence_sources[0],
      trust_level: registries.client_evidence_trust_levels[0],
      platform: registries.client_evidence_platforms[0],
      capture_scope: registries.client_evidence_capture_scopes[0]
    }
  };
}

// Exactly one canonical fixture carries the optional v1 reference. The remaining
// fixtures deliberately omit it, preserving absence semantics.
function fixtureClientEvidence(index) {
  return index === 1 ? clientEvidenceReference() : undefined;
}

function makeEvent(entry, index) {
  const ex = entry.example;
  const phase = ex.phase ?? entry.phase[0];
  const outcome = ex.outcome;
  const commit = ex.commit;
  const scope = ex.tenant;
  const tenantObj = tenant(scope);
  const allow = ex.authorization ?? (outcome === "denied" ? "deny" : "allow");
  const event = {
    event: {
      id: id(index + 1),
      name: entry.name,
      category: entry.category,
      action: entry.action,
      lifecycle_phase: phase,
      outcome,
      outcome_reason: { code: outcome === "success" ? "completed" : outcome === "cancelled" ? "cancelled_by_actor" : outcome === "denied" ? "policy_denied" : outcome === "partial" ? "partial_limit" : "system_error" },
      commit_state: commit,
      timestamp: iso(index % 60),
      observed_at: `2026-07-31T12:${String(index % 60).padStart(2, "0")}:01.000Z`,
      delivery_class: entry.delivery
    },
    schema: { name: source.metadata.schema_name, version: source.metadata.schema_version },
    producer: { name: entry.producer, version: "1.0.0", instance_id: `producer_${String(index + 1).padStart(2, "0")}` },
    environment: { name: "development" },
    service: { name: entry.producer, version: "1.0.0" },
    deployment: { id: "deploy_contract_fixture", region: "local", zone: "local-a" },
    tenant: tenantObj,
    actor: actor(ex.actor, scope),
    subject: { type: ex.resource, id: `${ex.resource}_subject_${index + 1}`, tenant_id: tenantObj.resource_tenant_id ?? tenantObj.effective_tenant_id ?? "tenant_none" },
    credential: { type: ex.resource === "credential" ? "password" : "session", reference: `cred_ref_${index + 1}`, key_id: "pseudonym-key-v1" },
    initiator: { type: ex.initiator, id: `${ex.initiator}_fixture`, version: "1.0.0" },
    session: { id: `session_ref_${index + 1}`, created_at: "2026-07-31T11:55:00.000Z", age_seconds: 300, assurance_level: "aal2" },
    authentication: {
      method: entry.action === "authenticate" ? "password_mfa" : "session",
      assurance_level: "aal2",
      mfa_state: entry.name.includes("failed") ? "failed" : "satisfied",
      credential_type: "session",
      authenticated_at: "2026-07-31T11:55:00.000Z",
      identity_provider: "https://idp.example.test",
      delegated: Boolean(ex.delegated),
      impersonated: Boolean(ex.impersonated),
      failure_reason: outcome === "failure" ? "credential_invalid" : undefined,
      account_recovery: entry.action.includes("password_reset") ? { flow: "password_reset", state: outcome === "success" ? "completed" : "attempted", reason_code: "accepted" } : undefined
    },
    authorization: {
      decision: allow,
      policy_id: "policy.audit-fixture",
      policy_version: "1.0.0",
      capability: entry.action,
      enforcement_point: entry.producer,
      decision_reason: allow === "deny" ? "policy_denied" : "accepted",
      resource_context: { type: ex.resource, id: `${ex.resource}_${index + 1}` },
      tenant_context: { effective_tenant_id: tenantObj.effective_tenant_id ?? "tenant_none" },
      override: Boolean(ex.break_glass),
      break_glass: Boolean(ex.break_glass),
      policy_correlation_id: `policy_corr_${index + 1}`
    },
    source: { observed: { address: "203.0.113.10", port: 443, proxy_chain: [{ address: "198.51.100.10", trust_level: "observed_transport", observed_by: "trusted-ingress" }] }, client_reported: { user_agent_family: "ExampleBrowser", user_agent_version: "1" } },
    destination: { service: entry.producer, address: "service.local", port: 443 },
    resource: {
      type: ex.resource,
      id: `${ex.resource}_${index + 1}`,
      owning_tenant_id: tenantObj.resource_tenant_id ?? tenantObj.effective_tenant_id ?? "tenant_none",
      data_classification: entry.retention === "policy_governed" ? "restricted" : "confidential",
      operation_type: ex.operation,
      bulk: ex.operation === "export" || outcome === "partial" ? { count: 12, scope: "bounded_fixture_scope", child_event_policy: "aggregate_only" } : undefined,
      change_categories: ["metadata"],
      deletion_mode: ex.operation === "delete" ? "soft_delete" : undefined,
      export: ex.operation === "export" ? { destination_class: "tenant_authorized_download", size_class: "small", record_count: 12 } : undefined
    },
    request: { id: `request_${index + 1}`, method: "POST", route: "/contract-fixtures/{resource}", user_agent: "ExampleBrowser/1", message_id: `message_${index + 1}` },
    correlation: {
      trace_id: `1234567890abcdef1234567890abcde${String(index % 10)}`,
      span_id: `1234567890abcde${String(index % 10)}`,
      correlation_id: `corr_${index + 1}`,
      causation_id: phase === "attempted" && index < 2 ? undefined : id(Math.max(1, index)),
      operation_id: `operation_${entry.semantic}`,
      transaction_id: commit === "not_applicable" || commit === "not_started" ? undefined : `txn_${index + 1}`,
      request_id: `request_${index + 1}`,
      message_id: `message_${index + 1}`,
      retry_attempt: 0,
      original_event_id: phase === "compensating" || entry.semantic.endsWith("_completed") ? id(Math.max(1, index)) : undefined
    },
    client_evidence: fixtureClientEvidence(index),
    risk: fixtureRisk(entry, index),
    data: { classification: entry.retention === "policy_governed" ? "restricted" : "confidential", retention_class: entry.retention, field_policy_version: source.metadata.field_policy_version },
    integrity: { transport_authentication: { method: "mtls", verified: true, peer: "producer-registry/ref" } }
  };
  if (entry.name.includes("authentication.failed")) {
    delete event.authenticated_principal;
    delete event.session;
  } else if (ex.actor !== "anonymous") {
    event.authenticated_principal = { type: ex.actor === "workload_identity" ? "workload" : ex.actor === "external_integration" ? "external_integration" : "human_user", id: `principal_${index + 1}`, issuer: "https://idp.example.test" };
  }
  if (ex.delegated || ex.impersonated || entry.delivery === "policy_critical") {
    event.delegation = {
      mode: ex.impersonated ? "impersonation" : "delegated",
      principal_id: `delegated_principal_${index + 1}`,
      scope: [entry.action],
      reason_code: ex.break_glass ? "break_glass" : "operator_requested",
      expires_at: "2026-07-31T13:00:00.000Z",
      chain: [{ type: "human_user", principal_id: `principal_${index + 1}`, mode: "approved" }]
    };
  }
  if (index === 0) {
    event.extensions = {
      "bloodtrail.audit.enrichment.v1": {
        provenance: { trust_level: "downstream_enrichment", source: "contract-test-harness", version: "1.0.0" },
        risk: { level: "low", reason_codes: ["policy_baseline"] }
      }
    };
  }
  return JSON.parse(JSON.stringify(event));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function set(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts.slice(0, -1)) cur = cur[part] ??= {};
  cur[parts.at(-1)] = value;
}

function del(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts.slice(0, -1)) cur = cur?.[part];
  if (cur) delete cur[parts.at(-1)];
}

function negativeFixtures(positive) {
  const base = positive.find((e) => e.actor.id && e.tenant.scope === "tenant" && e.event.outcome === "success" && e.event.commit_state === "committed") ?? positive[1];
  const fixtures = [];
  const add = (name, expected, mutate) => {
    const event = clone(base);
    mutate(event);
    fixtures.push({ name, expected_errors: [expected], event });
  };
  add("missing-required-actor", "MISSING_REQUIRED_ACTOR", (e) => del(e, "actor"));
  add("missing-tenant-context", "MISSING_TENANT_CONTEXT", (e) => { e.tenant = { scope: "tenant" }; });
  add("tenant-resource-conflict", "TENANT_RESOURCE_CONFLICT", (e) => { e.resource.owning_tenant_id = "tenant_conflict"; });
  add("unknown-event-action", "UNKNOWN_CATALOG_VALUE", (e) => { e.event.name = "bloodtrail.audit.account.tenant_abc.created"; e.event.action = "create_user_123"; });
  add("unsupported-schema-version", "UNSUPPORTED_SCHEMA_VERSION", (e) => { e.schema.version = "9.0.0"; });
  add("prohibited-data", "PROHIBITED_DATA", (e) => { e.authentication.raw_token = "SECRET_TOKEN_SHOULD_NOT_APPEAR"; });
  add("raw-token", "PROHIBITED_DATA", (e) => { e.credential.raw_access_token = "SYNTHETIC_PROHIBITED_TOKEN"; });
  add("oversized-value", "FIELD_LIMIT_EXCEEDED", (e) => { e.actor.display_name = "x".repeat(source.bounds.display_string_max + 20); });
  add("client-authority-escalation", "AUTHORITY_ESCALATION", (e) => { e.actor.provenance.trust_level = "client_claim"; });
  add("client-claimed-authenticated-identity", "AUTHORITY_ESCALATION", (e) => { e.actor.provenance = { trust_level: "client_claim", source: "request.body.actor" }; });
  add("forged-tenant-attribution", "TENANT_RESOURCE_CONFLICT", (e) => { e.tenant.claimed_tenant_id = "tenant_forged"; e.resource.owning_tenant_id = "tenant_forged"; });
  add("premature-success", "PREMATURE_SUCCESS", (e) => { e.event.lifecycle_phase = "completed"; e.event.outcome = "success"; e.event.commit_state = "pending"; });
  add("authorization-outcome-conflation", "AUTHORIZATION_OUTCOME_CONFLICT", (e) => { e.authorization.decision = "allow"; e.event.outcome = "denied"; });
  add("bad-causality", "BAD_CAUSALITY", (e) => { e.event.id = e.correlation.causation_id; });
  add("retry-without-original-event", "BAD_CAUSALITY", (e) => { e.correlation.retry_attempt = 1; delete e.correlation.original_event_id; });
  add("async-completion-without-causation", "BAD_CAUSALITY", (e) => { const completed = positive.find((event) => source.catalog.find((entry) => entry.name === event.event.name)?.semantic.endsWith("_completed")); Object.assign(e, clone(completed)); delete e.correlation.causation_id; delete e.correlation.original_event_id; });
  add("invalid-delegation", "INVALID_DELEGATION", (e) => { e.authentication.impersonated = true; e.delegation = { mode: "impersonation" }; });
  add("unsupported-extension", "UNKNOWN_EXTENSION", (e) => { e.extensions = { "evil.vendor.v1": { actor: { id: "tenant_conflict" } } }; });
  add("browser-client-authority-claim", "AUTHORITY_ESCALATION", (e) => { e.actor.provenance = { trust_level: "client_claim", source: "browser" }; });
  add("client-evidence-invalid-provenance", "UNKNOWN_CATALOG_VALUE", (e) => {
    e.client_evidence = clientEvidenceReference();
    e.client_evidence.provenance.source = "server_observed";
  });
  add("client-evidence-trust-escalation", "UNKNOWN_CATALOG_VALUE", (e) => {
    e.client_evidence = clientEvidenceReference();
    e.client_evidence.provenance.trust_level = "authoritative_server";
  });
  add("client-evidence-unknown-envelope-version", "UNKNOWN_CATALOG_VALUE", (e) => {
    e.client_evidence = clientEvidenceReference();
    e.client_evidence.envelope_version = 2;
  });
  add("client-evidence-missing-provenance", "FIELD_LIMIT_EXCEEDED", (e) => {
    e.client_evidence = clientEvidenceReference();
    delete e.client_evidence.provenance;
  });
  add("client-evidence-oversized-interaction-id", "FIELD_LIMIT_EXCEEDED", (e) => {
    e.client_evidence = clientEvidenceReference();
    e.client_evidence.interaction_id = `${e.client_evidence.interaction_id}0`;
  });
  add("client-evidence-server-owned-member", "UNKNOWN_CATALOG_VALUE", (e) => {
    e.client_evidence = clientEvidenceReference();
    e.client_evidence.risk = { level: "low" };
  });
  add("arbitrary-object-body", "PROHIBITED_DATA", (e) => { e.request.full_request = { arbitrary: "object" }; });
  add("ambiguous-actor-attribution", "MISSING_REQUIRED_ACTOR", (e) => { e.actor = {}; });
  const provenance = source.derived_field_provenance;
  const setDerivedInputs = (event, inputs) => { event.risk.model.provenance.derived_from = inputs; };
  add("derived-from-malformed", provenance.error_codes.malformed, (e) => { setDerivedInputs(e, ["event.name", 1]); });
  add("derived-from-duplicate", provenance.error_codes.duplicate, (e) => { setDerivedInputs(e, ["event.name", "event.name"]); });
  add("derived-from-unresolvable", provenance.error_codes.unresolvable, (e) => { setDerivedInputs(e, ["event.name", "not.a.canonical.field"]); });
  add("derived-from-absent", provenance.error_codes.absent, (e) => { setDerivedInputs(e, ["event.name", "subject.display_name"]); });
  add("derived-from-unordered", provenance.error_codes.noncanonical_order, (e) => { setDerivedInputs(e, ["event.outcome", "event.name"]); });
  // Pins canonical_order to Unicode code points rather than UTF-16 code units. U+10000 is a
  // higher code point than U+FF01 but its lead surrogate (U+D800) is a lower code unit, so this
  // pair is ascending under `<` and descending by code point. A validator that compares with `<`
  // admits it here and reports the later unresolvable-input outcome instead.
  add("derived-from-astral-order", provenance.error_codes.noncanonical_order, (e) => { setDerivedInputs(e, ["\u{10000}", "！"]); });
  add("derived-from-empty", provenance.error_codes.empty, (e) => { setDerivedInputs(e, []); });
  add("derived-from-non-derived", provenance.error_codes.non_derived, (e) => { e.risk.model.provenance.trust_level = "observed_transport"; setDerivedInputs(e, ["event.name", "event.outcome"]); });
  add("derived-from-cycle", provenance.error_codes.cycle, (e) => { setDerivedInputs(e, [provenance.field_path]); });
  add("derived-from-risk-cycle", provenance.error_codes.cycle, (e) => { setDerivedInputs(e, ["event.name", "risk.score"]); });
  add("derived-from-missing", provenance.error_codes.missing, (e) => { delete e.risk.model.provenance.derived_from; });
  add("derived-from-missing-trust-level", provenance.error_codes.missing, (e) => { delete e.risk.model.provenance.trust_level; });
  add("derived-from-trust-floor", provenance.error_codes.trust_floor, (e) => { setDerivedInputs(e, ["event.name", "request.user_agent"]); });
  return fixtures;
}

function mappingFixtures(positive) {
  const ocsf = positive.map((event) => {
    const entry = source.catalog.find((item) => item.name === event.event.name);
    return {
      canonical_event_name: event.event.name,
      target: "OCSF",
      target_version: source.mapping_policy.ocsf.target_version,
      boundary: source.mapping_policy.ocsf.boundary,
      mapping_status: entry.ocsf.status,
      selected_class: entry.ocsf.class,
      status_mapping: "canonical outcome transformed to OCSF status and status_id where available",
      losses: entry.ocsf.status === "lossy" ? ["OCSF target does not preserve all Bloodtrail delivery and tenant authority semantics without extension"] : [],
      extension_owner: "bloodtrail",
      full_compatibility_claim: false
    };
  });
  const otel = positive.map((event) => ({
    canonical_event_name: event.event.name,
    target: "OpenTelemetry",
    spec_version: source.mapping_policy.opentelemetry.spec_version,
    semconv_version: source.mapping_policy.opentelemetry.semconv_version,
    timestamp: event.event.timestamp,
    observed_timestamp: event.event.observed_at,
    event_name: event.event.name,
    trace_id: event.correlation.trace_id,
    span_id: event.correlation.span_id,
    resource: { "service.name": event.service.name, "service.version": event.service.version, "deployment.environment.name": event.environment.name },
    instrumentation_scope: { name: "com.bloodtrail.security-audit.contract", version: source.metadata.schema_version },
    attributes: { "bloodtrail.audit.category": event.event.category, "bloodtrail.audit.action": event.event.action, "bloodtrail.audit.delivery_class": event.event.delivery_class },
    body: { schema_name: event.schema.name, schema_version: event.schema.version, event_id: event.event.id },
    body_policy: source.mapping_policy.opentelemetry.body_policy
  }));
  const cloud = positive.slice(0, 3).map((event) => ({
    specversion: "1.0",
    id: event.event.id,
    source: `https://bloodtrail.dev/producers/${event.producer.name}`,
    type: event.event.name,
    time: event.event.timestamp,
    dataschema: source.metadata.schema_id,
    subject: `resource:${event.resource.type}`,
    data: event
  }));
  const conflicts = [
    { name: "cloudevents-id-conflict", expected_errors: ["ENVELOPE_PAYLOAD_CONFLICT"], envelope: { ...cloud[0], id: "11111111-1111-4111-8111-999999999999" } },
    { name: "otel-unsupported-version", expected_errors: ["UNSUPPORTED_MAPPING_VERSION"], mapping: { ...otel[0], spec_version: "1.60.0" } },
    { name: "otel-duplicate-authority", expected_errors: ["DUPLICATE_AUTHORITY"], mapping: { ...otel[0], attributes: { ...otel[0].attributes, "event.id": positive[0].event.id } } },
    { name: "otel-prohibited-body", expected_errors: ["PROHIBITED_BODY_ATTRIBUTES"], mapping: { ...otel[0], body: { raw_token: "SECRET_TOKEN_SHOULD_NOT_APPEAR" } } },
    { name: "otel-missing-native-timestamp", expected_errors: ["MISSING_NATIVE_MAPPING"], mapping: { ...otel[0], timestamp: undefined } }
  ];
  return { ocsf, otel, cloud, conflicts };
}

/**
 * Prose for the declared canonical ordering of derived-field provenance inputs, keyed by the
 * declaration itself so the documentation cannot drift from the contract source. An unrecognised
 * declaration fails generation rather than emitting stale prose for a rule that has moved.
 */
const CANONICAL_ORDER_PROSE = {
  code_point_ascending: [
    "Entries are ordered by ascending Unicode code-point value. To compare two entries,",
    "decode both to sequences of code points and compare them position by position; at the first",
    "position whose code points differ, the entry with the smaller code point sorts first. If one",
    "entry is a prefix of the other, the shorter entry sorts first. Consecutive entries must be",
    "strictly ascending under this order; a repeated entry is reported as the duplicate-input",
    "outcome rather than the non-canonical-order outcome.",
    "",
    "This is not UTF-16 code-unit order, and not locale collation. The two orders disagree for any",
    "entry containing a character above U+FFFF, because a lead surrogate (U+D800..U+DBFF) is a",
    "lower code unit than U+E000..U+FFFF while the character it encodes is a higher code point.",
    "For example, U+FF01 precedes U+10000 by code point, but a UTF-16 code-unit comparison places",
    "U+10000 first. An implementation that compares UTF-16 code units is not conformant.",
  ].join("\n"),
};

function canonicalOrderSection(provenance) {
  const prose = CANONICAL_ORDER_PROSE[provenance.canonical_order];
  if (!prose) throw new Error(`no documented rule for canonical_order ${provenance.canonical_order}`);
  return `## Canonical Order Of ${provenance.field_path}\n\nDeclared order: \`${provenance.canonical_order}\`.\n\n${prose}\n`;
}

const positive = source.catalog.map(makeEvent);
const negative = negativeFixtures(positive);
const mappings = mappingFixtures(positive);

async function main() {
  await emit("schema/security-audit-event.schema.json", stableJson(buildSchema()));
  await emit("catalog/catalog.json", stableJson(source.catalog));
  await emit("registries/registries.json", stableJson(source.registries));
  await emit("policies/field-policy.json", stableJson(source.fields.map((field) => ({ path: field.p, authority: field.a, trust: field.trust, privacy: field.privacy, policy: field.policy, retention: field.retention, redaction: field.policy === "transform_required" ? "purpose-scoped keyed transform or approved direct-reference exception" : field.policy === "prohibited" ? "reject" : "role and tenant access policy", compatibility: field.compat }))));
  await emit("examples/positive/all-events.json", stableJson(positive));
  for (const event of positive) await emit(`examples/positive/${event.event.name}.json`, stableJson(event));
  await emit("examples/negative/all-negative.json", stableJson(negative));
  for (const fixture of negative) await emit(`examples/negative/${fixture.name}.json`, stableJson(fixture));
  await emit("fixtures/mappings/ocsf-1.8.0.json", stableJson(mappings.ocsf));
  await emit("fixtures/mappings/opentelemetry-1.59.0-semconv-1.43.0.json", stableJson(mappings.otel));
  await emit("fixtures/mappings/cloudevents-1.0.2.json", stableJson(mappings.cloud));
  await emit("fixtures/mappings/negative-mapping-conflicts.json", stableJson(mappings.conflicts));
  await emit("fixtures/compatibility/compatibility-scenarios.json", stableJson([
    { name: "patch-documentation-correction", change_class: "patch", expected: "compatible" },
    { name: "minor-optional-field-addition", change_class: "minor", expected: "compatible_with_absence_meaning" },
    { name: "minor-client-evidence-reference", change_class: "minor", expected: "compatible_with_absence_meaning" },
    { name: "minor-derived-field-provenance", change_class: "minor", expected: "compatible_with_absence_meaning" },
    { name: "major-derived-field-trust-floor", change_class: "major", expected: "breaking" },
    { name: "minor-catalog-addition", change_class: "minor", expected: "older_consumer_must_reject_or_quarantine_unknown_event" },
    { name: "minor-enum-addition", change_class: "minor", expected: "compatible_only_when registry version is supported" },
    { name: "minor-deprecation", change_class: "minor", expected: "compatible_during_support_window" },
    { name: "major-required-field-addition", change_class: "major", expected: "breaking" },
    { name: "major-authority-change", change_class: "major", expected: "breaking" },
    { name: "major-privacy-weakening", change_class: "major", expected: "breaking" },
    { name: "unsupported-version", change_class: "unsupported", expected: "reject_or_quarantine", expected_errors: ["UNSUPPORTED_COMPATIBILITY_VERSION"] }
  ]));
  await emit("fixtures/delivery/delivery-scenarios.json", stableJson([
    { name: "duplicate-redelivery", delivery_class: "security_significant", expected: "same_event_id_consumer_dedupes" },
    { name: "re-executed-operation", delivery_class: "security_significant", expected: "new_event_id_same_operation_or_causation_link" },
    { name: "collector-outage", delivery_class: "security_significant", expected: "delay_accounting_and_operator_alert" },
    { name: "buffer-exhaustion", delivery_class: "security_significant", expected: "bounded_alert_without_secret_payload" },
    { name: "graceful-shutdown", delivery_class: "transaction_critical", expected: "durable_handoff_before_exit" },
    { name: "retry-exhaustion", delivery_class: "security_significant", expected: "safe_operational_signal_not_recursive_audit_claim" },
    { name: "atomic-business-audit-commit", delivery_class: "transaction_critical", expected: "fail_closed_before_commit_if_audit_durability_unavailable" },
    { name: "missing-policy-critical-failure-posture", delivery_class: "policy_critical", expected_errors: ["UNAPPROVED_POLICY_CRITICAL_POSTURE"] }
  ]));
  await emit("fixtures/integrity/negative-integrity-claims.json", stableJson(source.integrity_claims.map((claim) => ({
    name: `${claim.claim}-does-not-prove-truth-or-completeness`,
    mechanism_valid: true,
    established: claim.can_establish,
    not_established: claim.cannot_establish,
    expected: "valid_integrity_metadata_does_not_upgrade_producer_truth_or_completeness"
  }))));
  await emitDocs();
  console.log(check ? `checked ${generated.length} generated artifacts` : `generated ${generated.length} artifacts`);
}

async function emitDocs() {
  await emit("README.md", `${generatedHeader("Bloodtrail Security Audit Contract")}This package contains isolated, development-only contract artifacts. It adds no SDK, middleware, exporter, collector, broker, storage, SIEM, browser telemetry, runtime behavior, infrastructure, or production instrumentation.\n\nCanonical boundary: ${source.metadata.canonical_boundary}\n\nSource of truth: \`source/contract.source.json\`.\n\nValidation: \`npm run validate --prefix contracts/security-audit\`.\n`);
  await emit("docs/sources.md", `${generatedHeader("Sources And Evidence")}Retrieval date: ${source.metadata.retrieval_date}\n\n${mdTable(["ID","Version","Normative Scope","URL","Support Type","Exact Bloodtrail Design Decision"], source.standards.map((s) => [s.id, s.version, s.normative_scope, s.url, s.support_type, s.design_decision]))}\n\nSupport type is explicitly classified as an internal requirement, recommendation, or mapping option; it does not convert external guidance into automatic Bloodtrail approval.\n\n## Facts And Gaps\n\n${source.standards.map((s) => `### ${s.name}\n\nFacts:\n${s.facts.map((f) => `- ${f}`).join("\n")}\n\nSupport type: ${s.support_type}.\n\nExact decision supported: ${s.design_decision}\n\nRecommendation or assumption: ${s.recommendation}\n`).join("\n")}`);
  await emit("docs/standards-comparison.md", `${generatedHeader("Standards Comparison")}Statuses are evidence labels, not external mandates.\n\n${mdTable(["Bloodtrail Semantic","NIST","OCSF","OpenTelemetry","CloudEvents","W3C Trace Context","JSON Schema","SemVer","OWASP"], source.standards_matrix.map((r) => [r.semantic, r.nist, r.ocsf, r.otel, r.cloudevents, r.trace_context, r.json_schema, r.semver, r.owasp]))}\n`);
  await emit("docs/authority-matrix.md", `${generatedHeader("Authority Matrix")}${mdTable(["Category","Fields","Producer","Allowed Source","Trust","Validation","Enrichment","User Controlled","Enforcement"], source.authority_matrix.map((r) => [r.category, r.fields.join(", "), r.authoritative_producer, r.allowed_source, r.trust, r.validation, r.enrichment, r.user_controlled, r.enforcement]))}\n`);
  await emit("docs/field-policy.md", `${generatedHeader("Field Policy")}${mdTable(["Path","Type","Requirement","Authority","Trust","Privacy","Policy","Retention","Compatibility"], source.fields.map((f) => [f.p, f.t, f.r, f.a, f.trust, f.privacy, f.policy, f.retention, f.compat]))}\n\n## Prohibited Data\n\n${source.prohibited_data.map((v) => `- ${v}`).join("\n")}\n\n## Transformations\n\n${mdTable(["Field Family","Policy","Method","Key Scope","Plain Hash Allowed"], source.privacy_transformations.map((p) => [p.field_family, p.policy, p.method, p.key_scope, p.plain_hash_allowed]))}\n`);
  await emit("docs/catalog.md", `${generatedHeader("Event Catalog")}${mdTable(["Semantic","Event Name","Category","Action","Phases","Outcomes","Commit","Delivery","Retention","Producer"], source.catalog.map((e) => [e.semantic, e.name, e.category, e.action, e.phase.join(", "), e.outcomes.join(", "), e.commit.join(", "), e.delivery, e.retention, e.producer]))}\n\n${source.catalog.map((e) => `## ${e.name}\n\nPurpose: ${e.purpose}\n\nTrigger: ${e.trigger}\n\nRequired context: ${e.required_context.join(", ")}\n\nActor rule: ${e.actor_rule}\n\nTenant rule: ${e.tenant_rule}\n\nResource rule: ${e.resource_rule}\n\nAuthorization rule: ${e.authorization_rule}\n\nPrivacy concerns: ${e.privacy.join(", ")}\n\nInvestigation value: ${e.investigation}\n\nMapping status: OCSF ${e.ocsf.status}, OpenTelemetry ${e.otel.status}, CloudEvents ${e.cloud_events.status}.\n`).join("\n")}`);
  await emit("docs/delivery-policy.md", `${generatedHeader("Delivery Policy")}${mdTable(["Class","Semantic","Durability","Idempotency","Retry","Backpressure","Shutdown","Outage","Business Posture"], Object.entries(source.delivery_class_contracts).map(([k, v]) => [k, v.semantic, v.durability, v.idempotency, v.retry, v.backpressure, v.shutdown, v.outage, v.business_failure_posture]))}\n\nPolicy-critical production use remains blocked until exact fail-open, fail-closed, or deferred-completion policy is reviewed and approved.\n`);
  await emit("docs/validation.md", `${generatedHeader("Validation")}${mdTable(["Layer","Responsibility"], source.validation_layers.map((v) => [v.layer, v.responsibility]))}\n\nValidation error codes:\n\n${bulletList(source.registries.validation_error_codes)}\n\nDiagnostics include bounded metadata only: code, path, safe event name, schema version, and producer. Rejected values and full payloads are never echoed.\n\n${canonicalOrderSection(source.derived_field_provenance)}`);
  await emit("docs/mappings.md", `${generatedHeader("Mappings")}## OCSF 1.8.0\n\nBoundary: ${source.mapping_policy.ocsf.boundary}\n\nAllowed claim: ${source.mapping_policy.ocsf.allowed_claim}\n\n${mdTable(["Event","OCSF Class","Status","Full Compatibility Claim"], source.catalog.map((e) => [e.name, e.ocsf.class, e.ocsf.status, "false"]))}\n\n## OpenTelemetry ${source.mapping_policy.opentelemetry.spec_version} / SemConv ${source.mapping_policy.opentelemetry.semconv_version}\n\nBoundary: ${source.mapping_policy.opentelemetry.boundary}\n\nNative fields: ${source.mapping_policy.opentelemetry.native_fields.join(", ")}\n\nBody policy: ${source.mapping_policy.opentelemetry.body_policy}\n\n## CloudEvents ${source.mapping_policy.cloudevents.standard_version}\n\nBoundary: ${source.mapping_policy.cloudevents.boundary}\n\nData policy: ${source.mapping_policy.cloudevents.data_policy}\n\nConflict policy: ${source.mapping_policy.cloudevents.conflict_policy}\n`);
  await emit("docs/compatibility-and-migration.md", `${generatedHeader("Compatibility And Migration")}${mdTable(["Change","Classification","Producer","Consumer"], source.compatibility_policy.map((p) => [p.change, p.classification, p.producer, p.consumer]))}\n\nTypeScript generation strategy: later SDK work may generate types from \`schema/security-audit-event.schema.json\` and constants from \`catalog/catalog.json\`, but generated types are compile-time help only. Runtime producer and ingestion validation remains mandatory. This package intentionally implements no SDK.\n`);
  await emit("docs/integrity-limits.md", `${generatedHeader("Integrity Limits")}${mdTable(["Claim","Can Establish","Cannot Establish"], source.integrity_claims.map((c) => [c.claim, c.can_establish, c.cannot_establish]))}\n`);
  await emit("docs/readiness-report.md", `${generatedHeader("Readiness Report")}- Technical completeness: verified for Contract Commit A \`8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993\`.\n- Contract approval: version 1.0.0 approved as the design basis by the project owner and implementer; this is not independent assurance.\n- Merge readiness: requires final 72/72 verification and live PR checks.\n- Archive readiness: requires merge and a separate archive commit.\n- Production authorization: none.\n- SDK authorization: none; a separate reviewed \`implement-security-audit-sdk-core\` change is required.\n- Historical review binding: Contract Commit A remains the reviewed normative target; later governance storage/status reconciliation does not replace it or change contract semantics.\n`);
  for (const adr of source.adrs) {
    await emit(`adr/${adr.id.toLowerCase()}.md`, `${generatedHeader(`${adr.id}: ${adr.title}`)}Status: ${adr.status}\n\nDate: 2026-07-31\n\nOwner: ${source.metadata.owner}\n\n## Decision\n\n${adr.decision}\n\n## Evidence\n\n${source.standards.map((s) => `- ${s.id} ${s.version}: ${s.url}`).join("\n")}\n\n## Consequences\n\n${adr.consequences.map((c) => `- ${c}`).join("\n")}\n\n## Unresolved Implementation Choices\n\n${adr.unresolved.map((u) => `- ${u}`).join("\n")}\n\nApproved design-basis contract commit: \`8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993\` (Contract Commit A). Production and SDK implementation remain unauthorized.\n`);
  }
}

await main();
