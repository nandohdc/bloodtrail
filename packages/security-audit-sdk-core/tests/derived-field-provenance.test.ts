import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { validateSecurityAuditEvent, type SecurityAuditEvent } from "../dist/index.js";

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");

function withDerivedInputs(event: SecurityAuditEvent, inputs: readonly string[]): SecurityAuditEvent {
  assert.ok(event.risk?.model?.provenance, "expected derived provenance fixture");
  return {
    ...event,
    risk: {
      ...event.risk,
      model: {
        ...event.risk.model,
        provenance: { ...event.risk.model.provenance, derived_from: inputs },
      },
    },
  };
}

function assertValidationCode(event: SecurityAuditEvent, expected: string): void {
  const result = validateSecurityAuditEvent(event);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, expected);
}

function withProvenance(
  event: SecurityAuditEvent,
  change: (provenance: Record<string, unknown>) => void,
): SecurityAuditEvent {
  const copy = structuredClone(event) as SecurityAuditEvent & {
    risk: { model: { provenance: Record<string, unknown> } };
  };
  change(copy.risk.model.provenance);
  return copy;
}

async function readFixtures<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(contractRoot, path), "utf8")) as T;
}

test("contract 2.0.0 makes provenance mandatory on every event carrying risk", async () => {
  const fixtures = await readFixtures<SecurityAuditEvent[]>("examples/positive/all-events.json");
  for (const event of fixtures) {
    assert.ok(event.risk?.model?.provenance?.derived_from, `${event.event.name} carries risk without provenance`);
    assert.equal(validateSecurityAuditEvent(event).ok, true, event.event.name);
  }
  const base = fixtures.find((event) => event.risk?.model?.provenance?.trust_level === "derived_server")!;
  assertValidationCode(withProvenance(base, (provenance) => { delete provenance.derived_from; }), "DERIVED_FROM_MISSING");
  assertValidationCode(withProvenance(base, (provenance) => { delete provenance.trust_level; }), "DERIVED_FROM_MISSING");
  const { risk: _risk, ...withoutRisk } = base;
  assert.equal(validateSecurityAuditEvent(withoutRisk as SecurityAuditEvent).ok, true, "no risk needs no provenance");
});

test("the trust floor rejects a claim above the least trusted input and points at it by position", async () => {
  const fixtures = await readFixtures<SecurityAuditEvent[]>("examples/positive/all-events.json");
  const base = fixtures.find((event) => event.risk?.model?.provenance?.trust_level === "derived_server")!;
  assert.equal(validateSecurityAuditEvent(base).ok, true, "null control");
  const lowered = withDerivedInputs(base, ["event.name", "request.user_agent"]);
  const result = validateSecurityAuditEvent(lowered);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "DERIVED_FROM_TRUST_FLOOR_EXCEEDED");
    assert.equal(result.error.path, "/risk/model/provenance/derived_from/1");
    assert.ok(!JSON.stringify(result.error).includes("user_agent"), "the diagnostic must not echo the input path");
  }
  const truthful = withProvenance(lowered, (provenance) => { provenance.trust_level = "client_claim"; });
  assert.equal(validateSecurityAuditEvent(truthful).ok, true, "a truthful lower claim over the same inputs is admissible");
  for (const level of ["authoritative_server", "verified_assertion", "observed_transport"]) {
    assertValidationCode(withProvenance(base, (provenance) => { provenance.trust_level = level; }), "DERIVED_FROM_NON_DERIVED");
  }
  assertValidationCode(withDerivedInputs(base, ["event.name", "risk.score"]), "DERIVED_FROM_CYCLE");
});

test("input trust comes from the contract, not from the event", async () => {
  const fixtures = await readFixtures<SecurityAuditEvent[]>("examples/positive/all-events.json");
  const base = fixtures.find((event) => event.risk?.model?.provenance?.trust_level === "derived_server" && event.actor?.id)!;
  const raised = structuredClone(withDerivedInputs(base, ["actor.id", "event.name"]));
  (raised.actor as { provenance: { trust_level: string } }).provenance.trust_level = "authoritative_server";
  assert.equal(validateSecurityAuditEvent(raised).ok, true);
  const enriched = fixtures.find((event) => event.extensions)!;
  const extensionInput = withDerivedInputs(enriched, ["event.name", "extensions.bloodtrail.audit.enrichment.v1"]);
  assertValidationCode(extensionInput, "DERIVED_FROM_TRUST_FLOOR_EXCEEDED");
});

test("the SDK kernel decides every generated provenance fixture exactly as the contract validator does", async () => {
  const negatives = await readFixtures<Array<{ readonly name: string; readonly expected_errors: readonly string[]; readonly event: SecurityAuditEvent }>>(
    "examples/negative/all-negative.json",
  );
  const provenanceFixtures = negatives.filter((fixture) => fixture.name.startsWith("derived-from-"));
  assert.ok(provenanceFixtures.length >= 13, "expected every generated provenance outcome");
  for (const fixture of provenanceFixtures) {
    assertValidationCode(fixture.event, fixture.expected_errors[0]!);
  }
});

test("derived provenance ordering compares Unicode code points rather than UTF-16 code units", async () => {
  const fixtures = JSON.parse(
    await readFile(resolve(contractRoot, "examples/negative/all-negative.json"), "utf8"),
  ) as Array<{ readonly name: string; readonly event: SecurityAuditEvent }>;
  const fixture = fixtures.find((candidate) => candidate.name === "derived-from-astral-order");
  assert.ok(fixture, "expected the generated astral-order fixture");

  assertValidationCode(fixture.event, "DERIVED_FROM_NONCANONICAL_ORDER");
  assertValidationCode(
    withDerivedInputs(fixture.event, ["！", "\u{10000}"]),
    "DERIVED_FROM_UNRESOLVABLE_INPUT",
  );
});
