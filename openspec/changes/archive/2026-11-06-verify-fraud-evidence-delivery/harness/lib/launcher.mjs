import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StopCondition } from "./deadline.mjs";
import { command, inside, sha256 } from "./io.mjs";

export function verifyFileBytes({ bytes, committed }) {
  assert.equal(sha256(bytes), sha256(committed), "executed file differs from approved Git blob");
  return sha256(bytes);
}

export function copyApprovedFiles({ repo, approvedHead, service, paths, prefix }) {
  const hashes = {};
  for (const path of paths) {
    assert(path.startsWith(prefix + "/"));
    const blob = command({ program: "git", args: ["rev-parse", `${approvedHead}:${path}`], cwd: repo }).trim();
    const committed = command({ program: "git", args: ["cat-file", "blob", blob], cwd: repo, encoding: null });
    const bytes = readFileSync(join(repo, path));
    hashes[path] = { git_blob: blob, sha256: verifyFileBytes({ bytes, committed }) };
    const target = join(service, "harness", path.slice(prefix.length + 1));
    inside({ root: service, path: target });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    assert.equal(sha256(readFileSync(target)), hashes[path].sha256);
  }
  return hashes;
}

export function assertResolution({ service, resolved }) {
  assert(resolved.startsWith("file:"), "kit package must resolve to a file URL");
  inside({ root: realpathSync(service), path: realpathSync(fileURLToPath(resolved)) });
}

// A failure a role reports instead of the message the orchestrator awaits: an error, or a stop condition
// (for example a loopback-guard violation), which halts the run under S2.
const FAILURES = new Set(["error", "violation"]);

function failureError({ role, message }) {
  if (message.type === "violation") return new StopCondition("non_loopback", `${role}: ${message.message}`);
  return new Error(`${role} process error: ${message.message}`);
}

// A message channel to one forked role process. Messages are { type, ...fields }; `next(type)` resolves
// with the next message of that type, or rejects if the process exits or reports a failure first.
//
// Waiters are rejected on "close", not "exit": a role that sends its last message and exits at once can
// raise "exit" before that message is read, while "close" waits for the IPC channel to drain.
export function roleChannel(child) {
  const waiting = [];
  const inbox = [];
  let exited = null;
  let closed = null;
  let announceClose;
  const whenClosed = new Promise((resolveClose) => { announceClose = resolveClose; });
  const settle = (message) => {
    const failing = FAILURES.has(message.type);
    const index = waiting.findIndex((entry) => failing || entry.type === message.type);
    if (index === -1) return inbox.push(message);
    const [entry] = waiting.splice(index, 1);
    return failing ? entry.reject(failureError({ role: entry.role, message })) : entry.resolve(message);
  };
  child.on("message", settle);
  child.on("exit", (code, signal) => {
    exited = { code, signal };
  });
  child.on("close", (code, signal) => {
    closed = { code, signal };
    announceClose(closed);
    for (const entry of waiting.splice(0)) entry.reject(new Error(`${entry.role} process exited (${code ?? signal}) before ${entry.type}`));
  });
  return {
    send: (message) => child.send(message),
    next(type, role) {
      const failure = inbox.find((message) => FAILURES.has(message.type));
      if (failure !== undefined) return Promise.reject(failureError({ role, message: failure }));
      const index = inbox.findIndex((message) => message.type === type);
      if (index !== -1) return Promise.resolve(inbox.splice(index, 1)[0]);
      if (closed !== null) return Promise.reject(new Error(`${role} process exited before ${type}`));
      return new Promise((resolveMessage, reject) => waiting.push({ type, role, resolve: resolveMessage, reject }));
    },
    kill: () => child.kill("SIGKILL"),
    exited: () => exited,
    whenClosed: () => whenClosed,
  };
}

const STDERR_LIMIT = 64 * 1024;

// Forks one role under its permission flags. stderr is kept (bounded) in memory so a crash stays
// diagnosable; the session attaches it, redacted, to the failure that ends the run.
export function spawnRole({ service, script, flags }) {
  inside({ root: realpathSync(service), path: realpathSync(script) });
  const child = fork(script, [], { cwd: service, execArgv: flags, stdio: ["ignore", "ignore", "pipe", "ipc"] });
  const stderr = [];
  let size = 0;
  child.stderr.on("data", (chunk) => {
    if (size < STDERR_LIMIT) stderr.push(chunk);
    size += chunk.length;
  });
  return { ...roleChannel(child), stderr: () => Buffer.concat(stderr).toString("utf8").slice(0, STDERR_LIMIT) };
}
