// Import-only permission sandboxes for every probe entrypoint (US-012).
// Each fixture copies EXACTLY the declared inventory under temporary scratch
// and imports probe-process.mjs (never workload.mjs) in a Node --permission
// child with fs-read ONLY for the copied tree. No kit package is present, no
// main runs, nothing is measured, and no result/ledger/database evidence may
// be created. Negative fixtures drop one closure module: import fails, and
// the pre-run inventory validation rejects the plan before any launch.
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { command } from "../lib/io.mjs";
import { importClosure } from "../lib/import-closure.mjs";
import { PROBE_FILES as P_IDS_FILES } from "../p-ids/roles.mjs";
import { PROBE_FILES as P_D_FILES } from "../p-d/roles.mjs";
import { PROBE_FILES as P_ATTR_FILES } from "../p-attr/roles.mjs";
import { PROBE_FILES as P_E_FILES } from "../p-e/roles.mjs";

const PROBES = [["p-ids", P_IDS_FILES], ["p-d", P_D_FILES], ["p-attr", P_ATTR_FILES], ["p-e", P_E_FILES]];

const IMPORT_CHILD = `
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const target = pathToFileURL(join(process.cwd(), "harness", process.argv[2], "probe-process.mjs")).href;
const module = await import(target);
process.stdout.write(JSON.stringify({ exported_main: typeof module.main === "function" }) + "\\n");
`;

function copyInventory({ service, files }) {
  for (const rel of files) {
    const target = join(service, "harness", rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(new URL(`../${rel}`, import.meta.url)));
  }
}

function treeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else files.push(relative(root, path));
    }
  };
  visit(root);
  return files.sort();
}

function closureOf(probe, files) {
  const sources = new Map(files.map((rel) => [rel, readFileSync(new URL(`../${rel}`, import.meta.url), "utf8")]));
  return importClosure({ entry: `${probe}/probe-process.mjs`, files: sources });
}

function withSandbox(fn) {
  const service = mkdtempSync(join(realpathSync(tmpdir()), "probe-import-sandbox-"));
  try {
    return fn(service);
  } finally {
    rmSync(service, { recursive: true, force: true });
  }
}

for (const [probe, files] of PROBES) {
  test(`${probe} probe-process imports under --permission with only copied-tree fs-read; no kit, no main, no evidence`, () => {
    withSandbox((service) => {
      copyInventory({ service, files });
      assert.equal(existsSync(join(service, "node_modules")), false, "no kit packages may be present");
      const child = join(service, "import-child.mjs");
      writeFileSync(child, IMPORT_CHILD);
      const before = treeFiles(service);
      const output = command({ program: process.execPath,
        args: ["--permission", `--allow-fs-read=${service}`, "import-child.mjs", probe], cwd: service });
      assert.deepEqual(JSON.parse(output), { exported_main: true }, "import must expose main without running it");
      assert.deepEqual(treeFiles(service), before, "import must create no result, ledger or database evidence");
    });
  });
}

for (const [probe, files] of PROBES) {
  test(`${probe} missing closure module breaks the permission sandbox exactly as pre-run validation predicts`, () => {
    withSandbox((service) => {
      const walked = closureOf(probe, files);
      const victim = walked.closure.find((path) => path.startsWith("lib/"));
      assert(victim, `${probe} closure must contain a lib module`);
      const reduced = files.filter((path) => path !== victim);
      copyInventory({ service, files: reduced });
      const child = join(service, "import-child.mjs");
      writeFileSync(child, IMPORT_CHILD);
      assert.throws(() => command({ program: process.execPath,
        args: ["--permission", `--allow-fs-read=${service}`, "import-child.mjs", probe], cwd: service }),
      /Cannot find module|ERR_MODULE_NOT_FOUND/);
    });
  });
}

test("a module missing from a declared inventory is rejected by validateProbeInventory before any spawn", () => {
  const walked = closureOf("p-e", P_E_FILES);
  const victim = walked.closure.find((path) => path !== "p-e/probe-process.mjs" && !path.startsWith("lib/"));
  assert(victim, "p-e closure must contain a probe module beyond the entry");
  const sources = new Map(P_E_FILES.filter((path) => path !== victim)
    .map((rel) => [rel, readFileSync(new URL(`../${rel}`, import.meta.url), "utf8")]));
  const reported = importClosure({ entry: "p-e/probe-process.mjs", files: sources });
  assert(reported.missing.includes(victim));
});
