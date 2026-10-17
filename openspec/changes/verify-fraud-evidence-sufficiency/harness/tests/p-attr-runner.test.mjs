import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { approvalRecord } from "../lib/approval.mjs";
import { runApprovedSession, runSession } from "../lib/orchestrate.mjs";
import { command, jsonFile, sha256 } from "../lib/io.mjs";
import { deliverResults, resultRecord, serializeResults, CHANGE } from "../lib/results.mjs";
import { evaluateWithGuard, writeSession } from "../lib/probe-runner.mjs";
import { launchProbe } from "../lib/launcher.mjs";
import { PROBE_FILES, ROLES, runAttr, validateExpectations } from "../p-attr/roles.mjs";
import { P_ATTR_BUDGET } from "../p-attr/linkage-cases.mjs";
import { preflightFixture, setApproval } from "./approval-fixture.mjs";

const OPENED = "2026-10-17T02:22:47Z";
const HEAD = "a".repeat(40);
const BODY = `S1 approval: P-attr run 3 for #802 at ${HEAD}`;
const APPROVAL_URL = "https://github.com/nandohdc/bloodtrail/issues/802#issuecomment-3";
function approvalArgs(body = BODY) {
  return { body, bodySha256: sha256(body), url: APPROVAL_URL, probe: "P-attr", ticket: 802,
    approvedHead: HEAD, runNumber: 3, createdAt: OPENED, updatedAt: OPENED,
    windowOpenedAt: OPENED, now: Date.parse(OPENED) + 1000 };
}
const APPROVAL_FAULTS = [
  ["probe", (a) => { a.probe = "P-D"; }, /approval line/],
  ["ticket", (a) => { a.ticket = 801; }, /approval line/],
  ["head", (a) => { a.approvedHead = "b".repeat(40); }, /approval line/],
  ["URL", (a) => { a.url = APPROVAL_URL.replace("/802#", "/801#"); }, /URL/],
  ["hash", (a) => { a.bodySha256 = "0".repeat(64); }, /sha256/],
  ["edited", (a) => { a.updatedAt = "2026-10-17T02:22:48Z"; }, /edited/],
  ["timestamp", (a) => { a.createdAt = a.updatedAt = "2026-10-17T25:22:47Z"; }, /timestamp/],
  ["before window", (a) => { a.createdAt = a.updatedAt = "2026-10-16T02:22:47Z"; }, /predates/],
  ["window expired", (a) => { a.now += 7 * 86400000; }, /expired/],
  ["run cap", (a) => { a.runNumber = 11; }, /authorization/],
];
for (const [label, patch, diagnostic] of APPROVAL_FAULTS) {
  test(`P-attr approval ${label} fails closed`, () => {
    const args = approvalArgs(); patch(args);
    assert.throws(() => approvalRecord(args), diagnostic);
  });
}
const DELEGATIONS = [["", null], ["\nDelegated S1 under G39", "G39"], ["\nDelegated S1 under G39 extra", null]];
for (const [suffix, expected] of DELEGATIONS) {
  test(`P-attr exact delegated line ${JSON.stringify(suffix)}`, () => {
    assert.equal(approvalRecord(approvalArgs(BODY + suffix)).delegation, expected);
  });
}
async function withApproved(fn) {
  const directory = mkdtempSync(join(tmpdir(), "p-attr-approval-"));
  try {
    const fixture = preflightFixture({ directory });
    const { options } = fixture;
    Object.assign(options, { "approval-url": APPROVAL_URL, "approval-created-at": OPENED, "approval-updated-at": OPENED, "window-opened-at": OPENED });
    const body = `S1 approval: P-attr run 1 for #802 at ${options.approvedHead}\nDelegated S1 under G39`;
    setApproval({ options, body });
    return await fn({ ...fixture, probe: "P-attr", ticket: 802, now: Date.parse(OPENED) + 1000 });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
function wrongHead(fixture) {
  fixture.options.approvedHead = HEAD;
  setApproval({ options: fixture.options, body: BODY.replace("run 3", "run 1") });
}
function trackedMutation(fixture) {
  const path = `${CHANGE}/harness/lib/parent.mjs`;
  command({ program: "git", args: ["update-index", "--assume-unchanged", path], cwd: fixture.options.repo });
  writeFileSync(join(fixture.options.repo, path), "// changed tracked bytes\n");
}
const PREFLIGHT_FAULTS = [
  ["dirty", (f) => writeFileSync(join(f.options.repo, "dirty"), "fixture\n"), /clean tree/],
  ["wrong HEAD", wrongHead, /HEAD must equal/],
  ["external checkout", (f) => { f.entrypoint = import.meta.url; }, /executing checkout/],
  ["occupied results", (f) => writeFileSync(f.options.results, "existing\n"), /already exists/],
  ["in-repo marker", (f) => { f.options["once-marker"] = join(f.options.repo, f.options["approval-sha256"]); }, /outside repository/],
  ["wrong marker name", (f) => { f.options["once-marker"] += "wrong"; }, /basename/],
  ["tracked-byte mutation hidden from status", trackedMutation, /differs from approved Git blob/],
];
for (const [label, patch, diagnostic] of PREFLIGHT_FAULTS) {
  test(`P-attr ${label} refuses before marker/launch`, () => withApproved(async (fixture) => {
    patch(fixture);
    let reason;
    const result = await runApprovedSession({ ...fixture, session: () => assert.fail("no launch"),
      failure: () => assert.fail("no claim"), refuse: (message) => { reason = message; } });
    assert.equal(result.exitCode, 1);
    assert.match(reason, diagnostic);
    assert.equal(existsSync(fixture.options["once-marker"]), false);
  }));
}
test("complete inventory precedes durable claim; exact hash marker cannot be reused", () => withApproved(async (fixture) => {
  await runApprovedSession({ ...fixture, session: (approval, hashes) => {
    assert.equal(approval.delegation, "G39");
    assert.equal(readFileSync(fixture.options["once-marker"], "utf8"), `${fixture.options.approvedHead}\n`);
    assert.equal(Object.keys(hashes).length, 2);
    for (const [path, entry] of Object.entries(hashes)) {
      assert.match(entry.git_blob, /^[0-9a-f]{40}$/);
      assert.equal(entry.sha256, sha256(readFileSync(join(fixture.options.repo, path))));
    }
    return { exitCode: 0 };
  }, failure: () => assert.fail("no failure"), refuse: () => assert.fail("must approve") });
  let reason;
  await runApprovedSession({ ...fixture, session: () => assert.fail("never repeat"),
    failure: () => assert.fail("preclaim"), refuse: (message) => { reason = message; } });
  assert.match(reason, /once-marker already exists/);
}));
const STAGES = ["build", "identity", "install", "launch", "cleanup", "write"];
for (const stage of STAGES) {
  test(`claimed ${stage} failure retains marker and partial evidence`, () => withApproved(async (fixture) => {
    let evidence;
    let fallback;
    const session = await runApprovedSession({ ...fixture, session: async (approval, hashes) => runSession({
      probe: "P-attr", ticket: 802, roles: ROLES, expectations: { planned_occurrence_budget: P_ATTR_BUDGET },
      pipeline: async (consume) => {
        const provenance = { invalidations: [], install: { single_core: { npm_ls_paths: ["fixture-core"] } },
          identity: { commit: fixture.options.approvedHead, distributable: true }, executed_file_hashes: hashes };
        if (["build", "identity", "install"].includes(stage)) {
          provenance.invalidations.push({ message: `fixture ${stage} failed` });
        } else provenance.observations = await consume({});
        provenance.scratch_deletion = { recursively_absent: stage !== "cleanup" };
        if (stage === "cleanup") provenance.invalidations.push("fixture cleanup failed");
        return provenance;
      },
      prepare: () => async () => {
        if (stage === "launch") throw new Error("fixture launch failed");
        return { role: "matrix", records: [{ step_id: "fixture", raw: { ok: true } }], invalidations: [], ledger: { occurrence_count: 1 } };
      },
      write: ({ provenance, observations, invalidations, occurrence_count }) => {
        evidence = resultRecord({ probe: "P-attr", ticket: 802, runNumber: 1, approvedHead: fixture.options.approvedHead,
          approval, expectations: { sha256: "f".repeat(64) }, started: OPENED, ended: OPENED,
          provenance, cases: [], invalidations, occurrenceCount: occurrence_count });
        evidence.process_observations = observations;
        return deliverResults({ path: fixture.options.results, result: evidence,
          write: () => { if (stage === "write") throw new Error("fixture write failed"); },
          stderr: (text) => { fallback = JSON.parse(text); } });
      },
    }), failure: () => assert.fail("pipeline contains failure"), refuse: () => assert.fail("approval valid") });
    assert.equal(session.exitCode, 1);
    assert(existsSync(fixture.options["once-marker"]));
    assert.equal(evidence.approval.delegation, "G39");
    assert.equal(evidence.install.single_core.npm_ls_paths.length, 1);
    assert.equal(evidence.kit_identity.commit, fixture.options.approvedHead);
    assert(evidence.invalidations.length > 0);
    if (stage === "write") assert.deepEqual(fallback.process_observations, evidence.process_observations);
  }));
}
// ---- F2: never-undefined invalidations through the guard and the session writer ----
function sessionContext(fixture, plan) {
  const { options } = fixture;
  return { plan: { probe: "P-attr", ticket: 802, ...plan }, options, started: OPENED,
    prefix: `${CHANGE}/harness`, expectationsPath: `${CHANGE}/harness/expectations/p-attr.v1.json`,
    expectationHash: "f".repeat(64), approval: { delegation: "G39" }, attempted: false, hashes: {} };
}

test("evaluateWithGuard threads the caller's invalidations array through success and faults", () => {
  const plan = { evaluate: () => ({ evaluations: ["fixture"], verdict: null }) };
  const context = { expectations: {} };
  const caller = [{ message: "fixture pipeline burst", attribution: "harness_pipeline" }];
  const clean = evaluateWithGuard({ plan, context, observations: [], invalidations: caller });
  assert.equal(clean.invalidations, caller, "success returns the caller's array reference unchanged");
  assert.deepEqual(clean.cases, { evaluations: ["fixture"], verdict: null });
  const faulted = evaluateWithGuard({ plan: { evaluate: () => { throw new Error("fixture evaluation burst"); } },
    context, observations: [], invalidations: caller });
  assert.equal(faulted.invalidations, caller, "the fault is pushed onto the caller's array in place");
  assert.deepEqual(faulted.cases, { evaluations: [], verdict: null });
  assert.match(caller[1].message, /evaluation fault: fixture evaluation burst/);
  assert.equal(caller[1].attribution, "harness_fault");
  const defaulted = evaluateWithGuard({ plan, context, observations: [] });
  assert.deepEqual(defaulted.invalidations, [], "a runProbe-shaped context with no array still yields []");
});

test("writeSession survives a results-write failure: the fallback JSON carries every invalidation", () => withApproved(async (fixture) => {
  const context = sessionContext(fixture, { retainProcesses: true,
    evaluate: ({ observations }) => ({ evaluations: observations.map(({ records }) => ({
      case_id: "fixture-case", matched: records.length === 1, mismatches: [], notes: [] })), verdict: null }) });
  const invalidations = [{ message: "fixture pipeline burst", attribution: "harness_pipeline" }];
  writeFileSync(fixture.options.results, "occupied\n");
  let fallback = "";
  const original = process.stderr.write;
  process.stderr.write = (text) => { fallback += text; return true; };
  try {
    assert.equal(writeSession(context, { provenance: {}, observations: [{ records: [{ step_id: "raw-observation" }] }],
      invalidations, occurrence_count: 1 }), false);
  } finally { process.stderr.write = original; }
  assert(context.attempted);
  assert.equal(invalidations.length, 2, "the write failure lands on the caller's array in place");
  const serialized = JSON.parse(fallback);
  assert.deepEqual(serialized.invalidations[0], invalidations[0]);
  assert.match(serialized.invalidations[1], /results write failed/);
  assert.deepEqual(serialized.process_observations, [{ records: [{ step_id: "raw-observation" }] }]);
}));

test("writeSession threads a plan.evaluate fault into the caller's array and the written results", () => withApproved(async (fixture) => {
  const context = sessionContext(fixture, { evaluate: () => { throw new Error("fixture evaluation burst"); } });
  const invalidations = [];
  assert.equal(writeSession(context, { provenance: {}, observations: [], invalidations, occurrence_count: 0 }), true);
  assert.equal(invalidations.length, 1, "the harness fault lands on the caller's array in place");
  assert.equal(invalidations[0].attribution, "harness_fault");
  const written = jsonFile(fixture.options.results);
  assert.deepEqual(written.cases, { evaluations: [], verdict: null });
  assert.equal(written.invalidations.length, 1);
  assert.equal(written.invalidations[0].attribution, "harness_fault");
}));

test("post-claim thrown failure is reported without deleting the marker", () => withApproved(async (fixture) => {
  let retained;
  const result = await runApprovedSession({ ...fixture, session: () => { throw new Error("fixture fatal"); },
    failure: (input) => { retained = input; }, refuse: () => assert.fail("not preflight") });
  assert.equal(result.exitCode, 1);
  assert.match(retained.error.message, /fatal/);
  assert.equal(retained.approval.delegation, "G39");
  assert(existsSync(fixture.options["once-marker"]));
}));
function expectedHeader() {
  // The frozen expectation file is the only header the validator accepts;
  // the runner test pins budget/join inventory through it.
  return jsonFile(new URL("../expectations/p-attr.v1.json", import.meta.url));
}
test("offline injected entry plan reuses shared runner fields and pins budget/join inventory", async () => {
  let plan;
  await runAttr({ entrypoint: "fixture-entry", runner: async (input) => { plan = input; return { exitCode: 0 }; } });
  assert.deepEqual([plan.probe, plan.ticket, plan.probeDirectory, plan.entrypoint], ["P-attr", 802, "p-attr", "fixture-entry"]);
  assert.equal(plan.retainProcesses, true);
  assert.equal(plan.validate, validateExpectations);
  assert.equal(typeof plan.evaluate, "function");
  assert.deepEqual(plan.roles, [{ role: "matrix" }]);
  assert.deepEqual(plan.files, PROBE_FILES);
  assert.equal(plan.validate(expectedHeader()).predicted_total, P_ATTR_BUDGET.predicted_total);
  assert.throws(() => plan.validate({ ...expectedHeader(), declared_join_pairs: [] }));
  assert.throws(() => plan.validate({ ...expectedHeader(), planned_occurrence_budget: { processes: { matrix: 4611 }, total: 4611 } }));
});
test("inventory closes ALL transitive local imports; only future process contains package imports", () => {
  assert.equal(new Set(PROBE_FILES).size, PROBE_FILES.length);
  for (const path of PROBE_FILES) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    for (const [, relative] of source.matchAll(/from "(\.[^"]+)"/g)) {
      assert(PROBE_FILES.includes(posix.normalize(posix.join(dirname(path), relative))), `${path} -> ${relative}`);
    }
    if (path !== "p-attr/probe-process.mjs") assert(!source.includes('from "@bloodtrail/'));
  }
  const entry = readFileSync(new URL("../p-attr/run-p-attr.mjs", import.meta.url), "utf8");
  assert(entry.includes("await runAttr({ entrypoint: import.meta.url })"));
});
test("launcher fixture keeps P-attr role, allowance, permission flags and inventory", () => {
  const service = mkdtempSync(join(tmpdir(), "p-attr-launch-"));
  try {
    const file = join(service, "fixture-core.mjs"); writeFileSync(file, "// text only\n");
    const args = { service, role: "matrix", budget: 4610, flags: ["--permission", `--allow-fs-read=${service}`],
      probeDirectory: "p-attr", prefix: "harness", inventory: { "harness/p-attr/probe-process.mjs": {} },
      run: ({ args: child }) => {
        assert(child.includes(join(service, "harness/p-attr/probe-process.mjs")));
        return JSON.stringify({ role: "matrix", resolved_core: new URL(`file://${file}`).href, ledger: { occurrence_count: 2305 } });
      } };
    assert.equal(launchProbe(args).ledger.occurrence_count, 2305);
    assert.throws(() => launchProbe({ ...args, inventory: {} }), /inventory/);
    assert.throws(() => launchProbe({ ...args, flags: [...args.flags, "--allow-net"] }), /permission/);
    assert.doesNotThrow(() => serializeResults(args.inventory));
  } finally { rmSync(service, { recursive: true, force: true }); }
});
// Offline public-shape doubles; the child imports no kit/SDK package. They are
// test infrastructure, not part of the approved PROBE_FILES closure.
const SANDBOX_FIXTURES = [
  "tests/p-attr-foundation-fixtures.mjs", "tests/p-attr-af-fixtures.mjs",
  "tests/p-attr-as-fixtures.mjs", "tests/p-attr-request-fixtures.mjs",
];
const SANDBOX_CHILD = `import { measure } from "./harness/p-attr/workload.mjs";
import { requestFixtureState } from "./harness/tests/p-attr-request-fixtures.mjs";
const observed = await measure({ state: requestFixtureState({ budget: 4610 }), analyze: false });
process.stdout.write(JSON.stringify({
  records: observed.records.length,
  invalidations: observed.invalidations.length,
  analyzed: observed.records.filter((record) => "analysis" in record).length,
}) + "\\n");
`;
test("sandboxed analyze:false run: PROBE_FILES closure only, no contracts/, all 950 records", () => {
  const service = mkdtempSync(join(realpathSync(tmpdir()), "p-attr-sandbox-"));
  try {
    for (const rel of [...PROBE_FILES, ...SANDBOX_FIXTURES]) {
      const target = join(service, "harness", rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(new URL(`../${rel}`, import.meta.url)));
    }
    writeFileSync(join(service, "child.mjs"), SANDBOX_CHILD);
    assert.equal(existsSync(join(service, "contracts")), false, "no contracts/ tree in the sandbox");
    const output = command({ program: process.execPath, args: ["--permission", `--allow-fs-read=${service}`, "child.mjs"], cwd: service });
    assert.deepEqual(JSON.parse(output), { records: 950, invalidations: 0, analyzed: 0 });
  } finally { rmSync(service, { recursive: true, force: true }); }
});
