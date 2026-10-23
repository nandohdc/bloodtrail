// Node permission-model grants for the two Stage 2 probe processes.
//
// - sender: network (loopback, enforced by the loopback guard) and read access to the own service only.
// - ingress: the same, plus read and write access to one collector-storage directory inside scratch.
// Neither process may spawn children. The orchestrator itself runs without the permission model.
import assert from "node:assert/strict";
import { mkdirSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { inside } from "./io.mjs";

function disjoint(left, right) {
  assert(left !== right, "storage scope overlaps a protected tree");
  assert(!left.startsWith(right + sep), "storage scope overlaps a protected tree");
  assert(!right.startsWith(left + sep), "storage scope overlaps a protected tree");
}

export function storageDirectory({ scratch, repo, service, directory }) {
  const real = realpathSync(directory);
  assert(statSync(real).isDirectory(), "storage path must be a directory");
  const root = realpathSync(scratch);
  disjoint(root, realpathSync(repo));
  inside({ root, path: real });
  inside({ root, path: realpathSync(service) });
  disjoint(real, realpathSync(service));
  return real;
}

export function prepareStorage({ scratch, repo, service }) {
  const directory = join(realpathSync(scratch), "collector-storage");
  mkdirSync(directory);
  return storageDirectory({ scratch, repo, service, directory });
}

export function senderFlags({ service }) {
  return ["--permission", "--allow-net", `--allow-fs-read=${service}`];
}

export function ingressFlags({ service, storage }) {
  return [...senderFlags({ service }), `--allow-fs-read=${storage}`, `--allow-fs-write=${storage}`];
}

export function roleFlags({ role, service, storage }) {
  if (role === "sender") return senderFlags({ service });
  assert.equal(role, "ingress", `unknown role: ${role}`);
  return ingressFlags({ service, storage });
}
