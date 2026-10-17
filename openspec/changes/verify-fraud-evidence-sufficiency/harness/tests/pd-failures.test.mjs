import assert from "node:assert/strict";
import { test } from "node:test";
import { launchProbe } from "../lib/launcher.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { finalizeScratch } from "../lib/kit-pipeline.mjs";
import { deliverResults, resultRecord } from "../lib/results.mjs";
import { runSession } from "../lib/orchestrate.mjs";
import { ROLES } from "../p-d/roles.mjs";
import { createState, step } from "../p-d/runtime.mjs";
import { measure } from "../p-d/workload.mjs";
import { EXPECTATIONS } from "./pd-fixtures.mjs";

const provenance = () => ({ identity: { commit: "a".repeat(40), distributable: true, artifacts: [{ name: "fixture" }] }, install: { single_core: { npm_ls_paths: ["/fixture/core"] } }, invalidations: [], observations: { observations: [{ role: "integrity", records: [{ step_id: "PD-A1/main", surface: "fixture" }] }], invalidations: [], occurrence_count: 1 } });
function record(input) {
  return resultRecord({ probe: "P-D", ticket: 801, runNumber: 2, approvedHead: "a".repeat(40), approval: { delegation: "G39" }, expectations: { sha256: "fixture" }, started: "2026-10-17T03:00:00Z", ended: "2026-10-17T03:00:01Z", provenance: input.provenance, cases: input.observations, invalidations: input.invalidations, occurrenceCount: input.occurrence_count });
}

const FAULTS = [
  ["write", (value) => value],
  ["deletion", (value) => finalizeScratch({ result: value, scratch: "/fixture/scratch", remove: () => { throw new Error("fixture deletion failure"); } })],
];
for (const [fault, patch] of FAULTS) {
  test(`P-D ${fault} failure retains observations/install evidence and exits nonzero`, async () => {
    const evidence = provenance();
    let written;
    let attempts = 0;
    const session = await runSession({ probe: "P-D", ticket: 801, roles: ROLES, expectations: EXPECTATIONS, prepare: () => assert.fail("no pipeline execution"), pipeline: async () => patch(evidence), write: (input) => {
      written = record(input);
      if (fault !== "write") return true;
      return deliverResults({ path: "/fixture/results", result: written, write: () => { attempts += 1; throw new Error("fixture disk failure"); }, stderr: (text) => { written = JSON.parse(text); } });
    } });
    assert.equal(session.exitCode, 1);
    assert.equal(written.probe, "P-D");
    assert.deepEqual(written.install, evidence.install);
    assert.deepEqual(written.cases, evidence.observations.observations);
    assert.equal(written.approval.delegation, "G39");
    assert.equal(attempts, fault === "write" ? 1 : 0);
    assert(written.invalidations.length > 0);
  });
}

test("P-D swallowed provider budget exhaustion is sticky and never an SDK finding", async () => {
  const state = createState({ core: {}, node: {}, testing: {}, ledger: occurrenceLedger({ budget: 1 }) });
  const target = { sink: { events: [] } };
  const cases = [{ case_id: "PD-E3", run: (s) => step(s, "main", target, () => s.call("outer", () => {
    try { s.call("provider.callback", () => "never"); } catch { /* SDK-style containment */ }
    return { ok: false, error: { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" } };
  })) }];
  const observed = await measure({ state, cases });
  assert.equal(observed.ledger.exhausted, true);
  assert.equal(observed.public_calls[0].attribution, "harness_fault");
  assert.equal(observed.public_calls[0].diagnostic, undefined);
  assert.equal(observed.invalidations[0].attribution, "harness_fault");
  assert.equal(observed.records.length, 0);
});

test("P-D harness exceptions invalidate and stop instead of becoming SDK findings", async () => {
  const state = createState({ core: {}, node: {}, testing: {}, ledger: occurrenceLedger({ budget: 2 }) });
  const cases = [
    { case_id: "PD-A1", run: () => { throw new Error("fixture broken harness"); } },
    { case_id: "PD-A2", run: () => assert.fail("must stop") },
  ];
  const observed = await measure({ state, cases });
  assert.equal(observed.invalidations[0].attribution, "harness_fault");
  assert.match(observed.invalidations[0].message, /fixture broken harness/);
  assert.equal(observed.records.length, 0);
});

test("P-D launcher selects its own future entry with only filesystem-read permission", () => {
  const service = "/fixture/service";
  const flags = ["--permission", `--allow-fs-read=${service}`];
  assert.throws(() => launchProbe({ service, role: "integrity", budget: 742, flags, probeDirectory: "p-d", prefix: "harness", inventory: { "harness/p-d/probe-process.mjs": {} }, run: ({ args }) => {
    assert.equal(args[2], service + "/harness/p-d/probe-process.mjs");
    assert.deepEqual(args.slice(0, 2), flags);
    throw new Error("fixture inspected; no child spawned");
  } }), /fixture inspected/);
});
