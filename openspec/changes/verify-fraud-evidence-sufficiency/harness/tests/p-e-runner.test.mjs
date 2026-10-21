// P-E shared-runner integration fixtures (US-012): the offline plan adapter,
// exact-head S1 approval lines, preflight-before-claim ordering, retained
// once-markers, full raw evidence on evaluation/cleanup/write failures, and
// the sequential measure's baseline-first precondition. Fixture-only: the
// real runner and real pipeline are never invoked.
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approvalRecord } from "../lib/approval.mjs";
import { runApprovedSession, runSession } from "../lib/orchestrate.mjs";
import { command, jsonFile, sha256 } from "../lib/io.mjs";
import { deliverResults, resultRecord, CHANGE } from "../lib/results.mjs";
import { evaluateWithGuard, writeSession } from "../lib/probe-runner.mjs";
import { measure } from "../p-e/workload.mjs";
import { P_E_BUDGET, P_E_PREDICTED_TOTAL } from "../p-e/budget.mjs";
import { PROBE_FILES, ROLES, runPe, validateExpectations } from "../p-e/roles.mjs";
import { peDouble } from "./p-e-case-fixtures.mjs";
import { fixtureState } from "./p-e-runtime-fixtures.mjs";
import { authenticationFailed, concurrencyState } from "./p-e-concurrency-fixtures.mjs";
import { recoveryDouble } from "./p-e-recovery-fixtures.mjs";
import { preflightFixture, setApproval } from "./approval-fixture.mjs";

const OPENED = "2026-10-17T02:22:47Z";
const HEAD = "a".repeat(40);
const BODY = `S1 approval: P-E run 1 for #803 at ${HEAD}`;
const APPROVAL_URL = "https://github.com/nandohdc/bloodtrail/issues/803#issuecomment-803";
function approvalArgs(body = BODY) {
  return { body, bodySha256: sha256(body), url: APPROVAL_URL, probe: "P-E", ticket: 803,
    approvedHead: HEAD, runNumber: 1, createdAt: OPENED, updatedAt: OPENED,
    windowOpenedAt: OPENED, now: Date.parse(OPENED) + 1000 };
}
const APPROVAL_FAULTS = [
  ["probe", (a) => { a.probe = "P-D"; }, /approval line/],
  ["ticket", (a) => { a.ticket = 802; }, /approval line/],
  ["head", (a) => { a.approvedHead = "b".repeat(40); }, /approval line/],
  ["URL", (a) => { a.url = APPROVAL_URL.replace("/803#", "/802#"); }, /URL/],
  ["hash", (a) => { a.bodySha256 = "0".repeat(64); }, /sha256/],
  ["edited", (a) => { a.updatedAt = "2026-10-17T02:22:48Z"; }, /edited/],
  ["timestamp", (a) => { a.createdAt = a.updatedAt = "2026-10-17T25:22:47Z"; }, /timestamp/],
  ["before window", (a) => { a.createdAt = a.updatedAt = "2026-10-16T02:22:47Z"; }, /predates/],
  ["window expired", (a) => { a.now += 7 * 86400000; }, /expired/],
  ["run cap", (a) => { a.runNumber = 11; }, /authorization/],
];
for (const [label, patch, diagnostic] of APPROVAL_FAULTS) {
  test(`P-E approval ${label} fails closed`, () => {
    const args = approvalArgs(); patch(args);
    assert.throws(() => approvalRecord(args), diagnostic);
  });
}
const DELEGATIONS = [["", null], ["\nDelegated S1 under G39", "G39"], ["\nDelegated S1 under G39 extra", null]];
for (const [suffix, expected] of DELEGATIONS) {
  test(`P-E exact delegated line ${JSON.stringify(suffix)}`, () => {
    assert.equal(approvalRecord(approvalArgs(BODY + suffix)).delegation, expected);
  });
}

test("offline injected P-E plan supplies identity, inventory, one sequential role, strict validator/evaluator, retained processes and database scratch", async () => {
  let plan;
  await runPe({ entrypoint: "fixture-entry", runner: async (input) => { plan = input; return { exitCode: 0 }; } });
  assert.deepEqual([plan.probe, plan.ticket, plan.probeDirectory, plan.entrypoint], ["P-E", 803, "p-e", "fixture-entry"]);
  assert.equal(plan.retainProcesses, true);
  assert.equal(plan.databaseScratch, true);
  assert.equal(plan.validate, validateExpectations);
  assert.equal(typeof plan.evaluate, "function");
  assert.deepEqual(plan.roles, [{ role: "sequential" }]);
  assert.deepEqual(plan.files, PROBE_FILES);
  assert.equal(new Set(PROBE_FILES).size, PROBE_FILES.length, "PROBE_FILES entries must be unique");
  assert.throws(() => plan.validate({ probe: "P-D" }), /malformed P-E expectations/);
  assert.doesNotThrow(() => plan.evaluate({}), "the evaluator must never throw");
});

async function withApproved(fn) {
  const directory = mkdtempSync(join(tmpdir(), "p-e-approval-"));
  try {
    const fixture = preflightFixture({ directory });
    const { options } = fixture;
    Object.assign(options, { "approval-url": APPROVAL_URL, "approval-created-at": OPENED,
      "approval-updated-at": OPENED, "window-opened-at": OPENED });
    const body = `S1 approval: P-E run 1 for #803 at ${options.approvedHead}\nDelegated S1 under G39`;
    setApproval({ options, body });
    return await fn({ ...fixture, probe: "P-E", ticket: 803, now: Date.parse(OPENED) + 1000 });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
function wrongHead(fixture) {
  fixture.options.approvedHead = HEAD;
  setApproval({ options: fixture.options, body: BODY });
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
  test(`P-E ${label} refuses before marker/launch`, () => withApproved(async (fixture) => {
    patch(fixture);
    let reason;
    const result = await runApprovedSession({ ...fixture, session: () => assert.fail("no launch"),
      failure: () => assert.fail("no claim"), refuse: (message) => { reason = message; } });
    assert.equal(result.exitCode, 1);
    assert.match(reason, diagnostic);
    assert.equal(existsSync(fixture.options["once-marker"]), false);
  }));
}

test("P-E complete inventory precedes durable claim; exact hash marker cannot be reused", () => withApproved(async (fixture) => {
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
  test(`claimed ${stage} failure retains marker, database threading and full raw evidence`, () => withApproved(async (fixture) => {
    let evidence;
    let fallback;
    const session = await runApprovedSession({ ...fixture, session: async (approval, hashes) => runSession({
      probe: "P-E", ticket: 803, roles: ROLES, expectations: { planned_occurrence_budget: P_E_BUDGET },
      pipeline: async (consume) => {
        const provenance = { invalidations: [], install: { single_core: { npm_ls_paths: ["fixture-core"] } },
          identity: { commit: fixture.options.approvedHead, distributable: true }, executed_file_hashes: hashes };
        if (["build", "identity", "install"].includes(stage)) {
          provenance.invalidations.push({ message: `fixture ${stage} failed` });
        } else provenance.observations = await consume({ database: { directory: fixture.options.control } });
        provenance.scratch_deletion = { recursively_absent: stage !== "cleanup" };
        if (stage === "cleanup") provenance.invalidations.push("fixture cleanup failed");
        return provenance;
      },
      prepare: (context) => {
        if (!["build", "identity", "install"].includes(stage)) {
          assert.equal(typeof context.database.directory, "string", "declared database scratch must reach preparation");
        }
        return async (role) => {
          if (stage === "launch") throw new Error("fixture launch failed");
          return { role: role.role, records: [{ step_id: "fixture", raw: { ok: true } }],
            invalidations: [], ledger: { occurrence_count: 1 } };
        };
      },
      write: ({ provenance, observations, invalidations, occurrence_count }) => {
        evidence = resultRecord({ probe: "P-E", ticket: 803, runNumber: 1, approvedHead: fixture.options.approvedHead,
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

function sessionContext(fixture, plan) {
  const { options } = fixture;
  return { plan: { probe: "P-E", ticket: 803, ...plan }, options, started: OPENED,
    prefix: `${CHANGE}/harness`, expectationsPath: `${CHANGE}/harness/expectations/p-e.v1.json`,
    expectationHash: "f".repeat(64), approval: { delegation: "G39" }, attempted: false, hashes: {} };
}

test("writeSession keeps full raw observations when a P-E evaluation faults", () => withApproved(async (fixture) => {
  const context = sessionContext(fixture, { retainProcesses: true,
    evaluate: () => { throw new Error("fixture evaluation burst"); } });
  const observations = [{ records: [{ step_id: "raw-observation" }] }];
  const invalidations = [];
  assert.equal(writeSession(context, { provenance: {}, observations, invalidations, occurrence_count: 1 }), true);
  assert.equal(invalidations.length, 1);
  assert.equal(invalidations[0].attribution, "harness_fault");
  const written = jsonFile(fixture.options.results);
  assert.deepEqual(written.process_observations, observations);
}));

test("evaluateWithGuard returns the P-E plan's evaluation on success", () => {
  const evaluated = evaluateWithGuard({ plan: { evaluate: () => ({ evaluations: ["fixture"], verdict: null }) },
    context: { expectations: {} }, observations: [] });
  assert.deepEqual(evaluated, { cases: { evaluations: ["fixture"], verdict: null }, invalidations: [] });
});

// ---- Sequential measure: baselines first, per-case predictions, sticky allowance ----
async function withDirectory(fn) {
  const directory = mkdtempSync(join(tmpdir(), "p-e-measure-"));
  try { return await fn(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

// The full 32-case process needs every offline public surface: the recovery
// extensions (redeliver, named retained emit), the admission extension
// (authenticationFailed, observedSource) and the base double.
function fullPeState({ budget }) {
  const modules = recoveryDouble();
  const factory = modules.node.createNodeSecurityAuditSdk;
  modules.core.observedSource = (input) => Object.freeze(structuredClone(input));
  modules.node.createNodeSecurityAuditSdk = (config) => {
    const sdk = factory(config);
    return Object.freeze({ ...sdk, authenticationFailed: authenticationFailed(config.sink) });
  };
  return fixtureState({ budget, ...modules });
}

test("full sequential measure runs baselines first and reproduces every per-case prediction under the frozen allowance", async () => {
  await withDirectory(async (directory) => {
    const state = fullPeState({ budget: P_E_BUDGET.total });
    const observed = await measure({ state, directory });
    assert.equal(observed.role, "sequential");
    assert.deepEqual(observed.invalidations, []);
    assert.equal(observed.public_calls.length, P_E_PREDICTED_TOTAL);
    assert.equal(observed.ledger.occurrence_count, P_E_PREDICTED_TOTAL);
    assert.equal(observed.ledger.exhausted, false);
    assert.equal(observed.accounting.length, 32, "two baselines plus thirty family cases");
    assert.equal(observed.accounting[0].case_id, "P-E-g", "baselines run before every family");
    assert.equal(observed.accounting[1].case_id, "P-E-adm");
    assert.deepEqual(readdirSync(directory), [], "all per-case host databases removed");
  });
});

test("a baseline guarantees mutation is a precondition invalidation that stops every remaining case", async () => {
  await withDirectory(async (directory) => {
    const state = concurrencyState({ transformBinding: (binding) => ({ ...binding,
      guarantees: { ...binding.guarantees, deliveryClass: "best_effort" } }) });
    const observed = await measure({ state, directory });
    assert.equal(observed.invalidations.length, 1);
    assert.match(observed.invalidations[0].message, /baseline precondition failed/);
    assert.equal(observed.accounting.length, 2, "only the two baselines ran");
    const ids = new Set(observed.records.map((record) => record.step_id.split("/")[0]));
    assert.deepEqual([...ids].sort(), ["P-E-adm", "P-E-g"]);
  });
});

test("an extra binding surface key is a baseline precondition invalidation", async () => {
  await withDirectory(async (directory) => {
    const state = concurrencyState({ transformBinding: (binding) => ({ ...binding, shutdown: async () => null }) });
    const observed = await measure({ state, directory });
    assert.equal(observed.invalidations.length, 1);
    assert.match(observed.invalidations[0].message, /baseline precondition failed/);
  });
});

test("a baseline construction refusal stops the process and never reaches a family", async () => {
  await withDirectory(async (directory) => {
    const modules = peDouble();
    const factory = modules.node.createNodeSecurityAuditSdk;
    modules.core.observedSource = (input) => Object.freeze(structuredClone(input));
    modules.node.createNodeSecurityAuditSdk = (config) => Object.freeze({ ...factory(config),
      authenticationFailed: authenticationFailed(config.sink),
      mfaRemoved: async () => ({ ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } }) });
    const state = fixtureState({ budget: 100, ...modules });
    const observed = await measure({ state, directory });
    assert.equal(observed.invalidations.length, 1);
    const ids = new Set(observed.records.map((record) => record.step_id.split("/")[0]));
    assert.deepEqual([...ids].sort(), ["P-E-adm", "P-E-g"]);
  });
});
