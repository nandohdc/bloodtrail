import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function command({ program, args, cwd, encoding = "utf8", env }) {
  return execFileSync(program, args, { cwd, encoding, env, maxBuffer: 32 * 1024 * 1024 });
}

export function jsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function filesBelow(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    assert(!lstatSync(path).isSymbolicLink(), `symlink refused: ${path}`);
    return lstatSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

export function inside({ root, path }) {
  const rel = relative(root, path);
  assert(rel !== "" && !rel.startsWith("..") && !isAbsolute(rel), `path outside service: ${path}`);
}
