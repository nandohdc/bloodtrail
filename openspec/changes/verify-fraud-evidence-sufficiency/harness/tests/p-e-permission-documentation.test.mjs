// Offline documentation/data checks only; no SQLite escape experiment or SDK import.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateExpectations } from "../p-e/expectations-validate.mjs";

const PLAN = JSON.parse(readFileSync(new URL("../expectations/p-e.v1.json", import.meta.url), "utf8"));
const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const SECTIONS = [
  "## P-E database scratch permission planning (#803 build only)",
  "### Frozen P-E plan",
  "### Future P-E execution, only after exact-head S1",
];
const REVIEW_FACTS = [
  "Node 26.12.0", "node:sqlite wrote outside --allow-fs-write",
  "new DatabaseSync", "fs.writeFileSync", "ERR_ACCESS_DENIED",
  "grant confines only the harness's fs reserve (openSync 'wx') and unlink",
  "database placement rests on p-e/host.mjs path checks before DatabaseSync construction",
  "Network denial is unaffected (no --allow-net)", "neither SDK package imports node:sqlite",
];

function section(heading) {
  assert(README.includes(heading), `missing section: ${heading}`);
  return README.split(heading)[1].split(/^#{2,3} /m)[0].replace(/\s+/g, " ");
}

for (const heading of SECTIONS) {
  test(`${heading}: fs grants are not SQLite confinement`, () => {
    const text = section(heading);
    assert.match(text, /confines only the harness's `fs`/);
    assert.match(text, /`node:sqlite` file access is not enforced by the (?:Node 26\.12\.0 )?permission model/);
    assert.match(text, /database placement rests on `p-e\/host\.mjs` path checks/);
  });
}

test("the frozen plan appends exactly one sourced database-placement review note and still validates", () => {
  const notes = PLAN.notes.filter((entry) => entry.source === "orchestrator review of bcac37c");
  assert.equal(notes.length, 1);
  for (const fact of REVIEW_FACTS) assert(notes[0].note.includes(fact), `missing review fact: ${fact}`);
  assert.equal(validateExpectations(PLAN), PLAN);
});

test("permission documentation retains planned flags and denies network without claiming SQLite confinement", () => {
  const planning = section(SECTIONS[0]);
  assert(planning.includes("`--permission`, `--allow-fs-read=<own-service>`, `--allow-fs-write=<database-directory>`"));
  assert(planning.includes("No network, child-process or native-addon grant is added."));
  const frozen = section(SECTIONS[1]);
  assert(frozen.includes("no network, child-process, native-addon or database-read grant is added."));
  assert(frozen.includes("Neither SDK package imports `node:sqlite`."));
  assert(section(SECTIONS[2]).includes("There is no probe network or child-spawn permission."));
  assert(!README.includes("filesystem-write beyond the declared"));
});

test("the frozen P-E README flags exactly match the plan without a stray terminator", () => {
  const flags = [...section(SECTIONS[1]).matchAll(/`(--[^`]+)`/g)].map((match) => match[1]);
  assert.deepEqual(flags, PLAN.database_handling.permission_flags);
});

test("the P-E expectation digest remains a run-start observation, not a frozen documentation pin", () => {
  assert(README.includes("Its SHA-256 is recorded in the results at run start, never before."));
});
