// roleExchange with fixture role scripts in a temporary own service: no kit code, no harness role. The
// planted case halts the session while its ingress starts, and no sender may spawn; the null control lets
// the exchange run to its read-back.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { roleExchange, stopRoles } from "../lib/session.mjs";

const ROLE = (reply) => `process.on("message", (message) => {
  if (message.type === "start") process.send(${reply});
  if (message.type === "read_back" || message.type === "finalize") process.send({ type: "read_back", records: [], read_back: [], quiescent: true });
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

test("a close timeout is a failure, never proof of role closure", async () => {
  const role = { exited: () => null, kill() {}, whenClosed: () => new Promise(() => {}) };
  await assert.rejects(stopRoles({ sender: role }, { timeoutMs: 10 }), /role closure.*deadline/i);
});

test("final read-back follows actual sender closure and ingress quiescence", async () => {
  const service = fixtureService();
  const roles = {};
  const order = join(service, "order");
  const sender = `import { appendFileSync } from "node:fs"; process.on("exit", () => appendFileSync(${JSON.stringify(order)}, "sender-closed\\n"));\n` + ROLE('{ type: "report", resolved: {}, ledger: { occurrence_count: 0 } }');
  const ingress = `import { appendFileSync } from "node:fs";\n` + ROLE('{ type: "ready", port: 1, resolved: {} }').replace('process.send({ type: "read_back",', `appendFileSync(${JSON.stringify(order)}, "ingress-quiescent-read\\n"), process.send({ type: "read_back",`);
  writeFileSync(join(service, "harness/fixture/sender-process.mjs"), sender);
  writeFileSync(join(service, "harness/fixture/ingress-process.mjs"), ingress);
  try {
    const result = await exchange({ service, roles, proceed: () => true });
    assert.deepEqual(readFileSync(order, "utf8").trim().split("\n"), ["sender-closed", "ingress-quiescent-read"]);
    assert.equal(result.ingress.quiescent, true);
    assert.equal(result.role_closure.sender.code, 0);
    assert.equal(result.role_closure.ingress.code, 0);
  } finally {
    await stopRoles(roles);
    rmSync(service, { recursive: true, force: true });
  }
});
