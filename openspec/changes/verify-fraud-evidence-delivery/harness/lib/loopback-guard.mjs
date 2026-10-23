// Loopback-only network guard for Stage 2 probe processes (S2 stop: non-loopback traffic).
//
// Node's `--allow-net` cannot restrict hosts, so the guard checks every socket connection before it is
// attempted: `net.Socket.prototype.connect` is wrapped, which `fetch` (undici) and raw sockets both
// reach. A non-loopback target is refused by destroying the socket before it connects, and recorded as
// a violation. A diagnostics_channel subscriber re-checks each connected undici socket's remote address.
// The roles send no datagrams, so UDP is refused outright. A hostname is refused before any lookup,
// because only literal loopback addresses pass; direct `node:dns` queries are not intercepted, and the
// roles make none.
import dgram from "node:dgram";
import diagnostics from "node:diagnostics_channel";
import net from "node:net";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]"]);

export function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.has(host);
}

export function isLoopbackUrl(url) {
  return isLoopbackHost(new URL(url).hostname);
}

// Node's own rule (net.js isPipeName): a string is a Unix-socket path unless it reads as a port number.
function isPipeName(value) {
  return typeof value === "string" && !(Number(value) >= 0);
}

// The connect target, from either connect(options), connect(port, host) or Node's internal normalized
// argument array. A Unix-socket path is not network traffic and is reported as such.
export function connectTarget(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first !== null && typeof first === "object") return { host: first.host ?? "localhost", path: first.path };
  if (isPipeName(first)) return { host: undefined, path: first };
  return { host: typeof args[1] === "string" ? args[1] : "localhost", path: undefined };
}

export function refusesTarget(target) {
  return target.path === undefined && !isLoopbackHost(target.host);
}

export function installLoopbackGuard({ onViolation }) {
  const violations = [];
  const record = (host, stage) => {
    violations.push({ host, stage });
    onViolation({ host, stage });
  };
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function guardedConnect(...args) {
    const target = connectTarget(args);
    if (!refusesTarget(target)) return original.apply(this, args);
    record(target.host, "before_connect");
    this.destroy(new Error(`non-loopback connection refused: ${target.host}`));
    return this;
  };
  // A socket destroyed or reset before this message is handled has no remote address left; its target was
  // already vetted before it connected, so only a present, non-loopback address is a violation.
  const afterConnect = ({ socket }) => {
    if (socket.remoteAddress !== undefined && !isLoopbackHost(socket.remoteAddress)) record(socket.remoteAddress, "after_connect");
  };
  diagnostics.subscribe("undici:client:connected", afterConnect);
  const datagrams = { send: dgram.Socket.prototype.send, connect: dgram.Socket.prototype.connect };
  for (const name of Object.keys(datagrams)) {
    dgram.Socket.prototype[name] = function refusedDatagram() {
      record("udp", `udp_${name}`);
      throw new Error("UDP refused: Stage 2 roles send no datagrams");
    };
  }
  return {
    violations,
    uninstall() {
      net.Socket.prototype.connect = original;
      diagnostics.unsubscribe("undici:client:connected", afterConnect);
      Object.assign(dgram.Socket.prototype, datagrams);
    },
  };
}
