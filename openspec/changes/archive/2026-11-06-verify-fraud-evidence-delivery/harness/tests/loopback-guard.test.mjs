// The guard runs for real in this test process (node --test isolates each file in its own process).
// The planted target is a documentation address on port 80, refused before any connection is attempted.
import assert from "node:assert/strict";
import dgram from "node:dgram";
import diagnostics from "node:diagnostics_channel";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { connectTarget, installLoopbackGuard, isLoopbackHost, isLoopbackUrl, refusesTarget } from "../lib/loopback-guard.mjs";
import { guardControls, requireControls } from "../lib/controls.mjs";

let server;
let port;

before(async () => {
  server = createServer((socket) => socket.end());
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  port = server.address().port;
});

after(() => new Promise((resolveClose) => server.close(resolveClose)));

test("only literal loopback addresses are loopback", () => {
  for (const host of ["127.0.0.1", "::1", "[::1]"]) assert(isLoopbackHost(host), host);
  for (const host of ["localhost", "127.0.0.2", "0.0.0.0", "192.0.2.1", "::ffff:192.0.2.1", undefined]) assert(!isLoopbackHost(host), String(host));
  assert(isLoopbackUrl("http://127.0.0.1:8080/v1"));
  assert(isLoopbackUrl("http://[::1]:8080/v1"));
  assert(!isLoopbackUrl("http://192.0.2.1:80/"));
});

test("connect targets are read from every connect call shape", () => {
  assert.deepEqual(connectTarget([{ host: "192.0.2.1", port: 80 }]), { host: "192.0.2.1", path: undefined });
  assert.deepEqual(connectTarget([[{ host: "127.0.0.1", port: 1 }, null]]), { host: "127.0.0.1", path: undefined });
  assert.deepEqual(connectTarget([80, "192.0.2.1"]), { host: "192.0.2.1", path: undefined });
  assert.deepEqual(connectTarget([80]), { host: "localhost", path: undefined });
  assert.deepEqual(connectTarget(["/tmp/socket"]), { host: undefined, path: "/tmp/socket" });
  assert.deepEqual(connectTarget(["80", "192.0.2.1"]), { host: "192.0.2.1", path: undefined }, "a numeric string is a port, as in Node");
  assert.equal(refusesTarget(connectTarget(["80", "192.0.2.1"])), true);
  assert.equal(refusesTarget({ host: "localhost", path: undefined }), true, "a name is refused: it could resolve off-host");
  assert.equal(refusesTarget({ host: undefined, path: "/tmp/socket" }), false);
});

test("planted defect and null control: fetch to 192.0.2.1:80 is refused before connecting; loopback passes", async () => {
  const seen = [];
  const guard = installLoopbackGuard({ onViolation: (violation) => seen.push(violation) });
  try {
    const controls = await guardControls({ guard, port });
    assert.equal(controls.planted.refused, true);
    assert.equal(controls.planted.fired, true);
    assert.deepEqual(seen, [{ host: "192.0.2.1", stage: "before_connect" }]);
    assert.deepEqual(controls.null_control, { connected: true, silent: true });
    assert.equal(controls.holds, true);
  } finally {
    guard.uninstall();
  }
});

test("a guard whose violations go unrecorded fails its control", async () => {
  // The real guard stays installed so nothing leaves loopback; the control reads a silent record.
  const guard = installLoopbackGuard({ onViolation: () => {} });
  try {
    const controls = await guardControls({ guard: { violations: [] }, port });
    assert.equal(controls.planted.refused, true);
    assert.equal(controls.planted.fired, false);
    assert.equal(controls.holds, false);
  } finally {
    guard.uninstall();
  }
});

test("a failed live control stops its role before traffic; holding controls pass through", () => {
  const holding = { loopback_guard: { holds: true }, write_outside_grant: { holds: true } };
  assert.equal(requireControls(holding), holding);
  assert.throws(() => requireControls({ ...holding, synthetic_data: { holds: false } }), /control failed before traffic: synthetic_data/);
  assert.throws(() => requireControls({ loopback_guard: {} }), /loopback_guard/, "a control with no verdict does not hold");
});

test("planted defect: a datagram is refused and recorded, and uninstalling restores UDP", () => {
  const guard = installLoopbackGuard({ onViolation: () => {} });
  const socket = dgram.createSocket("udp4");
  try {
    assert.throws(() => socket.send("x", 53, "192.0.2.1"), /UDP refused/);
    assert.deepEqual(guard.violations, [{ host: "udp", stage: "udp_send" }]);
  } finally {
    guard.uninstall();
    socket.close();
  }
  assert.notEqual(dgram.Socket.prototype.send.name, "refusedDatagram");
});

test("the after-connect check judges a present address and skips a socket already closed", () => {
  const guard = installLoopbackGuard({ onViolation: () => {} });
  try {
    const connected = diagnostics.channel("undici:client:connected");
    connected.publish({ socket: { remoteAddress: undefined } });
    connected.publish({ socket: { remoteAddress: "127.0.0.1" } });
    assert.deepEqual(guard.violations, [], "a closed socket and a loopback one are not violations");
    connected.publish({ socket: { remoteAddress: "192.0.2.1" } });
    assert.deepEqual(guard.violations, [{ host: "192.0.2.1", stage: "after_connect" }]);
  } finally {
    guard.uninstall();
  }
});
