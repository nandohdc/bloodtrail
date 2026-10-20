// Global probe import-closure fixtures (US-012, #802 review item 1).
// Fixture-only: reads declared inventory files; no kit/SDK import, no probe
// execution, no network, and no child process.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importClosure, importEdges, validateProbeInventory } from "../lib/import-closure.mjs";
import { PROBE_FILES as P_IDS_FILES } from "../p-ids/roles.mjs";
import { PROBE_FILES as P_D_FILES } from "../p-d/roles.mjs";
import { PROBE_FILES as P_ATTR_FILES } from "../p-attr/roles.mjs";
import { PROBE_FILES as P_E_FILES } from "../p-e/roles.mjs";

const PROBES = [["p-ids", P_IDS_FILES], ["p-d", P_D_FILES], ["p-attr", P_ATTR_FILES], ["p-e", P_E_FILES]];

function sourcesFor(files) {
  return new Map(files.map((rel) => [rel, readFileSync(new URL(`../${rel}`, import.meta.url), "utf8")]));
}

test("importEdges follows static imports, re-exports, side-effect imports and literal dynamic imports; never packages", () => {
  const source = [
    'import { a } from "./a.mjs";',
    'export { b } from "./b.mjs";',
    'import "./c.mjs";',
    'const late = await import("./d.mjs");',
    'import { pkg } from "@bloodtrail/security-audit-sdk-core";',
    'import { builtin } from "node:fs";',
  ].join("\n");
  assert.deepEqual([...importEdges(source)].sort(), ["./a.mjs", "./b.mjs", "./c.mjs", "./d.mjs"]);
});

test("importClosure walks transitive relative edges and reports the reachable set", () => {
  const files = new Map([
    ["p-x/probe-process.mjs", 'import { a } from "./a.mjs";'],
    ["p-x/a.mjs", 'import { b } from "./b.mjs";\nimport { shared } from "../lib/shared.mjs";'],
    ["p-x/b.mjs", ""],
    ["lib/shared.mjs", ""],
  ]);
  const walked = importClosure({ entry: "p-x/probe-process.mjs", files });
  assert.deepEqual(walked.closure, ["lib/shared.mjs", "p-x/a.mjs", "p-x/b.mjs", "p-x/probe-process.mjs"]);
  assert.deepEqual(walked.missing, []);
  assert.deepEqual(walked.escaping, []);
});

test("importClosure rejects edges that escape the harness root", () => {
  const files = new Map([
    ["p-x/probe-process.mjs", 'import { a } from "./a.mjs";'],
    ["p-x/a.mjs", 'import { y } from "../../escape.mjs";'],
  ]);
  const walked = importClosure({ entry: "p-x/probe-process.mjs", files });
  assert.deepEqual(walked.missing, []);
  assert.deepEqual(walked.escaping, [{ from: "p-x/a.mjs", specifier: "../../escape.mjs" }]);
});

for (const [probe, files] of PROBES) {
  test(`${probe} transitive relative import closure is a subset of PROBE_FILES, every imported lib/ module included`, () => {
    const declared = new Set(files);
    assert.equal(declared.size, files.length, "PROBE_FILES entries must be unique");
    const walked = importClosure({ entry: `${probe}/probe-process.mjs`, files: sourcesFor(files) });
    assert.deepEqual(walked.missing, [], "every reached module must be declared");
    assert.deepEqual(walked.escaping, [], "no edge may escape the harness root");
    assert(walked.closure.includes(`${probe}/probe-process.mjs`), "the entry must be declared");
    for (const path of walked.closure) {
      assert(declared.has(path), `${path} reached by ${probe}/probe-process.mjs but absent from PROBE_FILES`);
    }
    const libClosure = walked.closure.filter((path) => path.startsWith("lib/"));
    assert(libClosure.length > 0, `${probe} must import at least one lib/ module`);
    for (const path of libClosure) assert(declared.has(path), `imported lib module ${path} must be declared`);
  });
}

for (const [probe, files] of PROBES) {
  test(`${probe} missing-dependency inventory fails pre-run validation before any launch`, () => {
    const walked = importClosure({ entry: `${probe}/probe-process.mjs`, files: sourcesFor(files) });
    const victim = walked.closure.find((path) => path.startsWith("lib/") && path.endsWith(".mjs"));
    assert(victim, `${probe} closure must contain a lib module`);
    const reduced = files.filter((path) => path !== victim);
    const sources = sourcesFor(reduced);
    const reported = importClosure({ entry: `${probe}/probe-process.mjs`, files: sources });
    assert(reported.missing.includes(victim), `${victim} must be reported missing`);
    assert.throws(() => validateProbeInventory({ repo: fileURLToPath(new URL("..", import.meta.url)),
      prefix: "", probeDirectory: probe, files: reduced }),
    new RegExp(`probe import closure missing from approved inventory: .*${victim}`));
  });
}

test("validateProbeInventory refuses non-posix declared paths", () => {
  assert.throws(() => validateProbeInventory({ repo: ".", prefix: "", probeDirectory: "p-x",
    files: ["p-x\\probe-process.mjs"] }), /declared inventory path must be posix/);
});

test("validateProbeInventory returns the sorted closure for a valid on-disk inventory", () => {
  const root = mkdtempSync(join(tmpdir(), "inventory-valid-"));
  try {
    const files = { "p-x/probe-process.mjs": 'import { a } from "./a.mjs";', "p-x/a.mjs": "" };
    for (const [rel, source] of Object.entries(files)) {
      const target = join(root, rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, source);
    }
    assert.deepEqual(validateProbeInventory({ repo: root, prefix: "", probeDirectory: "p-x", files: Object.keys(files) }),
      ["p-x/a.mjs", "p-x/probe-process.mjs"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
