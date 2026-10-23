import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { StopCondition } from "../lib/deadline.mjs";
import { roleChannel, verifyFileBytes } from "../lib/launcher.mjs";
import { invalidationOf } from "../lib/results.mjs";
import { stopRoles, withRoleStderr } from "../lib/session.mjs";

function fixtureChild() {
  const child = new EventEmitter();
  child.sent = [];
  child.send = (message) => child.sent.push(message);
  child.kill = (signal) => {
    child.emit("exit", null, signal);
    child.emit("close", null, signal);
  };
  return child;
}

test("next resolves with the awaited message, whether it arrived before or after the wait", async () => {
  const child = fixtureChild();
  const channel = roleChannel(child);
  child.emit("message", { type: "ready", port: 1 });
  assert.deepEqual(await channel.next("ready", "ingress"), { type: "ready", port: 1 });
  const waiting = channel.next("report", "sender");
  child.emit("message", { type: "report", calls: [] });
  assert.deepEqual(await waiting, { type: "report", calls: [] });
  channel.send({ type: "stop" });
  assert.deepEqual(child.sent, [{ type: "stop" }]);
});

test("a role error rejects the wait instead of resolving it", async () => {
  const child = fixtureChild();
  const channel = roleChannel(child);
  const waiting = channel.next("report", "sender");
  child.emit("message", { type: "error", message: "boom" });
  await assert.rejects(waiting, /sender process error: boom/);
});

test("S2: a loopback-guard violation halts the run, even when it arrived before the wait", async () => {
  const child = fixtureChild();
  const channel = roleChannel(child);
  child.emit("message", { type: "violation", message: "non-loopback connection to 192.0.2.1" });
  await assert.rejects(channel.next("report", "sender"), (error) => {
    assert.equal(error.condition, "non_loopback");
    assert.match(error.message, /^S2 stop \(non_loopback\): sender: non-loopback connection to 192\.0\.2\.1$/);
    return true;
  });
});

test("an exit rejects every pending wait and every later one", async () => {
  const child = fixtureChild();
  const channel = roleChannel(child);
  const waiting = channel.next("read_back", "ingress");
  channel.kill();
  await assert.rejects(waiting, /ingress process exited \(SIGKILL\) before read_back/);
  await assert.rejects(channel.next("stopped", "ingress"), /exited before stopped/);
  assert.deepEqual(channel.exited(), { code: null, signal: "SIGKILL" });
});

test("a session failure carries each role's stderr with the token redacted, in the one invalidation shape", () => {
  const token = "f".repeat(48);
  const roles = { ingress: { stderr: () => `TypeError: bad header Bearer ${token}\n` }, sender: { stderr: () => "" } };
  const error = withRoleStderr({ error: new StopCondition("deadline", "run exceeded 10 ms"), roles, token });
  assert.deepEqual(invalidationOf(error), {
    message: "S2 stop (deadline): run exceeded 10 ms", condition: "deadline",
    role_stderr: { ingress: "TypeError: bad header Bearer [redacted token]\n", sender: "" },
  });
  assert.deepEqual(invalidationOf("results write failed: EEXIST"), { message: "results write failed: EEXIST" });
  assert.deepEqual(invalidationOf(new Error("boom")), { message: "boom" });
});

test("a final message read after the exit event still resolves its wait; close rejects what is left", async () => {
  const child = fixtureChild();
  const channel = roleChannel(child);
  const stopped = channel.next("stopped", "ingress");
  const never = channel.next("read_back", "ingress");
  child.emit("exit", 0, null);
  child.emit("message", { type: "stopped" });
  child.emit("close", 0, null);
  assert.deepEqual(await stopped, { type: "stopped" });
  await assert.rejects(never, /ingress process exited \(0\) before read_back/);
});

test("executed bytes must equal the approved blob", () => {
  assert.match(verifyFileBytes({ bytes: Buffer.from("a"), committed: Buffer.from("a") }), /^[0-9a-f]{64}$/);
  assert.throws(() => verifyFileBytes({ bytes: Buffer.from("a"), committed: Buffer.from("b") }), /differs from approved Git blob/);
});

test("stopping roles kills them and waits until each has closed, within a bound", async () => {
  const child = fixtureChild();
  const channel = roleChannel(child);
  let closedAt = null;
  child.kill = () => { child.emit("exit", null, "SIGKILL"); setTimeout(() => { closedAt = Date.now(); child.emit("close", null, "SIGKILL"); }, 20); };
  await stopRoles({ ingress: channel });
  assert.notEqual(closedAt, null, "returned only after the role closed");
  const stuck = roleChannel(fixtureChild());
  const started = Date.now();
  stuck.kill = () => {};
  await stopRoles({ sender: stuck }, { timeoutMs: 30 });
  assert(Date.now() - started < 1000, "a role that never closes does not hang the session");
});
