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
    const code = fieldBoundsCode(field, value);
    if (code) return diagnostic(code, field.p, event);
  }
  return null;
}

function fieldBoundsCode(field, value) {
  if (value === undefined) return null;
  if (invalidFieldType(field, value)) return "FIELD_LIMIT_EXCEEDED";
  if (valueExceedsBound(field, value)) return "FIELD_LIMIT_EXCEEDED";
  const enums = enumValues(field);
  if (enums && !enums.includes(value)) return "UNKNOWN_CATALOG_VALUE";
  return formatOk(field, value) ? null : "FIELD_LIMIT_EXCEEDED";
}

function invalidFieldType(field, value) {
  if (field.t === "array") return !Array.isArray(value);
  if (field.t === "string") return typeof value !== "string";
  if (field.t === "integer") return !Number.isInteger(value) || isOutsideNumericBounds(value, field.max);
  if (field.t === "number") return typeof value !== "number" || isOutsideNumericBounds(value, field.max);
  if (field.t === "boolean") return typeof value !== "boolean";
  return false;
}

function isOutsideNumericBounds(value, maximum) {
  if (value < 0) return true;
  return value > maximum;
}

function valueExceedsBound(field, value) {
  if (typeof value === "string") return value.length > (field.max ?? source.bounds.default_string_max);
  if (Array.isArray(value)) return value.length > (field.max ?? source.bounds.array_max_items);
  return false;
}

function derivedFieldProvenanceError(event) {
  const inputs = get(event, derivedFieldProvenance.field_path);
  if (inputs === undefined) return null;
  const { error_codes: codes } = derivedFieldProvenance;
  const shapeCode = derivedInputShapeCode(inputs, codes);
  if (shapeCode) return provenanceDiagnostic(shapeCode, event);
  if (get(event, derivedFieldProvenance.trust_path) !== derivedFieldProvenance.required_trust) {
    return provenanceDiagnostic(codes.non_derived, event);
  }
  return derivedInputReferenceError(event, inputs, codes);
}

function derivedInputShapeCode(inputs, codes) {
  if (!Array.isArray(inputs)) return codes.malformed;
  if (inputs.length > derivedFieldProvenance.maximum_inputs) return codes.malformed;
  if (inputs.length < derivedFieldProvenance.minimum_inputs) return codes.empty;
  for (const input of inputs) if (isMalformedDerivedInput(input)) return codes.malformed;
  return null;
}

function isMalformedDerivedInput(input) {
  if (typeof input !== "string") return true;
  if (input.length === 0) return true;
  return input.length > derivedFieldProvenance.maximum_input_length;
}

function derivedInputReferenceError(event, inputs, codes) {
  const seen = new Set();
  for (const input of inputs) {
    if (seen.has(input)) return provenanceDiagnostic(codes.duplicate, event);
    seen.add(input);
  }
  for (let index = 1; index < inputs.length; index += 1) {
    if (inputs[index - 1] > inputs[index]) return provenanceDiagnostic(codes.noncanonical_order, event);
  }
  for (const input of inputs) {
    const code = derivedInputResolutionCode(event, input, codes);
    if (code) return provenanceDiagnostic(code, event);
  }
  return null;
}

function derivedInputResolutionCode(event, input, codes) {
  if (input === derivedFieldProvenance.field_path) return codes.cycle;
  if (fieldByPath.has(input)) return get(event, input) === undefined ? codes.absent : null;
  if (isPresentRegisteredExtension(event, input)) return null;
  return isRegisteredExtensionInput(input) ? codes.absent : codes.unresolvable;
}

function provenanceDiagnostic(code, event) {
  return diagnostic(code, derivedFieldProvenance.field_path, event);
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
  const preflight = canonicalPreflightError(event);
  if (preflight) return [preflight];
  const context = canonicalContextError(event);
  if (context) return [context];
  const catalog = catalogByName.get(event.event?.name);
  if (!catalog) return [diagnostic("UNKNOWN_CATALOG_VALUE", "event.name", event)];
  return catalogedEventErrors(event, catalog);
}

function canonicalPreflightError(event) {
  if (!isObject(event)) return diagnostic("FIELD_LIMIT_EXCEEDED", "$", event);
  if (JSON.stringify(event).length > source.bounds.event_max_bytes || depth(event) > source.bounds.object_max_depth) return diagnostic("FIELD_LIMIT_EXCEEDED", "$", event);
  const prohibited = firstProhibited(event);
  if (prohibited) return diagnostic("PROHIBITED_DATA", prohibited, event);
  return event?.schema?.version !== source.metadata.schema_version ? diagnostic("UNSUPPORTED_SCHEMA_VERSION", "schema.version", event) : null;
}

function canonicalContextError(event) {
  if (!event.actor?.type) return diagnostic("MISSING_REQUIRED_ACTOR", "actor.type", event);
  const tenant = tenantContextError(event);
  if (tenant) return tenant;
  return extensionError(event);
}

function tenantContextError(event) {
  if (event.tenant?.scope === "tenant" && (!event.tenant.effective_tenant_id || !event.tenant.resource_tenant_id)) return diagnostic("MISSING_TENANT_CONTEXT", "tenant", event);
  if (event.tenant?.scope === "cross_tenant" && (!event.tenant.actor_tenant_id || !event.tenant.effective_tenant_id || !event.tenant.resource_tenant_id)) return diagnostic("MISSING_TENANT_CONTEXT", "tenant", event);
  return null;
}

function extensionError(event) {
  if (!event.extensions) return null;
  for (const namespace of Object.keys(event.extensions)) {
    if (!source.registries.extension_namespaces.includes(namespace)) return diagnostic("UNKNOWN_EXTENSION", `extensions.${namespace}`, event);
    if (event.extensions[namespace]?.provenance?.trust_level !== "downstream_enrichment") return diagnostic("AUTHORITY_ESCALATION", `extensions.${namespace}.provenance.trust_level`, event);
    if (["tenant", "actor", "authorization", "event", "delivery_class"].some((key) => Object.hasOwn(event.extensions[namespace], key))) return diagnostic("AUTHORITY_ESCALATION", `extensions.${namespace}`, event);
  }
  return null;
}

function catalogedEventErrors(event, catalog) {
  const validators = [
    () => catalogIdentityError(event, catalog),
    () => lifecycleError(event),
    () => authorizationOutcomeError(event),
    () => actorAuthorityError(event),
    () => delegationError(event),
    () => causalityError(event, catalog),
    () => tenantResourceError(event),
    () => catalogMembershipError(event, catalog),
    () => missingRequiredFieldError(event),
    () => canonicalFieldError(event)
  ];
  for (const validate of validators) {
    const error = validate();
    if (error) return [error];
  }
  return [];
}

function catalogIdentityError(event, catalog) {
  return event.event.category !== catalog.category || event.event.action !== catalog.action
    ? diagnostic("UNKNOWN_CATALOG_VALUE", "event.category/action", event)
    : null;
}

function lifecycleError(event) {
  if (event.event.lifecycle_phase === "completed" && event.event.outcome === "success" && !["committed", "not_applicable"].includes(event.event.commit_state)) return diagnostic("PREMATURE_SUCCESS", "event.commit_state", event);
  if (event.event.lifecycle_phase === "compensating" && event.event.outcome === "success" && event.event.commit_state !== "compensated") return diagnostic("PREMATURE_SUCCESS", "event.commit_state", event);
  return null;
}

function authorizationOutcomeError(event) {
  if (event.authorization?.decision === "allow" && event.event.outcome === "denied") return diagnostic("AUTHORIZATION_OUTCOME_CONFLICT", "authorization.decision", event);
  if (event.authorization?.decision === "deny" && event.event.outcome !== "denied") return diagnostic("AUTHORIZATION_OUTCOME_CONFLICT", "authorization.decision", event);
  return null;
}

function actorAuthorityError(event) {
  return event.actor?.id && event.actor?.provenance?.trust_level === "client_claim"
    ? diagnostic("AUTHORITY_ESCALATION", "actor.provenance.trust_level", event)
    : null;
}

function delegationError(event) {
  return event.delegation?.mode && (!event.delegation.principal_id || !event.delegation.expires_at || !event.delegation.reason_code)
    ? diagnostic("INVALID_DELEGATION", "delegation", event)
    : null;
}

function causalityError(event, catalog) {
  if (event.correlation?.causation_id && event.correlation.causation_id === event.event.id) return diagnostic("BAD_CAUSALITY", "correlation.causation_id", event);
  if (event.event.lifecycle_phase === "compensating" && !event.correlation?.original_event_id) return diagnostic("BAD_CAUSALITY", "correlation.original_event_id", event);
  if ((event.correlation?.retry_attempt ?? 0) > 0 && !event.correlation?.original_event_id) return diagnostic("BAD_CAUSALITY", "correlation.original_event_id", event);
  if (catalog.semantic.endsWith("_completed") && (!event.correlation?.causation_id || !event.correlation?.original_event_id)) return diagnostic("BAD_CAUSALITY", "correlation.causation_id/original_event_id", event);
  return null;
}

function tenantResourceError(event) {
  return event.tenant?.resource_tenant_id && event.resource?.owning_tenant_id && event.resource.owning_tenant_id !== event.tenant.resource_tenant_id
    ? diagnostic("TENANT_RESOURCE_CONFLICT", "resource.owning_tenant_id", event)
    : null;
}

function catalogMembershipError(event, catalog) {
  return !catalog.phase.includes(event.event.lifecycle_phase) || !catalog.outcomes.includes(event.event.outcome) || !catalog.commit.includes(event.event.commit_state) || event.event.delivery_class !== catalog.delivery
    ? diagnostic("UNKNOWN_CATALOG_VALUE", "event.lifecycle/outcome/commit/delivery", event)
    : null;
}

function missingRequiredFieldError(event) {
  for (const field of source.fields.filter((candidate) => candidate.r === "required")) {
    if (get(event, field.p) === undefined) return diagnostic("FIELD_LIMIT_EXCEEDED", field.p, event);
  }
  return null;
}

function canonicalFieldError(event) {
  const bounds = typeBoundsError(event);
  if (bounds) return bounds;
  const provenance = derivedFieldProvenanceError(event);
  if (provenance) return provenance;
  const unknown = unknownField(event);
  return unknown ? diagnostic("UNKNOWN_CATALOG_VALUE", unknown, event) : null;
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
