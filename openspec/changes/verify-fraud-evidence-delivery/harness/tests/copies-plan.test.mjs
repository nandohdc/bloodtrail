import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { command, jsonFile } from "../lib/io.mjs";
import { validateProbeInventory } from "../lib/import-closure.mjs";
import { ROLE_SCRIPTS } from "../lib/plan.mjs";
import { CHANGE } from "../lib/results.mjs";
import { validateExpectations } from "../copies/expectations.mjs";
import { PROBE_FILES } from "../copies/files.mjs";

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = command({ program: "git", args: ["rev-parse", "--show-toplevel"], cwd: HARNESS }).trim();
const FROZEN = jsonFile(new URL("../expectations/copies.v1.json", import.meta.url));
const source = (path) => readFileSync(join(HARNESS, path), "utf8");

test("the frozen expectations validate, and mutating them is refused", () => {
  assert.equal(validateExpectations(structuredClone(FROZEN)).probe, "S2-copies");
  const mutations = [
    (value) => { value.contract_version = "2.0.0"; },
    (value) => { value.cases.pop(); },
    (value) => { value.cases[0].basis = []; },
    (value) => { value.cases[2].case_id = "C-99"; },
    (value) => { value.planned_call_budget = { processes: { identities: 1 }, total: 1 }; },
    (value) => { value.composition.max_attempts = 0; },
    (value) => { value.workload.seed = 0; },
    (value) => { value.clock.step_ms = 0; },
    (value) => { value.composition.capacity = 100_001; },
    (value) => { value.composition.max_attempts = 1001; },
    (value) => { value.composition.exchange_timeout_ms = 60_001; },
    (value) => { value.composition.max_delay_ms = value.composition.base_delay_ms - 1; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(FROZEN);
    mutate(value);
    assert.throws(() => validateExpectations(value), undefined, mutate.toString());
  }
});

test("every basis citation names an existing line of package source at the frozen base", () => {
  for (const entry of FROZEN.cases) {
    for (const citation of entry.basis) {
      const [path, line] = citation.split(":");
      const text = command({ program: "git", args: ["show", `${FROZEN.base}:${path}`], cwd: REPO });
      const lines = text.split("\n");
      assert(Number(line) >= 1 && Number(line) <= lines.length, `${entry.case_id}: ${citation} is past the end of the file`);
      assert(lines[Number(line) - 1].trim().length > 0, `${entry.case_id}: ${citation} cites a blank line`);
    }
  }
});

test("each role's import closure is inside the declared inventory, and a missing module is caught", () => {
  const roleScripts = Object.values(ROLE_SCRIPTS);
  const closure = validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "copies", files: PROBE_FILES, roleScripts });
  assert.deepEqual(closure, [...PROBE_FILES].sort(), "the inventory declares exactly the closure");
  const withoutIo = PROBE_FILES.filter((path) => path !== "lib/io.mjs");
  assert.throws(() => validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "copies", files: withoutIo, roleScripts }), /missing from approved inventory: .*lib\/io\.mjs/);
});

test("kit packages are imported only by the role processes, each only its own", () => {
  const kitImports = (path) => [...source(path).matchAll(/from "(@bloodtrail\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(kitImports("copies/sender-process.mjs"), ["@bloodtrail/security-audit-sdk-core", "@bloodtrail/security-audit-sdk-node"]);
  assert.deepEqual(kitImports("copies/ingress-process.mjs"), ["@bloodtrail/security-audit-collector"]);
  const orchestration = ["copies/run-copies.mjs", "copies/session.mjs", "copies/evaluate.mjs", "copies/expectations.mjs", "copies/workload.mjs", "copies/controls.mjs"];
  for (const path of orchestration) assert.deepEqual(kitImports(path), [], `${path} must not import kit code`);
});

test("each role imports the role guard first, so it is installed before any kit module evaluates", () => {
  for (const script of Object.values(ROLE_SCRIPTS)) {
    const [first] = source(`copies/${script}`).match(/^import .*$/m);
    assert.match(first, /from "\.\.\/lib\/role-guard\.mjs";$/, script);
  }
});

test("the approval-gated entry only delegates to the shared runner", () => {
  const entry = source("copies/run-copies.mjs");
  assert(entry.includes('import { runProbe } from "../lib/probe-runner.mjs";'));
  assert(entry.includes("const session = await runProbe({"));
  assert(entry.includes("process.exitCode = session.exitCode;"));
  assert(!entry.includes("runApprovedSession"));
});
