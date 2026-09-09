#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(await readFile(resolve(root, "source/contract.source.json"), "utf8"));
const catalogByName = new Map(source.catalog.map((entry) => [entry.name, entry]));
const eventNames = new Set(source.catalog.map((entry) => entry.name));
const fieldByPath = new Map(source.fields.map((field) => [field.p, field]));
const derivedFieldProvenance = source.derived_field_provenance;
const allowedParents = new Set();
for (const field of source.fields) {
  const parts = field.p.split(".");
  for (let i = 1; i < parts.length; i += 1) allowedParents.add(parts.slice(0, i).join("."));
}
allowedParents.add("extensions");

export function loadSource() {
  return source;
}

export async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

function diagnostic(code, path, event) {
  return {
    code,
    path,
    event_name: eventNames.has(event?.event?.name) ? event.event.name : "unregistered_or_unavailable",
    schema_version: typeof event?.schema?.version === "string" ? event.schema.version : "unavailable",
    producer: typeof event?.producer?.name === "string" ? event.producer.name : "unavailable"
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function get(obj, path) {
  return path.split(".").reduce((cur, key) => cur?.[key], obj);
}

function visit(value, fn, path = "") {
  fn(value, path);
  if (Array.isArray(value)) value.forEach((child, index) => visit(child, fn, `${path}[${index}]`));
  else if (isObject(value)) for (const [key, child] of Object.entries(value)) visit(child, fn, path ? `${path}.${key}` : key);
}

function depth(value) {
  if (!value || typeof value !== "object") return 0;
  return 1 + Math.max(0, ...Object.values(value).map(depth));
}

function firstProhibited(event) {
  let found = null;
  const safeControlled = new Set(["event.name", "event.action", "credential.type", "authentication.method", "authentication.credential_type", "authentication.account_recovery.flow"]);
  visit(event, (value, path) => {
    if (found) return;
    const leaf = path.split(".").at(-1)?.replace(/\[\d+\]/g, "").toLowerCase() ?? "";
    if (!safeControlled.has(path) && source.prohibited_data.some((term) => leaf === term || leaf.endsWith(`_${term}`))) {
      found = path;
      return;
    }
    if (typeof value === "string" && !safeControlled.has(path) && /secret|raw[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|sk_live|api[_-]?key|private key|connection string|bearer\s/i.test(value)) found = path;
  });
  return found;
}

function enumValues(field) {
  if (!field.enum) return null;
  if (field.enum === "event_names") return [...eventNames];
  return source.registries[field.enum] ?? null;
}

function formatOk(field, value) {
  if (value === undefined || typeof value !== "string") return true;
  if (field.fmt === "uuid") return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
  if (field.fmt === "semver") return /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
  if (field.fmt === "date-time") return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
  if (field.fmt === "uri") return /^https?:\/\//.test(value);
  if (field.fmt === "w3c-trace-id") return /^(?!0{32})[0-9a-f]{32}$/.test(value);
  if (field.fmt === "w3c-span-id") return /^(?!0{16})[0-9a-f]{16}$/.test(value);
  return true;
}

function typeBoundsError(event) {
  for (const field of source.fields) {
    if (field.p === derivedFieldProvenance.field_path) continue;
    const value = get(event, field.p);
    if (value === undefined) continue;
    if (field.t === "array" && !Array.isArray(value)) return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
    if (field.t === "string" && typeof value !== "string") return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
    if (field.t === "integer" && (!Number.isInteger(value) || value < 0 || value > field.max)) return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
    if (field.t === "number" && (typeof value !== "number" || value < 0 || value > field.max)) return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
    if (field.t === "boolean" && typeof value !== "boolean") return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
    if (typeof value === "string" && value.length > (field.max ?? source.bounds.default_string_max)) return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
    if (Array.isArray(value) && value.length > (field.max ?? source.bounds.array_max_items)) return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
    const enums = enumValues(field);
    if (enums && !enums.includes(value)) return diagnostic("UNKNOWN_CATALOG_VALUE", field.p, event);
    if (!formatOk(field, value)) return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
  }
  return null;
}

function derivedFieldProvenanceError(event) {
  const inputs = get(event, derivedFieldProvenance.field_path);
  if (inputs === undefined) return null;
  const { error_codes: codes } = derivedFieldProvenance;
  if (!Array.isArray(inputs) || inputs.length > derivedFieldProvenance.maximum_inputs) {
    return diagnostic(codes.malformed, derivedFieldProvenance.field_path, event);
  }
  if (inputs.length < derivedFieldProvenance.minimum_inputs) return diagnostic(codes.empty, derivedFieldProvenance.field_path, event);
  if (inputs.some((input) => typeof input !== "string" || input.length === 0 || input.length > derivedFieldProvenance.maximum_input_length)) {
    return diagnostic(codes.malformed, derivedFieldProvenance.field_path, event);
  }
  if (get(event, derivedFieldProvenance.trust_path) !== derivedFieldProvenance.required_trust) {
    return diagnostic(codes.non_derived, derivedFieldProvenance.field_path, event);
  }
  const seen = new Set();
  for (const input of inputs) {
    if (seen.has(input)) return diagnostic(codes.duplicate, derivedFieldProvenance.field_path, event);
    seen.add(input);
  }
  for (let index = 1; index < inputs.length; index += 1) {
    if (inputs[index - 1] > inputs[index]) return diagnostic(codes.noncanonical_order, derivedFieldProvenance.field_path, event);
  }
  for (const input of inputs) {
    if (input === derivedFieldProvenance.field_path) return diagnostic(codes.cycle, derivedFieldProvenance.field_path, event);
    if (fieldByPath.has(input)) {
      if (get(event, input) === undefined) return diagnostic(codes.absent, derivedFieldProvenance.field_path, event);
      continue;
    }
    if (!isPresentRegisteredExtension(event, input)) {
      const code = isRegisteredExtensionInput(input) ? codes.absent : codes.unresolvable;
      return diagnostic(code, derivedFieldProvenance.field_path, event);
    }
  }
  return null;
}

function isRegisteredExtensionInput(input) {
  if (!input.startsWith("extensions.")) return false;
  return source.registries.extension_namespaces.includes(input.slice("extensions.".length));
}

function isPresentRegisteredExtension(event, input) {
  if (!isRegisteredExtensionInput(input)) return false;
  return event.extensions?.[input.slice("extensions.".length)] !== undefined;
}

function unknownField(event) {
  let found = null;
  visit(event, (_value, path) => {
    if (found || !path || path.includes("[") || path === "extensions" || path.startsWith("extensions.")) return;
    if (!fieldByPath.has(path) && !allowedParents.has(path)) found = path;
  });
  return found;
}

export function validateCanonicalEvent(event) {
  if (!isObject(event)) return [diagnostic("FIELD_LIMIT_EXCEEDED", "$", event)];
  if (JSON.stringify(event).length > source.bounds.event_max_bytes || depth(event) > source.bounds.object_max_depth) return [diagnostic("FIELD_LIMIT_EXCEEDED", "$", event)];
  const prohibited = firstProhibited(event);
  if (prohibited) return [diagnostic("PROHIBITED_DATA", prohibited, event)];
  if (event?.schema?.version !== source.metadata.schema_version) return [diagnostic("UNSUPPORTED_SCHEMA_VERSION", "schema.version", event)];
  if (!event.actor?.type) return [diagnostic("MISSING_REQUIRED_ACTOR", "actor.type", event)];
  if (event.tenant?.scope === "tenant" && (!event.tenant.effective_tenant_id || !event.tenant.resource_tenant_id)) return [diagnostic("MISSING_TENANT_CONTEXT", "tenant", event)];
  if (event.tenant?.scope === "cross_tenant" && (!event.tenant.actor_tenant_id || !event.tenant.effective_tenant_id || !event.tenant.resource_tenant_id)) return [diagnostic("MISSING_TENANT_CONTEXT", "tenant", event)];
  if (event.extensions) {
    for (const namespace of Object.keys(event.extensions)) {
      if (!source.registries.extension_namespaces.includes(namespace)) return [diagnostic("UNKNOWN_EXTENSION", `extensions.${namespace}`, event)];
      if (event.extensions[namespace]?.provenance?.trust_level !== "downstream_enrichment") return [diagnostic("AUTHORITY_ESCALATION", `extensions.${namespace}.provenance.trust_level`, event)];
      if (["tenant", "actor", "authorization", "event", "delivery_class"].some((key) => Object.hasOwn(event.extensions[namespace], key))) return [diagnostic("AUTHORITY_ESCALATION", `extensions.${namespace}`, event)];
    }
  }
  const catalog = catalogByName.get(event.event?.name);
  if (!catalog) return [diagnostic("UNKNOWN_CATALOG_VALUE", "event.name", event)];
  if (event.event.category !== catalog.category || event.event.action !== catalog.action) return [diagnostic("UNKNOWN_CATALOG_VALUE", "event.category/action", event)];
  if (event.event.lifecycle_phase === "completed" && event.event.outcome === "success" && !["committed", "not_applicable"].includes(event.event.commit_state)) return [diagnostic("PREMATURE_SUCCESS", "event.commit_state", event)];
  if (event.event.lifecycle_phase === "compensating" && event.event.outcome === "success" && event.event.commit_state !== "compensated") return [diagnostic("PREMATURE_SUCCESS", "event.commit_state", event)];
  if (event.authorization?.decision === "allow" && event.event.outcome === "denied") return [diagnostic("AUTHORIZATION_OUTCOME_CONFLICT", "authorization.decision", event)];
  if (event.authorization?.decision === "deny" && event.event.outcome !== "denied") return [diagnostic("AUTHORIZATION_OUTCOME_CONFLICT", "authorization.decision", event)];
  if (event.actor?.id && event.actor?.provenance?.trust_level === "client_claim") return [diagnostic("AUTHORITY_ESCALATION", "actor.provenance.trust_level", event)];
  if (event.delegation?.mode && (!event.delegation.principal_id || !event.delegation.expires_at || !event.delegation.reason_code)) return [diagnostic("INVALID_DELEGATION", "delegation", event)];
  if (event.correlation?.causation_id && event.correlation.causation_id === event.event.id) return [diagnostic("BAD_CAUSALITY", "correlation.causation_id", event)];
  if (event.event.lifecycle_phase === "compensating" && !event.correlation?.original_event_id) return [diagnostic("BAD_CAUSALITY", "correlation.original_event_id", event)];
  if ((event.correlation?.retry_attempt ?? 0) > 0 && !event.correlation?.original_event_id) return [diagnostic("BAD_CAUSALITY", "correlation.original_event_id", event)];
  if (catalog.semantic.endsWith("_completed") && (!event.correlation?.causation_id || !event.correlation?.original_event_id)) return [diagnostic("BAD_CAUSALITY", "correlation.causation_id/original_event_id", event)];
  if (event.tenant?.resource_tenant_id && event.resource?.owning_tenant_id && event.resource.owning_tenant_id !== event.tenant.resource_tenant_id) return [diagnostic("TENANT_RESOURCE_CONFLICT", "resource.owning_tenant_id", event)];
  if (!catalog.phase.includes(event.event.lifecycle_phase) || !catalog.outcomes.includes(event.event.outcome) || !catalog.commit.includes(event.event.commit_state) || event.event.delivery_class !== catalog.delivery) return [diagnostic("UNKNOWN_CATALOG_VALUE", "event.lifecycle/outcome/commit/delivery", event)];
  for (const field of source.fields.filter((f) => f.r === "required")) if (get(event, field.p) === undefined) return [diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event)];
  const bounds = typeBoundsError(event);
  if (bounds) return [bounds];
  const provenance = derivedFieldProvenanceError(event);
  if (provenance) return [provenance];
  const unknown = unknownField(event);
  if (unknown) return [diagnostic("UNKNOWN_CATALOG_VALUE", unknown, event)];
  return [];
}

export function validateCloudEventEnvelope(envelope) {
  const event = envelope?.data;
  if (envelope?.specversion !== source.mapping_policy.cloudevents.specversion) return [diagnostic("UNSUPPORTED_MAPPING_VERSION", "specversion", event)];
  if (!event || envelope.id !== event.event?.id || envelope.type !== event.event?.name || envelope.time !== event.event?.timestamp || envelope.dataschema !== source.metadata.schema_id) return [diagnostic("ENVELOPE_PAYLOAD_CONFLICT", "cloudevents", event)];
  return validateCanonicalEvent(event);
}

export function validateOtelMapping(record) {
  const specVersion = record.otel_spec_version ?? record.spec_version;
  const eventName = record.canonical_event ?? record.canonical_event_name;
  if (specVersion !== source.mapping_policy.opentelemetry.spec_version || record.semconv_version !== source.mapping_policy.opentelemetry.semconv_version) return [diagnostic("UNSUPPORTED_MAPPING_VERSION", "opentelemetry.version", { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  for (const key of ["timestamp", "observed_timestamp", "event_name", "trace_id", "span_id", "resource", "instrumentation_scope"]) if (record[key] === undefined) return [diagnostic("MISSING_NATIVE_MAPPING", key, { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  if (Object.keys(record.attributes ?? {}).some((key) => ["event.id", "actor.id", "tenant.effective_tenant_id", "authorization.decision"].includes(key))) return [diagnostic("DUPLICATE_AUTHORITY", "opentelemetry.attributes", { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  const bodyText = JSON.stringify(record.body ?? {});
  const attrText = JSON.stringify(record.attributes ?? {});
  if (firstProhibited(record.body) || firstProhibited(record.attributes) || bodyText.length > 4096) return [diagnostic("PROHIBITED_BODY_ATTRIBUTES", "opentelemetry.attributes/body", { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  return [];
}

export function validateOcsfMapping(record) {
  const eventName = record.canonical_event ?? record.canonical_event_name;
  if (record.target_version !== source.mapping_policy.ocsf.target_version) return [diagnostic("UNSUPPORTED_MAPPING_VERSION", "ocsf.target_version", { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  if (!eventNames.has(eventName)) return [diagnostic("UNKNOWN_CATALOG_VALUE", "canonical_event", { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  if (!source.mapping_policy.ocsf.statuses.includes(record.mapping_status)) return [diagnostic("MAPPING_SCOPE_OVERCLAIM", "mapping_status", { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  if (record.full_compatibility_claim === true || /full ocsf compatibility/i.test(record.compatibility_claim ?? "")) return [diagnostic("MAPPING_SCOPE_OVERCLAIM", "compatibility_claim", { event: { name: eventName }, schema: { version: source.metadata.schema_version } })];
  return [];
}

async function validateAll() {
  const failures = [];
  for (const event of await readJson("examples/positive/all-events.json")) {
    const errors = validateCanonicalEvent(event);
    if (errors.length) failures.push(`${event.event?.name}: ${errors.map((error) => error.code).join(",")}`);
  }
  for (const fixture of await readJson("examples/negative/all-negative.json")) {
    const codes = validateCanonicalEvent(fixture.event).map((error) => error.code);
    if (JSON.stringify(codes) !== JSON.stringify(fixture.expected_errors)) failures.push(`${fixture.name}: expected ${fixture.expected_errors.join(",")} got ${codes.join(",")}`);
  }
  for (const row of await readJson("fixtures/mappings/ocsf-1.8.0.json")) {
    const errors = validateOcsfMapping(row);
    if (errors.length) failures.push(`${row.canonical_event_name}: OCSF ${errors.map((error) => error.code).join(",")}`);
  }
  for (const row of await readJson("fixtures/mappings/opentelemetry-1.59.0-semconv-1.43.0.json")) {
    const errors = validateOtelMapping(row);
    if (errors.length) failures.push(`${row.canonical_event_name}: OTel ${errors.map((error) => error.code).join(",")}`);
  }
  for (const envelope of await readJson("fixtures/mappings/cloudevents-1.0.2.json")) {
    const errors = validateCloudEventEnvelope(envelope);
    if (errors.length) failures.push(`${envelope.type}: CloudEvents ${errors.map((error) => error.code).join(",")}`);
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    return false;
  }
  console.log("Security audit contract validation passed.");
  return true;
}

if (process.argv.includes("--all")) {
  const ok = await validateAll();
  if (!ok) process.exit(1);
}
