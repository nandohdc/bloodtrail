// roleExchange with fixture role scripts in a temporary own service: no kit code, no harness role. The
// planted case halts the session while its ingress starts, and no sender may spawn; the null control lets
// the exchange run to its read-back.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { roleChannel } from "../lib/launcher.mjs";
import { roleExchange, stopRoles } from "../lib/session.mjs";
import { command, sha256 } from "../lib/io.mjs";

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

test("a session halted while its ingress started spawns no sender", { timeout: 10000 }, async () => {
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

test("null control: an exchange that may proceed runs to its read-back", { timeout: 10000 }, async () => {
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

test("a close timeout is a failure, never proof of role closure", { timeout: 5000 }, async () => {
  const role = { exited: () => null, kill() {}, whenClosed: () => new Promise(() => {}) };
  await assert.rejects(stopRoles({ sender: role }, { timeoutMs: 10 }), /role closure.*deadline/i);
});

test("final read-back follows actual sender closure and ingress quiescence", { timeout: 10000 }, async () => {
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

test("tracer, outages and load ingress process scripts are hash-pinned to committed a2cdbc1 (Q141, Q173)", () => {
  const probes = ["tracer", "outages", "load"];
  for (const probe of probes) {
    const gitPath = `openspec/changes/verify-fraud-evidence-delivery/harness/${probe}/ingress-process.mjs`;
    const committed = command({ program: "git", args: ["show", `a2cdbc1:${gitPath}`] });
    const local = readFileSync(join(import.meta.dirname, `../${probe}/ingress-process.mjs`), "utf8");
    assert.equal(sha256(local), sha256(committed), `${probe}/ingress-process.mjs must match commit a2cdbc1`);
  }
});

function makeFakeChannel(handlers) {
  const child = new EventEmitter();
  child.send = (message) => {
    setImmediate(async () => {
      const handler = handlers[message.type];
      if (!handler) return;
      const reply = await handler(message);
      child.emit("message", reply);
      if (reply.type === "stopped") {
        setImmediate(() => {
          child.emit("exit", 0, null);
          child.emit("close", 0, null);
        });
      }
    });
  };
  child.kill = () => {
    setImmediate(() => {
      child.emit("exit", 0, null);
      child.emit("close", 0, null);
    });
  };
  return { ...roleChannel(child), stderr: () => "" };
}

function createInjectableSpawn(finalizeReply, readyReply) {
  return function fakeSpawn({ role }) {
    if (role === "ingress") {
      return makeFakeChannel({
        start: async () => readyReply,
        finalize: async () => finalizeReply,
        stop: async () => ({ type: "stopped" }),
      });
    }
    return makeFakeChannel({
      start: async () => ({ type: "report", resolved: {}, ledger: { occurrence_count: 0 } }),
      stop: async () => ({ type: "stopped" }),
    });
  };
}

test("roleExchange ingress observation keys match ready minus type plus finalize keys, including restarts", { timeout: 10000 }, async () => {
  const readyReply = { type: "ready", port: 1234, controls: { write_outside_grant: { holds: true } }, resolved: {} };
  const standardFinalize = { type: "read_back", records: [], read_back: [], quiescent: true };
  const service = fixtureService();
  const roles = {};

  try {
    const standardSpawn = createInjectableSpawn(standardFinalize, readyReply);
    const result = await roleExchange({
      service, directory: service, flags: { ingress: [], sender: [] }, probeDirectory: "fixture",
      senderInput: {}, faultPlan: { default: "acknowledge", rules: [] }, roles, token: "tok",
      spawn: standardSpawn,
    });

    const readyKeysMinusType = new Set(Object.keys(readyReply));
    readyKeysMinusType.delete("type");
    const expectedKeys = new Set([...readyKeysMinusType, "records", "read_back", "quiescent"]);
    assert.deepEqual(new Set(Object.keys(result.ingress)), expectedKeys);

    const roles2 = {};
    const withRestarts = { ...standardFinalize, restarts: [{ count: 1 }] };
    const restartSpawn = createInjectableSpawn(withRestarts, readyReply);
    const result2 = await roleExchange({
      service, directory: service, flags: { ingress: [], sender: [] }, probeDirectory: "fixture",
      senderInput: {}, faultPlan: { default: "acknowledge", rules: [] }, roles: roles2, token: "tok",
      spawn: restartSpawn,
    });

    const expectedWithRestarts = new Set([...expectedKeys, "restarts"]);
    assert.deepEqual(new Set(Object.keys(result2.ingress)), expectedWithRestarts);
    assert.deepEqual(result2.ingress.restarts, [{ count: 1 }]);
  } finally {
    rmSync(service, { recursive: true, force: true });
  }
});
