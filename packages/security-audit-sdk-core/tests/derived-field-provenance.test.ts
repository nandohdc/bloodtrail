import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { validateSecurityAuditEvent, type SecurityAuditEvent } from "../dist/index.js";

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");

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
