// Static import-graph closure over declared probe inventories. The walker
// reads ONLY the declared files (no parent repository traversal) and follows
// every relative module edge: static imports, re-exports, side-effect imports
// and literal dynamic imports. Package specifiers are never walked; they are
// resolved only when a probe process actually runs, inside its
// direct-execution-only main. A module missing from PROBE_FILES otherwise
// fails with ERR_MODULE_NOT_FOUND only after claimOnce, which spends the
// approved run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";

const RELATIVE_EDGES = [
  /(?:\bfrom\s*|import\s*\(\s*)["'](\.[^"']*)["']/g,
  /^\s*import\s*["'](\.[^"']*)["']/gm,
];

export function importEdges(source) {
  const edges = new Set();
  for (const pattern of RELATIVE_EDGES) {
    for (const match of source.matchAll(pattern)) edges.add(match[1]);
  }
  return edges;
}

export function importClosure({ entry, files }) {
  assert(typeof entry === "string" && entry.length > 0, "closure entry is required");
  const seen = new Set();
  const missing = [];
  const escaping = [];
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    const source = files.get(path);
    if (source === undefined) {
      missing.push(path);
      return;
    }
    const directory = posix.dirname(path);
    for (const specifier of importEdges(source)) {
      const target = posix.normalize(posix.join(directory, specifier));
      if (target === ".." || target.startsWith("../")) escaping.push({ from: path, specifier });
      else visit(target);
    }
  };
  visit(entry);
  return { closure: [...seen].sort(), missing, escaping };
}

// Pre-run inventory validation shared by runProbe and the build fixtures: the
// transitive relative closure of a probe's probe-process.mjs must be a subset
// of its declared PROBE_FILES, every imported lib/ module included, and no
// edge may escape the harness root. Reading stops at the declared files.
export function validateProbeInventory({ repo, prefix, probeDirectory, files }) {
  const sources = new Map();
  for (const path of files) {
    assert(!path.includes("\\") && posix.normalize(path) === path, `declared inventory path must be posix: ${path}`);
    sources.set(path, readFileSync(join(repo, prefix, path), "utf8"));
  }
  const entry = `${probeDirectory}/probe-process.mjs`;
  const { closure, missing, escaping } = importClosure({ entry, files: sources });
  assert.equal(missing.length, 0, `probe import closure missing from approved inventory: ${missing.join(", ")}`);
  assert.equal(escaping.length, 0, "probe import closure escapes the harness root: "
    + escaping.map((row) => `${row.from} -> ${row.specifier}`).join(", "));
  return closure;
}
