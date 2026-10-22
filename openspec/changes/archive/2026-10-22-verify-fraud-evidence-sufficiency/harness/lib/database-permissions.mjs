import assert from "node:assert/strict";
import { mkdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, sep } from "node:path";
import { inside } from "./io.mjs";

function disjoint(left, right) {
  assert(left !== right, "database scope overlaps protected tree");
  assert(!left.startsWith(right + sep), "database scope overlaps protected tree");
  assert(!right.startsWith(left + sep), "database scope overlaps protected tree");
}

export function databaseDirectory({ scratch, repo, service, directory }) {
  assert.equal(typeof directory, "string", "exactly one database directory is required");
  assert(isAbsolute(directory), "database directory must be absolute");
  assert(!directory.split(sep).includes(".."), "database directory traversal refused");
  const real = realpathSync(directory);
  assert(statSync(real).isDirectory(), "database path must be a directory");
  const root = realpathSync(scratch);
  disjoint(root, realpathSync(repo));
  inside({ root, path: realpathSync(service) });
  inside({ root, path: real });
  disjoint(real, realpathSync(repo));
  disjoint(real, realpathSync(service));
  return real;
}

export function permissionFlags({ service, database }) {
  const flags = ["--permission", `--allow-fs-read=${service}`];
  if (database === undefined) return flags;
  assert.equal(realpathSync(service), realpathSync(database.service), "database service differs");
  // Only the harness's fs openSync(..., "wx") reserve and unlinkSync need
  // this write grant. Node 26's permission model does not enforce node:sqlite
  // file access; database placement rests on p-e/host.mjs path checks.
  flags.push(`--allow-fs-write=${databaseDirectory(database)}`);
  return flags;
}

export function preparePermissions({ databaseScratch = false, scratch, repo, service }) {
  assert.equal(typeof databaseScratch, "boolean", "databaseScratch must be a boolean opt-in");
  if (!databaseScratch) return { flags: permissionFlags({ service }) };
  const root = realpathSync(scratch);
  disjoint(root, realpathSync(repo));
  inside({ root, path: realpathSync(service) });
  // Plan/proposal: one harness-local database in scratch, never Bloodtrail storage.
  const directory = join(root, "host-database");
  mkdirSync(directory, { recursive: true });
  const database = { scratch: root, repo, service, directory };
  database.directory = databaseDirectory(database);
  return { flags: permissionFlags({ service, database }), database };
}

export function databaseArguments(database) {
  if (database === undefined) return [];
  return ["--database-directory", databaseDirectory(database)];
}
