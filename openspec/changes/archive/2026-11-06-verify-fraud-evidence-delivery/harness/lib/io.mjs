import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// Every child command is bounded, so a stalled build, install or git call after the claim ends as an
// invalidation with results written, instead of a hang that spends the run and records nothing.
export const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

export function command({ program, args, cwd, encoding = "utf8", env, timeout = COMMAND_TIMEOUT_MS }) {
  return execFileSync(program, args, { cwd, encoding, env, maxBuffer: 32 * 1024 * 1024, timeout, killSignal: "SIGKILL" });
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
