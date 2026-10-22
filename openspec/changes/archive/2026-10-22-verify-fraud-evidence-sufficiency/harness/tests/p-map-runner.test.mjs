import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { importClosure, validateProbeInventory } from "../lib/import-closure.mjs";
import { permissionFlags } from "../lib/database-permissions.mjs";
import { CHANGE } from "../lib/results.mjs";
import { PROBE_FILES, ROLES, validateExpectations } from "../p-map/roles.mjs";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { capturedPlan } from "./p-map-runner-fixtures.mjs";

const ROOT = `${CHANGE}/harness`;
const sources = () => new Map(PROBE_FILES.map((path) => [path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8")]));

test("P-map injected adapter wires strict evaluation, #804 identity, retained observations and one role with no extra grant", async () => {
  const { plan, result } = await capturedPlan();
  assert.deepEqual(result, { exitCode: 0 });
  assert.deepEqual(Object.keys(plan).sort(), ["entrypoint", "evaluate", "files", "probe", "probeDirectory", "retainProcesses", "roles", "ticket", "validate"].sort());
  assert.deepEqual([plan.probe, plan.ticket, plan.probeDirectory, plan.entrypoint], ["P-map", 804, "p-map", "fixture-entry"]);
  assert.equal(plan.retainProcesses, true);
  assert.equal(plan.validate, validateExpectations);
  assert.equal(plan.evaluate, evaluateProbe);
  assert.equal(plan.files, PROBE_FILES);
  assert.equal(plan.roles, ROLES);
  assert.deepEqual(ROLES, [{ role: "sequential" }]);
  assert.deepEqual(permissionFlags({ service: "/fixture/own-service" }), ["--permission", "--allow-fs-read=/fixture/own-service"]);
});

test("P-map complete explicit unique inventory closes child, runner and evaluator imports without executing entries", () => {
  const files = sources();
  assert.equal(files.size, PROBE_FILES.length);
  const actual = readdirSync(new URL("../p-map/", import.meta.url)).filter((file) => file.endsWith(".mjs"));
  assert.deepEqual(PROBE_FILES.filter((path) => path.startsWith("p-map/")).sort(), actual.map((file) => `p-map/${file}`).sort());
  const closure = new Set();
  for (const entry of ["p-map/probe-process.mjs", "p-map/run-p-map.mjs", "p-map/roles.mjs", "p-map/evaluate.mjs"]) {
    const walked = importClosure({ entry, files });
    assert.deepEqual(walked.missing, [], entry);
    assert.deepEqual(walked.escaping, [], entry);
    walked.closure.forEach((path) => closure.add(path));
  }
  assert.deepEqual([...closure].sort(), [...PROBE_FILES].sort(), "inventory is exactly the transitive closure");
  assert(validateProbeInventory({ repo: process.cwd(), prefix: ROOT, probeDirectory: "p-map", files: PROBE_FILES }).length > 30);
});

test("every missing transitive child file is refused by shared inventory preflight, not discovered by launching", () => {
  const files = sources();
  const closure = importClosure({ entry: "p-map/probe-process.mjs", files }).closure;
  for (const victim of closure) {
    assert.throws(() => validateProbeInventory({ repo: process.cwd(), prefix: ROOT, probeDirectory: "p-map",
      files: PROBE_FILES.filter((path) => path !== victim) }), /probe import closure missing/, victim);
  }
});

test("P-map production entries guard every package import and perform no top-level work except safe relative imports", () => {
  const files = sources();
  const child = files.get("p-map/probe-process.mjs");
  const main = child.indexOf("export async function main()");
  assert(main > 0);
  assert.match(child, /if \(import\.meta\.main\) await main\(\);/);
  const sdkImports = [...child.matchAll(/await import\("@bloodtrail\//g)];
  assert.equal(sdkImports.length, 3);
  assert(sdkImports.every((match) => match.index > main));
  assert.match(files.get("p-map/run-p-map.mjs"), /if \(import\.meta\.main\) \{/);
  assert(!child.includes("database-directory"));
  const shared = files.get("lib/probe-runner.mjs");
  assert(shared.indexOf("plan.validate(") < shared.indexOf("return approvedSession("));
  assert(shared.indexOf("validateProbeInventory({") < shared.indexOf("return approvedSession("));
});
