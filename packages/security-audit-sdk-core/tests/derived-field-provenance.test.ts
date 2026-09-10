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

test("derived provenance accepts canonical inputs and preserves optional absence", async () => {
  const fixtures = JSON.parse(
    await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8"),
  ) as SecurityAuditEvent[];
  const withProvenance = fixtures.find((event) => event.risk?.model?.provenance?.derived_from);
  const withoutProvenance = fixtures.find((event) => !event.risk?.model?.provenance?.derived_from);
  assert.ok(withProvenance, "expected one generated valid provenance fixture");
  assert.ok(withoutProvenance, "expected one generated absent-provenance control");
  assert.equal(validateSecurityAuditEvent(withProvenance).ok, true);
  assert.equal(validateSecurityAuditEvent(withoutProvenance).ok, true);
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
