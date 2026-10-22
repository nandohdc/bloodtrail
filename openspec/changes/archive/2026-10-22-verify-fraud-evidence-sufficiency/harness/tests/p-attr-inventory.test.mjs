// Build-only inventory/ownership and immutable-evidence tests (US-009).
// Fixture-only: reads repository files; no kit/SDK import, probe execution or network.
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { PROBE_FILES } from "../p-attr/roles.mjs";
import { filesBelow, sha256 } from "../lib/io.mjs";

const HARNESS = fileURLToPath(new URL("..", import.meta.url));
const CHANGE = fileURLToPath(new URL("../..", import.meta.url));

const PLANNING_ENTRIES = [
  "openspec/changes/verify-fraud-evidence-sufficiency/.openspec.yaml",
  "openspec/changes/verify-fraud-evidence-sufficiency/proposal.md",
  "openspec/changes/verify-fraud-evidence-sufficiency/design.md",
  "openspec/changes/verify-fraud-evidence-sufficiency/tasks.md",
  "openspec/changes/verify-fraud-evidence-sufficiency/specs/fraud-evidence-profile/spec.md",
  "openspec/changes/verify-fraud-evidence-sufficiency/assessment.source.json",
  "openspec/changes/verify-fraud-evidence-sufficiency/assessment.json",
];

const HISTORICAL_DIGESTS = [
  ["expectations/p-ids.v1.json", "77955d57d317c9f0a6b9c81dd727974f9eb87ee70c730d83bd685e6cd6144251"],
  ["expectations/p-d.v1.json", "4c956f0fc52a684fed2f7747eb42be621aecd84284d4762720d5b65b648bb384"],
  ["results/p-ids-run-1.json", "71d2b88ff59fe2b42ff75a6595cdc23dda16d2a2ade67d2140310a921a1db29c"],
  ["results/p-d-run-2.json", "1e866fad2d60f3b30f11572003daee4b670790222975a0b75839c6398259fe39"],
];

const HISTORICAL_ROWS = [
  "| 1 | P-ids | #800 | ec192a5977e079089cb76b3595631dcb7d62aca3 | https://github.com/nandohdc/bloodtrail/issues/800#issuecomment-6228450746 | 988e6a8a26696a3b4e9f48450b873d94855902e1c8c6343136a0c24fc5c33e0c | 1393 | completed |",
  "| 2 | P-D | #801 | 09847df832a0691152db290920c151152780ac33 | https://github.com/nandohdc/bloodtrail/issues/801#issuecomment-6231926171 | b13e97b32055f4c1c7ca3a189767900368c02fde3b6d7ceb8c6d50de9beca93f | 371 | completed, delegated (G39) |",
];

function moduleSet(root) {
  const prefix = posix.relative(HARNESS, root);
  return filesBelow(root)
    .filter((path) => path.endsWith(".mjs"))
    .map((path) => posix.join(prefix, posix.relative(root, path)));
}

function digestOf(rel) {
  return sha256(readFileSync(join(HARNESS, rel), "utf8"));
}

test("explicit inventory covers every p-attr/ module and declares unique existing files", () => {
  const declared = new Set(PROBE_FILES);
  assert.equal(declared.size, PROBE_FILES.length, "PROBE_FILES entries must be unique");
  for (const rel of moduleSet(join(HARNESS, "p-attr"))) {
    assert(declared.has(rel), `${rel} must be in PROBE_FILES`);
  }
  for (const rel of PROBE_FILES) {
    assert(statSync(join(HARNESS, rel)).isFile(), `${rel} must exist`);
  }
});

test("owned_paths are exactly the seven planning entries; the directory grant owns the rest", () => {
  const source = JSON.parse(readFileSync(join(CHANGE, "assessment.source.json"), "utf8"));
  assert.deepEqual(source.owned_paths, PLANNING_ENTRIES);
  assert(source.owned_paths.length <= 60, "owned_paths exceeds the 60-entry cap");
  for (const path of source.owned_paths) {
    assert(path.startsWith("openspec/changes/verify-fraud-evidence-sufficiency/"), `${path} is outside the change directory`);
  }
  const generated = JSON.parse(readFileSync(join(CHANGE, "assessment.json"), "utf8"));
  assert.deepEqual(generated.owned_paths, PLANNING_ENTRIES, "assessment.json must match the source ownership");
  const scope = source.invariant_evidence["implementation-proposal-only-scope"];
  for (const id of ["3.1", "8.1"]) assert(scope.task_ids.includes(id), `scope must include task ${id}`);
  assert(scope.evidence_ids.some((id) => /P-attr/.test(id)));
  assert.equal(source.assessment_level, "full");
  assert.equal(source.security_sensitive, true);
});

for (const [rel, expected] of HISTORICAL_DIGESTS) {
  test(`historical evidence ${rel} is byte-identical`, () => {
    assert.equal(digestOf(rel), expected);
  });
}

test("historical ledger rows remain verbatim while later runs may be appended", () => {
  const lines = readFileSync(join(HARNESS, "run-ledger.md"), "utf8").split("\n");
  for (const row of HISTORICAL_ROWS) assert(lines.includes(row), `ledger must retain ${row}`);
});

test("frozen P-attr expectation hash pins the reviewed carrier targets", () => {
  assert.equal(digestOf("expectations/p-attr.v1.json"),
    "2954363d03a7e321c0ca379963eb554deedc3a6489b71b4432b5166749777887");
});

function assertRunTaskState({ tasks, hasResult }) {
  assert.match(tasks, hasResult ? /^- \[x\] 3\.2 /m : /^- \[ \] 3\.2 /m);
}

for (const hasResult of [false, true]) {
  test(`task 3.2 state follows result existence (${hasResult})`, () => {
    const tasks = `- [${hasResult ? "x" : " "}] 3.2 Run the approved probe\n`;
    assertRunTaskState({ tasks, hasResult });
    assert.throws(() => assertRunTaskState({ tasks, hasResult: !hasResult }), assert.AssertionError);
  });
}

test("tasks.md retains completed planning tasks and tracks Run 3 evidence", () => {
  const tasks = readFileSync(join(CHANGE, "tasks.md"), "utf8");
  const ticked = [...tasks.matchAll(/^- \[x\] (\d\.\d) /gm)].map((match) => match[1]);
  for (const id of ["1.1", "1.2", "2.1", "2.2", "3.1"]) {
    assert(ticked.includes(id), `task ${id} must remain ticked`);
  }
  assertRunTaskState({ tasks, hasResult: existsSync(join(HARNESS, "results/p-attr-run-3.json")) });
});
