import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadSource, readJson, validateCanonicalEvent, validateCloudEventEnvelope, validateOcsfMapping, validateOtelMapping } from "../scripts/validate-contract.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = loadSource();

test("generated artifacts are deterministic and current", async () => {
  await execFileAsync("node", ["scripts/generate-artifacts.mjs", "--check"], { cwd: root });
});

test("source declares canonical boundaries and blocked production/SDK authorization", () => {
  assert.equal(source.authoritative_source, true);
  assert.equal(source.metadata.production_authorization, "blocked_no_production_authorization");
  assert.equal(source.metadata.sdk_authorization, "blocked");
  assert.match(source.metadata.canonical_boundary, /Bloodtrail is canonical/);
  assert.match(source.metadata.canonical_boundary, /OCSF 1\.8\.0 is export-only/);
  assert.match(source.metadata.canonical_boundary, /OpenTelemetry 1\.59\.0/);
  assert.match(source.metadata.canonical_boundary, /CloudEvents 1\.0\.2 is optional envelope-only/);
});

test("source records versioned primary evidence and exact support classifications", () => {
  assert.equal(source.standards.length, 9);
  for (const standard of source.standards) {
    assert.ok(standard.version, standard.id);
    assert.match(standard.url, /^https:\/\//, standard.id);
    assert.ok(["requirement", "recommendation", "mapping_option"].includes(standard.support_type), standard.id);
    assert.ok(standard.design_decision.length >= 40, standard.id);
  }
});

test("strict Draft 2020-12 schema is generated with strict object boundaries", async () => {
  const schema = await readJson("schema/security-audit-event.schema.json");
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, source.metadata.schema_id);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.unevaluatedProperties, false);
  for (const top of schema.required) assert.equal(schema.properties[top].additionalProperties, false, top);
  assert.equal(schema.properties.extensions.additionalProperties, false);
});

test("generated Draft 2020-12 schema validates all positive fixtures with a standards-compliant engine", async () => {
  const schema = await readJson("schema/security-audit-event.schema.json");
  const events = await readJson("examples/positive/all-events.json");
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  for (const event of events) assert.equal(validate(event), true, `${event.event.name}: ${ajv.errorsText(validate.errors)}`);
  const structurallyInvalid = structuredClone(events[0]);
  delete structurallyInvalid.schema.version;
  assert.equal(validate(structurallyInvalid), false);
});

test("field authority and privacy policy cover every canonical and extension field", () => {
  const authority = new Set(source.authority_matrix.map((row) => row.category));
  assert.ok(source.fields.length >= 100);
  for (const field of source.fields) {
    assert.ok(authority.has(field.a), field.p);
    assert.ok(source.registries.trust_levels.includes(field.trust), field.p);
    assert.ok(source.registries.privacy_classifications.includes(field.privacy), field.p);
    assert.ok(source.registries.field_policy_values.includes(field.policy), field.p);
    assert.ok(source.registries.retention_classes.includes(field.retention), field.p);
    assert.ok(field.compat, field.p);
  }
  for (const ext of source.extension_namespaces) {
    assert.ok(source.registries.extension_namespaces.includes(ext.namespace));
    assert.equal(ext.trust, "downstream_enrichment");
    assert.notEqual(ext.policy, "allowed");
  }
});

test("catalog contains the 24 required events with complete governed metadata", () => {
  assert.equal(source.catalog.length, 24);
  assert.equal(new Set(source.catalog.map((entry) => entry.name)).size, 24);
  for (const entry of source.catalog) {
    assert.ok(source.registries.categories.includes(entry.category), entry.name);
    assert.ok(source.registries.actions.includes(entry.action), entry.name);
    assert.ok(source.registries.delivery_classes.includes(entry.delivery), entry.name);
    for (const key of ["purpose", "trigger", "phase", "outcomes", "commit", "producer", "required_context", "actor_rule", "tenant_rule", "resource_rule", "authorization_rule", "privacy", "retention", "investigation", "ocsf", "otel", "cloud_events"]) assert.ok(entry[key], `${entry.name} missing ${key}`);
    assert.match(entry.name, /^bloodtrail\.audit\.[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*$/);
    assert.doesNotMatch(entry.name, /tenant_|user_|resource_[0-9]/);
  }
});

test("positive fixtures validate and cover catalog, actor types, tenant scopes, lifecycle, outcomes, and delivery classes", async () => {
  const events = await readJson("examples/positive/all-events.json");
  assert.equal(events.length, 24);
  const covered = { names: new Set(), actors: new Set(), tenants: new Set(), phases: new Set(), outcomes: new Set(), delivery: new Set() };
  for (const event of events) {
    assert.deepEqual(validateCanonicalEvent(event), [], event.event.name);
    covered.names.add(event.event.name);
    covered.actors.add(event.actor.type);
    covered.tenants.add(event.tenant.scope);
    covered.phases.add(event.event.lifecycle_phase);
    covered.outcomes.add(event.event.outcome);
    covered.delivery.add(event.event.delivery_class);
  }
  assert.equal(covered.names.size, 24);
  for (const actor of source.registries.actor_types) assert.ok(covered.actors.has(actor), actor);
  for (const scope of source.registries.tenant_scopes) assert.ok(covered.tenants.has(scope), scope);
  for (const phase of source.registries.lifecycle_phases) assert.ok(covered.phases.has(phase), phase);
  for (const outcome of ["success", "failure", "denied", "partial", "cancelled"]) assert.ok(covered.outcomes.has(outcome), outcome);
  for (const delivery of source.registries.delivery_classes) assert.ok(covered.delivery.has(delivery), delivery);
});

test("negative fixtures reject with exact safe error codes and no secret echo", async () => {
  const fixtures = await readJson("examples/negative/all-negative.json");
  assert.ok(fixtures.length >= 14);
  for (const fixture of fixtures) {
    const errors = validateCanonicalEvent(fixture.event);
    assert.deepEqual(errors.map((error) => error.code), fixture.expected_errors, fixture.name);
    const diagnostic = JSON.stringify(errors);
    assert.doesNotMatch(diagnostic, /SECRET_TOKEN_SHOULD_NOT_APPEAR|sk_live|Bearer\s|session_cookie/i);
    assert.ok(errors.every((error) => error.path.length <= 256));
  }
});

test("derived provenance ordering compares Unicode code points rather than UTF-16 code units", async () => {
  const fixtures = await readJson("examples/negative/all-negative.json");
  const descending = fixtures.find((fixture) => fixture.name === "derived-from-astral-order");
  assert.ok(descending, "expected the generated astral-order fixture");
  assert.deepEqual(
    validateCanonicalEvent(descending.event).map((error) => error.code),
    ["DERIVED_FROM_NONCANONICAL_ORDER"],
  );

  const ascending = structuredClone(descending.event);
  ascending.risk.model.provenance.derived_from = ["！", "\u{10000}"];
  assert.deepEqual(
    validateCanonicalEvent(ascending).map((error) => error.code),
    ["DERIVED_FROM_UNRESOLVABLE_INPUT"],
  );
});

test("derived provenance is mandatory and bounded by the least trusted input and the ceiling", async () => {
  const positive = await readJson("examples/positive/all-events.json");
  const base = positive.find((event) => event.risk?.model?.provenance?.trust_level === "derived_server" && event.actor?.id);
  const codes = (mutate) => {
    const event = structuredClone(base);
    mutate(event.risk.model.provenance, event);
    return validateCanonicalEvent(event).map((error) => error.code);
  };
  assert.deepEqual(codes(() => {}), [], "null control: an authoritative-input derived_server claim is accepted");

  // Lowering one input's trust under an unchanged claim fails, pointing at that input by position.
  const floor = structuredClone(base);
  floor.risk.model.provenance.derived_from = ["event.name", "request.user_agent"];
  const [floorError] = validateCanonicalEvent(floor);
  assert.equal(floorError.code, "DERIVED_FROM_TRUST_FLOOR_EXCEEDED");
  assert.equal(floorError.path, "risk.model.provenance.derived_from[1]");
  assert.ok(!JSON.stringify(floorError).includes("request.user_agent"), "the floor diagnostic must not echo the input path");

  // The same inputs admit a truthful lower claim.
  assert.deepEqual(codes((provenance) => {
    provenance.derived_from = ["event.name", "request.user_agent"];
    provenance.trust_level = "client_claim";
  }), []);

  // Input trust comes from the contract: raising an event-carried trust changes nothing.
  assert.deepEqual(codes((provenance, event) => {
    provenance.derived_from = ["actor.id", "event.name"];
    event.actor.provenance.trust_level = "authoritative_server";
  }), []);

  // An extension input carries its namespace's declared downstream_enrichment trust.
  const enriched = positive.find((event) => event.extensions);
  const extension = structuredClone(enriched);
  extension.risk.model.provenance.derived_from = ["event.name", "extensions.bloodtrail.audit.enrichment.v1"];
  assert.deepEqual(validateCanonicalEvent(extension).map((error) => error.code), ["DERIVED_FROM_TRUST_FLOOR_EXCEEDED"]);
  extension.risk.model.provenance.trust_level = "downstream_enrichment";
  assert.deepEqual(validateCanonicalEvent(extension).map((error) => error.code), []);

  for (const level of ["authoritative_server", "verified_assertion", "observed_transport"]) {
    assert.deepEqual(codes((provenance) => { provenance.trust_level = level; }), ["DERIVED_FROM_NON_DERIVED"], level);
  }
  assert.deepEqual(codes((provenance) => { delete provenance.derived_from; }), ["DERIVED_FROM_MISSING"]);
  assert.deepEqual(codes((provenance) => { delete provenance.trust_level; }), ["DERIVED_FROM_MISSING"]);
  assert.deepEqual(codes((provenance) => { provenance.derived_from = ["event.name", "risk.level"]; }), ["DERIVED_FROM_CYCLE"]);
  const withoutRisk = structuredClone(base);
  delete withoutRisk.risk;
  assert.deepEqual(validateCanonicalEvent(withoutRisk), [], "an event without risk needs no provenance");
});

test("OCSF mapping is export-only, version-pinned, event-complete, and bounded", async () => {
  const rows = await readJson("fixtures/mappings/ocsf-1.8.0.json");
  assert.equal(rows.length, 24);
  for (const row of rows) {
    assert.deepEqual(validateOcsfMapping(row), [], row.canonical_event_name);
    assert.equal(row.target_version, "1.8.0");
    assert.equal(row.boundary, "ingestion/export only");
    assert.ok(["exact", "transformed", "extended", "unmapped", "lossy"].includes(row.mapping_status));
    assert.equal(row.full_compatibility_claim, false);
  }
});

test("OpenTelemetry mapping is transport-only and rejects unsafe conflicts", async () => {
  const rows = await readJson("fixtures/mappings/opentelemetry-1.59.0-semconv-1.43.0.json");
  assert.equal(rows.length, 24);
  for (const row of rows) assert.deepEqual(validateOtelMapping(row), [], row.canonical_event_name);
  const conflicts = await readJson("fixtures/mappings/negative-mapping-conflicts.json");
  for (const fixture of conflicts.filter((item) => item.mapping)) assert.deepEqual(validateOtelMapping(fixture.mapping).map((error) => error.code), fixture.expected_errors, fixture.name);
});

test("CloudEvents remains optional envelope-only and rejects payload conflicts", async () => {
  const envelopes = await readJson("fixtures/mappings/cloudevents-1.0.2.json");
  for (const envelope of envelopes) {
    assert.equal(envelope.specversion, "1.0");
    assert.deepEqual(validateCloudEventEnvelope(envelope), [], envelope.type);
  }
  const conflicts = await readJson("fixtures/mappings/negative-mapping-conflicts.json");
  for (const fixture of conflicts.filter((item) => item.envelope)) assert.deepEqual(validateCloudEventEnvelope(fixture.envelope).map((error) => error.code), fixture.expected_errors, fixture.name);
});

test("compatibility, delivery, and integrity fixtures encode blocked and bounded claims", async () => {
  const compatibility = await readJson("fixtures/compatibility/compatibility-scenarios.json");
  assert.ok(compatibility.some((fixture) => fixture.name === "major-authority-change" && fixture.expected === "breaking"));
  assert.ok(compatibility.some((fixture) => fixture.name === "unsupported-version" && fixture.expected_errors.includes("UNSUPPORTED_COMPATIBILITY_VERSION")));
  const delivery = await readJson("fixtures/delivery/delivery-scenarios.json");
  assert.ok(delivery.some((fixture) => fixture.name === "missing-policy-critical-failure-posture" && fixture.expected_errors.includes("UNAPPROVED_POLICY_CRITICAL_POSTURE")));
  const integrity = await readJson("fixtures/integrity/negative-integrity-claims.json");
  assert.equal(integrity.length, source.integrity_claims.length);
  assert.ok(integrity.every((fixture) => /does_not_upgrade/.test(fixture.expected)));
});

test("package has no production implementation dependencies or runtime integration", async () => {
  const pkg = await readJson("package.json");
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.deepEqual(pkg.devDependencies, { ajv: "^8.20.0", "ajv-formats": "^3.0.1" });
  const docs = `${await readFile(resolve(root, "README.md"), "utf8")}\n${await readFile(resolve(root, "docs/readiness-report.md"), "utf8")}`;
  assert.match(docs, /adds no SDK/i);
  assert.match(docs, /SDK authorization: none/i);
});
