// Text/Git and offline fixtures only. Never import an execution entrypoint.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertRunEvidenceState, assertRunTaskState } from "./p-map-handoff-state.mjs";

const ROOT = fileURLToPath(new URL("../../../../..", import.meta.url));
const CHANGE = "openspec/changes/verify-fraud-evidence-sufficiency/";
const HARNESS = `${CHANGE}harness/`;
const BASE = "0f3e02a7f50aed916ea0fd1e717330f0632db317";
const text = (path) => readFileSync(resolve(ROOT, path), "utf8");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const lines = (bytes) => bytes.toString("utf8").trim().split("\n").filter(Boolean);

for (const hasResult of [false, true]) {
  test(`P-map 5.2 follows result existence in both directions (${hasResult})`, () => {
    const tasks = `- [${hasResult ? "x" : " "}] 5.2 Future approved run\n`;
    assertRunTaskState({ tasks, hasResult });
    assert.throws(() => assertRunTaskState({ tasks, hasResult: !hasResult }), assert.AssertionError);
  });
}

test("P-map handoff ticks only 5.1, retains inherited 4.2 and ties 5.2 to run-5 evidence", () => {
  const tasks = text(`${CHANGE}tasks.md`);
  assert.match(tasks, /^- \[x\] 5\.1 /m);
  assert.match(tasks, /^- \[x\] 4\.2 /m);
  assertRunTaskState({ tasks, hasResult: existsSync(resolve(ROOT, `${HARNESS}results/p-map-run-5.json`)) });
  const before = git("show", `${BASE}:${CHANGE}tasks.md`).toString("utf8");
  // Groups 1-5 are the probes' inherited state; group 6 onward belongs to the close-out tickets (#805+).
  const probeGroups = (value) => value.slice(value.indexOf("## 1. "), value.indexOf("## 6. "));
  const withoutProbeTicks = (value) => probeGroups(value).replace(/^- \[[ x]\] (5\.[12] )/gm, "- [ ] $1");
  assert.equal(withoutProbeTicks(tasks), withoutProbeTicks(before));
});

test("inherited expectations/results stay immutable; only run-5 result and paired ledger row may be added", () => {
  const paths = lines(git("ls-tree", "-r", "--name-only", BASE, "--", `${HARNESS}expectations/`, `${HARNESS}results/`));
  assert(paths.includes(`${HARNESS}results/p-e-run-4.json`));
  for (const path of paths) assert.deepEqual(readFileSync(resolve(ROOT, path)), git("show", `${BASE}:${path}`), path);
  assert(existsSync(resolve(ROOT, `${HARNESS}expectations/p-map.v1.json`)));
  const result = "p-map-run-5.json";
  const inherited = paths.filter((path) => path.startsWith(`${HARNESS}results/`));
  const allowed = new Set([...inherited, `${HARNESS}results/${result}`]);
  for (const name of readdirSync(resolve(ROOT, `${HARNESS}results`))) assert(allowed.has(`${HARNESS}results/${name}`), name);
  assertRunEvidenceState({ baseLedger: git("show", `${BASE}:${HARNESS}run-ledger.md`).toString("utf8"),
    ledger: text(`${HARNESS}run-ledger.md`), hasResult: existsSync(resolve(ROOT, `${HARNESS}results/${result}`)) });
});

test("the seven planning owned_paths remain exact at the pinned reachable base", () => {
  const path = `${CHANGE}assessment.source.json`;
  const owned = JSON.parse(text(path)).owned_paths;
  assert.equal(owned.length, 7);
  assert.deepEqual(owned, JSON.parse(git("show", `${BASE}:${path}`).toString("utf8")).owned_paths);
});

test("every frozen numeric citation names an existing inclusive range at the pinned base", () => {
  const plan = text(`${HARNESS}expectations/p-map.v1.json`);
  const citations = [...plan.matchAll(/"([^"\n]+\.(?:ts|mjs|md|json)):(\d[\d,-]*)"/g)];
  const sizes = new Map(citations.map(([, path]) => [path, 0]));
  for (const path of sizes.keys()) sizes.set(path, git("show", `${BASE}:${path}`).toString("utf8").trimEnd().split("\n").length);
  assert(citations.length > 100, "the complete case and findings basis is checked");
  for (const [, path, ranges] of citations) {
    for (const range of ranges.split(",")) {
      const [first, last = first] = range.split("-").map(Number);
      assert(first >= 1 && first <= last && last <= sizes.get(path), `${path}:${range}`);
    }
  }
});

const DOCUMENTED = ["P-map has not executed", "S1 approval: P-map run <N> for #804 at <HEAD>", "Delegated S1 under G39",
  "--allow-fs-read=<own-service>", "run-a668e11c-1be0-4418-813c-edc3bea8f70c", "1,246", "623 public calls",
  "p-map/run-p-map.mjs", "--approval-sha256", "--once-marker", "--driver-thinking", "no extra write",
  "freeze", "structurally", "#806", "#797"];

test("P-map README documents build history, future approval form, all arguments and observation boundaries", () => {
  const readme = text(`${HARNESS}README.md`).split("## P-map — #804 build-only handoff")[1];
  assert(readme);
  for (const fragment of DOCUMENTED) assert(readme.includes(fragment), fragment);
  assert.doesNotMatch(readme, /^\s*export\s/m);
  assert(readme.includes("expectations hash") && readme.includes("finally"));
  assert(readme.includes("single-core") && readme.includes("full tracked-harness"));
});

function assertPackageFree(path) {
  const source = text(path);
  assert.doesNotMatch(source, /(?:from\s*|import\s*\()["']@bloodtrail\//, path);
  assert.doesNotMatch(source, /(?:^\s*import\s+|\bimport\s*\()[^;\n]*["'][^"'\n]*(?:probe-process|run-p-map)\.mjs["']/m, path);
  assert.doesNotMatch(source, /\b(?:fetch|connect|createServer)\s*\(/, path);
}

test("offline tests/helpers and production modules never import packages or execution entries", () => {
  const modules = readdirSync(resolve(ROOT, `${HARNESS}p-map`)).filter((name) => name.endsWith(".mjs")
    && !["probe-process.mjs", "run-p-map.mjs"].includes(name));
  const tests = readdirSync(resolve(ROOT, `${HARNESS}tests`)).filter((name) => name.startsWith("p-map-") && name.endsWith(".mjs"));
  for (const name of modules) assertPackageFree(`${HARNESS}p-map/${name}`);
  for (const name of tests) assertPackageFree(`${HARNESS}tests/${name}`);
  const entry = text(`${HARNESS}p-map/probe-process.mjs`);
  assert.match(entry, /if \(import\.meta\.main\) await main\(\);/);
  assert(entry.indexOf("@bloodtrail/") > entry.indexOf("export async function main()"));
  assert.match(text(`${HARNESS}p-map/run-p-map.mjs`), /if \(import\.meta\.main\)/);
});
