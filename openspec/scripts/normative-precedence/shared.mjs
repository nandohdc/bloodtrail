import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const POLICY_RELATIVE_PATH = "openspec/governance/normative-source-precedence.json";
export const STAGES = Object.freeze(["candidate", "merge", "fold", "activation", "release"]);

export const REQUIRED_SEMANTIC_DIMENSIONS = Object.freeze([
  "requiredness", "conditional_requiredness", "authority", "trust", "privacy",
  "retention", "delivery", "compatibility", "extension_ownership",
  "interoperability_mapping", "derivation", "validation_rejection",
  "authorization", "integrity", "lifecycle"
]);

export function diagnostic(code, path, message) {
  return { code, path, message };
}

export function unique(values) {
  return new Set(values).size === values.length;
}

export function byCodePoint(left, right) {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

export function walkDirectories(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadPolicy(repoRoot, policyPath = POLICY_RELATIVE_PATH) {
  const absolute = resolve(repoRoot, policyPath);
  const policy = readJson(absolute);
  const schemaPath = resolve(dirname(absolute), policy.$schema);
  return { path: absolute, policy, schemaPath, schema: readJson(schemaPath) };
}

function holdsPointerToken(value, key) {
  if (value === null || typeof value !== "object") return false;
  return key in value;
}

export function getJsonPointer(document, pointer) {
  if (pointer === "") return document;
  if (!pointer.startsWith("/")) throw new Error(`invalid JSON pointer ${pointer}`);
  return pointer.slice(1).split("/").reduce((value, token) => {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!holdsPointerToken(value, key)) {
      throw new Error(`missing JSON pointer ${pointer}`);
    }
    return value[key];
  }, document);
}

export function extractRequirement(markdown, heading) {
  const marker = `### Requirement: ${heading}`;
  const start = markdown.split("\n").findIndex((line) => line.trimEnd() === marker);
  if (start < 0) return null;
  const lines = markdown.split("\n");
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("### Requirement: ")) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

export function gitObject(repoRoot, path) {
  const result = spawnSync("git", ["hash-object", "--", path], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function gitStdout(repoRoot, args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function isAncestorCommit(repoRoot, ancestor, descendant) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: repoRoot }).status === 0;
}

export function gitPathsBetween(repoRoot, from, to) {
  const result = spawnSync("git", ["diff", "--name-only", `${from}...${to}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.split("\n").filter(Boolean) : null;
}

export function gitObjectAt(repoRoot, commit, path) {
  return gitStdout(repoRoot, ["rev-parse", `${commit}:${path}`]);
}

export function introducingCommit(repoRoot, path) {
  const current = gitObjectAt(repoRoot, "HEAD", path);
  const commit = current ? gitStdout(repoRoot, ["log", "-1", "--format=%H", "HEAD", "--", path]) : null;
  return commit && gitObjectAt(repoRoot, commit, path) === current ? commit : null;
}

export function formatDiagnostics(result) {
  return result.map((entry) => `${entry.code} ${entry.path}: ${entry.message}`).join("\n");
}

export function assertRegularFile(path) {
  return existsSync(path) && statSync(path).isFile();
}
