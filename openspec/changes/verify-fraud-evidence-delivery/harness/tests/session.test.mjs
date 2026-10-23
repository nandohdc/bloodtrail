// roleExchange with fixture role scripts in a temporary own service: no kit code, no harness role. The
// planted case halts the session while its ingress starts, and no sender may spawn; the null control lets
// the exchange run to its read-back.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { roleExchange, stopRoles } from "../lib/session.mjs";

const ROLE = (reply) => `process.on("message", (message) => {
  if (message.type === "start") process.send(${reply});
  if (message.type === "read_back") process.send({ type: "read_back", records: [], read_back: [] });
  if (message.type === "stop") process.send({ type: "stopped" }, () => process.exit(0));
});
`;

function fixtureService() {
  const service = realpathSync(mkdtempSync(join(tmpdir(), "stage-2-session-fixture-")));
  mkdirSync(join(service, "harness", "fixture"), { recursive: true });
  writeFileSync(join(service, "harness", "fixture", "ingress-process.mjs"), ROLE('{ type: "ready", port: 1, resolved: {} }'));
  writeFileSync(join(service, "harness", "fixture", "sender-process.mjs"), ROLE('{ type: "report", resolved: {}, ledger: { occurrence_count: 0 } }'));
  return service;
}

const exchange = ({ service, roles, proceed }) => roleExchange({
  service, directory: service, flags: { ingress: [], sender: [] }, probeDirectory: "fixture", senderInput: {}, faultPlan: { default: "acknowledge", rules: [] },
  roles, token: "fixture-token", proceed,
});

test("a session halted while its ingress started spawns no sender", async () => {
  const service = fixtureService();
  const roles = {};
  try {
    await assert.rejects(exchange({ service, roles, proceed: () => false }), /session halted before the sender started/);
    assert.equal(roles.sender, undefined);
    assert.notEqual(roles.ingress, undefined);
  } finally {
    await stopRoles(roles);
    rmSync(service, { recursive: true, force: true });
  }
});

test("null control: an exchange that may proceed runs to its read-back", async () => {
  const service = fixtureService();
  const roles = {};
  try {
    const result = await exchange({ service, roles, proceed: () => true });
    assert.equal(result.occurrence_count, 0);
    assert.deepEqual(result.ingress.read_back, []);
    assert.notEqual(roles.sender, undefined);
  } finally {
    await stopRoles(roles);
    rmSync(service, { recursive: true, force: true });
  }
});
