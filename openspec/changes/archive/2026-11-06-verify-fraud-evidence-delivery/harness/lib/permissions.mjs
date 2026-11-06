// Node permission-model grants for the two Stage 2 probe processes.
//
// - sender: network (loopback guard) and own-service read access; outbox alone declares an extra
//   read/write grant to one harness-local host-database directory under scratch.
// - ingress: loopback network and own-service reads, plus read/write on one collector-storage directory.
// Neither process may spawn children. The orchestrator itself runs without the permission model.
import assert from "node:assert/strict";
import { mkdirSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { inside } from "./io.mjs";

function disjoint(left, right, kind) {
  assert(left !== right, `${kind} scope overlaps a protected tree`);
  assert(!left.startsWith(right + sep), `${kind} scope overlaps a protected tree`);
  assert(!right.startsWith(left + sep), `${kind} scope overlaps a protected tree`);
}

function scopedDirectory({ scratch, repo, service, directory }, kind) {
  const real = realpathSync(directory);
  assert(statSync(real).isDirectory(), `${kind} path must be a directory`);
  const root = realpathSync(scratch);
  disjoint(root, realpathSync(repo), kind);
  inside({ root, path: real });
  inside({ root, path: realpathSync(service) });
  disjoint(real, realpathSync(service), kind);
  return real;
}

export function storageDirectory(options) {
  return scopedDirectory(options, "storage");
}

export function prepareStorage({ scratch, repo, service }) {
  const directory = join(realpathSync(scratch), "collector-storage");
  mkdirSync(directory);
  return storageDirectory({ scratch, repo, service, directory });
}

export function hostDatabaseDirectory(options) {
  return scopedDirectory(options, "host-database");
}

export function prepareHostDatabase({ scratch, repo, service }) {
  const directory = join(realpathSync(scratch), "host-database");
  mkdirSync(directory);
  return hostDatabaseDirectory({ scratch, repo, service, directory });
}

export function senderFlags({ service, hostDatabase }) {
  const flags = ["--permission", "--allow-net", `--allow-fs-read=${service}`];
  if (hostDatabase !== undefined) {
    flags.push(`--allow-fs-read=${hostDatabase}`, `--allow-fs-write=${hostDatabase}`);
  }
  return flags;
}

export function ingressFlags({ service, storage }) {
  return [...senderFlags({ service }), `--allow-fs-read=${storage}`, `--allow-fs-write=${storage}`];
}

export function roleFlags({ role, service, storage, hostDatabase }) {
  if (role === "sender") return senderFlags({ service, hostDatabase });
  assert.equal(role, "ingress", `unknown role: ${role}`);
  return ingressFlags({ service, storage });
}
