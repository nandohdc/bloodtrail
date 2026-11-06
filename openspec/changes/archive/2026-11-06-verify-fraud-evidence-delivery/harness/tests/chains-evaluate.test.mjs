import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { evaluateCases } from "../chains/evaluate.mjs";
import { chainsControls, makeControlsBodiesFixture } from "../chains/controls.mjs";
import { reconstructChains, reconstructMergeBySource } from "../chains/reconstruct.mjs";
import { generateWorkloadDefinition } from "../chains/workload.mjs";
import { computeAccounting } from "../chains/observations.mjs";
import { jsonFile, sha256 } from "../lib/io.mjs";
import { findDottedRoots } from "./copies-parity.mjs";
import { resolves } from "./field-reads.mjs";
import { runChainsRehearsal } from "./chains-fakes.mjs";

const FROZEN_V1 = jsonFile(new URL("../expectations/chains.v1.json", import.meta.url));

function makeHonestControls() {
  return {
    sender: {
      loopback_guard: { holds: true, planted: { refused: true, fired: true }, null_control: { connected: true, silent: true } },
      write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true },
      synthetic_data: { holds: true, planted_refused: true, null_control_passed: true },
      chains_checks: chainsControls(),
    },
    ingress: {
      write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true },
    },
  };
}

function buildPhaseData({ phaseName, chainCount, tenantCount, failedCount, seedOffset = 0 }) {
  const workload = generateWorkloadDefinition({
    seed: FROZEN_V1.workload.seed + seedOffset,
    chainCount,
    tenantCount,
    failedCount,
    clockStart: FROZEN_V1.clock.start,
    clockStepMs: FROZEN_V1.clock.step_ms,
  });

  const bodies = makeControlsBodiesFixture(workload);
  const controls = makeHonestControls();
  const occurrences = bodies.length;

  const exchanges = [];
  const calls = [];
  const deliveries = {};
  const records = [];
  const readBack = [];

  for (let i = 0; i < occurrences; i += 1) {
    const b = bodies[i];
    const hash = sha256(JSON.stringify(b));
    const eventId = b.event.id;
    exchanges.push({ event_id: eventId, attempt: 0, body_sha256: hash });
    calls.push({ label: `${phaseName}_call_${i}`, ok: true });
    deliveries[eventId] = { status: "acknowledged" };
    records.push({
      event_id: eventId,
      status: 202,
      body_sha256: hash,
      outcome: { kind: "persisted" },
    });
    readBack.push({
      event_id: eventId,
      persisted: true,
      stored_body_sha256: hash,
    });
  }

  const reconstruction = reconstructChains(bodies);

  return {
    sender: {
      calls,
      deliveries,
      exchanges,
      guard_violations: [{ host: "192.0.2.1", stage: "before_connect" }],
      controls: controls.sender,
    },
    ingress: {
      records,
      read_back: readBack,
      persisted_bodies: bodies,
      controls: controls.ingress,
    },
    reconstruction,
  };
}

function honestFixture() {
  return {
    phases: {
      chains_small: buildPhaseData({ phaseName: "chains_small", chainCount: 6, tenantCount: 3, failedCount: 6, seedOffset: 0 }),
      chains_volume: buildPhaseData({ phaseName: "chains_volume", chainCount: 60, tenantCount: 10, failedCount: 60, seedOffset: 100 }),
    },
  };
}

function assertCaseFails(observations, expectedMismatchCaseId) {
  const verdict = evaluateCases({ observations, expectations: FROZEN_V1 });
  const failed = verdict.evaluations.find((e) => e.case_id === expectedMismatchCaseId);
  assert.equal(failed?.matched, false, `Expected case ${expectedMismatchCaseId} to fail`);
}

function assertSingleMismatch(observations, expectedMismatchCaseId) {
  const verdict = evaluateCases({ observations, expectations: FROZEN_V1 });
  assert.equal(verdict.verdict.matched, 10, `Expected 10 matched, got ${verdict.verdict.matched}`);
  assert.equal(verdict.verdict.mismatched, 1, `Expected 1 mismatch, got ${verdict.verdict.mismatched}`);
  const failed = verdict.evaluations.find((e) => !e.matched);
  assert.equal(failed?.case_id, expectedMismatchCaseId);
}

test("producer-built honest fixtures match all 11 cases", () => {
  const fixture = honestFixture();
  const verdict = evaluateCases({ observations: fixture, expectations: FROZEN_V1 });
  assert.equal(verdict.verdict.matched, 11);
  assert.equal(verdict.verdict.mismatched, 0);
  for (const evaluation of verdict.evaluations) {
    assert.equal(evaluation.matched, true, `Case ${evaluation.case_id} failed`);
  }
});

test("every case has a planted mismatch", () => {
  const defR01 = honestFixture();
  const t0 = Object.keys(defR01.phases.chains_small.reconstruction.chains)[0];
  const a0 = Object.keys(defR01.phases.chains_small.reconstruction.chains[t0])[0];
  const s0 = Object.keys(defR01.phases.chains_small.reconstruction.chains[t0][a0])[0];
  defR01.phases.chains_small.reconstruction.chains[t0][a0][s0][0].timestamp = "1999-01-01T00:00:00.000Z";
  assertCaseFails(defR01, "R-01");

  const defR02 = honestFixture();
  defR02.phases.chains_small.reconstruction = reconstructMergeBySource(defR02.phases.chains_small.ingress.persisted_bodies);
  assertCaseFails(defR02, "R-02");

  const defR03 = honestFixture();
  const src0 = Object.keys(defR03.phases.chains_small.reconstruction.per_source_counts)[0];
  defR03.phases.chains_small.reconstruction.per_source_counts[src0] += 99;
  assertCaseFails(defR03, "R-03");

  const defR04 = honestFixture();
  const tPart0 = Object.keys(defR04.phases.chains_small.reconstruction.per_tenant_partitions)[0];
  defR04.phases.chains_small.reconstruction.per_tenant_partitions[tPart0].push("syn-account-intruder");
  assertCaseFails(defR04, "R-04");

  const defR05 = honestFixture();
  const srcFail0 = Object.keys(defR05.phases.chains_small.reconstruction.failed_authentications)[0];
  defR05.phases.chains_small.reconstruction.failed_authentications[srcFail0][0].timestamp = "1999-01-01T00:00:00.000Z";
  assertCaseFails(defR05, "R-05");

  const defR06 = honestFixture();
  defR06.phases.chains_small.ingress.persisted_bodies[0].actor.id = "user@example.test";
  assertCaseFails(defR06, "R-06");

  const defR07 = honestFixture();
  const t7 = Object.keys(defR07.phases.chains_small.reconstruction.chains)[0];
  const a7 = Object.keys(defR07.phases.chains_small.reconstruction.chains[t7])[0];
  const s7 = Object.keys(defR07.phases.chains_small.reconstruction.chains[t7][a7])[0];
  const evs7 = defR07.phases.chains_small.reconstruction.chains[t7][a7][s7];
  delete defR07.phases.chains_small.reconstruction.chains[t7][a7][s7];
  defR07.phases.chains_small.reconstruction.chains[t7][a7]["syn-handle-bearer-token"] = evs7;
  assertCaseFails(defR07, "R-07");

  const defR08 = honestFixture();
  const t8 = Object.keys(defR08.phases.chains_small.reconstruction.chains)[0];
  const a8 = Object.keys(defR08.phases.chains_small.reconstruction.chains[t8])[0];
  const s8 = Object.keys(defR08.phases.chains_small.reconstruction.chains[t8][a8])[0];
  defR08.phases.chains_small.reconstruction.chains[t8][a8][s8].reverse();
  assertCaseFails(defR08, "R-08");

  const defR09 = honestFixture();
  defR09.phases.chains_small.sender.controls.chains_checks.null_controls_pass = false;
  assertCaseFails(defR09, "R-09");

  const defR10 = honestFixture();
  defR10.phases.chains_small.sender.controls.loopback_guard.holds = false;
  assertCaseFails(defR10, "R-10");

  const defR11 = honestFixture();
  defR11.phases.chains_volume.ingress.read_back.pop();
  assertCaseFails(defR11, "R-11");
});

test("Q238, Q239: planted mismatches for round-2 decisions", () => {
  const defR05Actor = honestFixture();
  const failedBody1 = defR05Actor.phases.chains_small.ingress.persisted_bodies.find(
    (b) => b.event.name === "bloodtrail.audit.authentication.failed",
  );
  failedBody1.actor = { type: "authenticated_human", id: "syn-acc-leaked" };
  assertCaseFails(defR05Actor, "R-05");

  const defR05Cred = honestFixture();
  const failedBody2 = defR05Cred.phases.chains_small.ingress.persisted_bodies.find(
    (b) => b.event.name === "bloodtrail.audit.authentication.failed",
  );
  failedBody2.credential = { type: "password", reference: "syn-crd-ref-leaked" };
  assertCaseFails(defR05Cred, "R-05");

  const defR01Extra = honestFixture();
  defR01Extra.phases.chains_small.reconstruction.chains["syn-ten-extra"] = {
    "syn-acc-extra": {
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef": [
        { name: "bloodtrail.audit.session.created", timestamp: "2026-10-23T00:00:00.000Z" },
      ],
    },
  };
  assertCaseFails(defR01Extra, "R-01");

  const defVolR01 = honestFixture();
  defVolR01.phases.chains_volume.reconstruction.chains = {};
  assertCaseFails(defVolR01, "R-01");

  const defVolR02 = honestFixture();
  defVolR02.phases.chains_volume.reconstruction = reconstructMergeBySource(defVolR02.phases.chains_volume.ingress.persisted_bodies);
  assertCaseFails(defVolR02, "R-02");

  const defVolR03 = honestFixture();
  const srcVol = Object.keys(defVolR03.phases.chains_volume.reconstruction.per_source_counts)[0];
  defVolR03.phases.chains_volume.reconstruction.per_source_counts[srcVol] += 99;
  assertCaseFails(defVolR03, "R-03");

  const defVolR04 = honestFixture();
  const tVol = Object.keys(defVolR04.phases.chains_volume.reconstruction.per_tenant_partitions)[0];
  defVolR04.phases.chains_volume.reconstruction.per_tenant_partitions[tVol].push("syn-account-intruder");
  assertCaseFails(defVolR04, "R-04");

  const defVolR05 = honestFixture();
  const srcFailVol = Object.keys(defVolR05.phases.chains_volume.reconstruction.failed_authentications)[0];
  defVolR05.phases.chains_volume.reconstruction.failed_authentications[srcFailVol][0].timestamp = "1999-01-01T00:00:00.000Z";
  assertCaseFails(defVolR05, "R-05");

  const defVolR08 = honestFixture();
  const t8 = Object.keys(defVolR08.phases.chains_volume.reconstruction.chains)[0];
  const a8 = Object.keys(defVolR08.phases.chains_volume.reconstruction.chains[t8])[0];
  const s8 = Object.keys(defVolR08.phases.chains_volume.reconstruction.chains[t8][a8])[0];
  defVolR08.phases.chains_volume.reconstruction.chains[t8][a8][s8].reverse();
  assertCaseFails(defVolR08, "R-08");

  const defR07Leak = honestFixture();
  const bodyWithCred = defR07Leak.phases.chains_small.ingress.persisted_bodies.find(
    (b) => b.event.name === "bloodtrail.audit.account.password_reset.completed",
  );
  bodyWithCred.credential = { type: "password", reference: "syn-handle-leaked-secret" };
  assertCaseFails(defR07Leak, "R-07");
});

test("controls must be read with === true only", () => {
  for (const nonBoolean of [1, "true", {}]) {
    const defLoopback = honestFixture();
    defLoopback.phases.chains_small.sender.controls.loopback_guard.holds = nonBoolean;
    assertSingleMismatch(defLoopback, "R-10");

    const defSenderWrite = honestFixture();
    defSenderWrite.phases.chains_small.sender.controls.write_outside_grant.holds = nonBoolean;
    assertSingleMismatch(defSenderWrite, "R-10");

    const defIngressWrite = honestFixture();
    defIngressWrite.phases.chains_small.ingress.controls.write_outside_grant.holds = nonBoolean;
    assertSingleMismatch(defIngressWrite, "R-10");

    const defSynthetic = honestFixture();
    defSynthetic.phases.chains_small.sender.controls.synthetic_data.holds = nonBoolean;
    assertSingleMismatch(defSynthetic, "R-10");

    const defMerge = honestFixture();
    defMerge.phases.chains_small.sender.controls.chains_checks.merge_by_source_defect_detected = nonBoolean;
    assertSingleMismatch(defMerge, "R-09");

    const defArrival = honestFixture();
    defArrival.phases.chains_small.sender.controls.chains_checks.arrival_order_defect_detected = nonBoolean;
    assertSingleMismatch(defArrival, "R-09");

    const defNull = honestFixture();
    defNull.phases.chains_small.sender.controls.chains_checks.null_controls_pass = nonBoolean;
    assertSingleMismatch(defNull, "R-09");
  }
});

function extractDottedPaths(text, name) {
  const pattern = new RegExp(`(?<![\\.\\?a-zA-Z0-9_$])\\b${name}((?:\\.[a-z0-9_]+)+)`, "g");
  return new Set([...text.matchAll(pattern)].map((match) => match[1].slice(1)));
}

function assertDeclaredRoots(roots, declaredAliases, allowedNonObservation) {
  const undeclared = [];
  for (const root of roots) {
    const isDeclared = declaredAliases.has(root);
    const isAllowed = allowedNonObservation.has(root);
    if (!isDeclared && !isAllowed) undeclared.push(root);
  }
  assert.deepEqual(undeclared, []);
}

function assertTargetPathsResolved(targets, combinedCode) {
  for (const [name, objects] of Object.entries(targets)) {
    const paths = extractDottedPaths(combinedCode, name);
    for (const path of paths) {
      const found = objects.some((obj) => resolves({ object: obj, path }));
      assert(found, `${name} lacks field path: ${path}`);
    }
  }
}

function isPathInBody(item, pathArray) {
  const body = typeof item === "string" ? JSON.parse(item) : item;
  let cur = body;
  for (const seg of pathArray) {
    if (!cur) return false;
    cur = cur[seg];
  }
  return cur !== undefined;
}

function assertReconPathsInBodies(allReconPaths, persistedBodies) {
  assert(persistedBodies.length > 0, "persisted bodies must not be empty");
  for (const pathArray of allReconPaths) {
    const resolved = persistedBodies.some((item) => isPathInBody(item, pathArray));
    assert(resolved, `reconstruct path [${pathArray.join(", ")}] not resolved in any persisted body`);
  }
}

test("field-read parity over every alias in evaluate.mjs, observations.mjs, and reconstruct.mjs", async () => {
  const evalSrc = readFileSync(new URL("../chains/evaluate.mjs", import.meta.url), "utf8");
  const chainObsSrc = readFileSync(new URL("../chains/observers-chain.mjs", import.meta.url), "utf8");
  const srcObsSrc = readFileSync(new URL("../chains/observers-source.mjs", import.meta.url), "utf8");
  const identObsSrc = readFileSync(new URL("../chains/observers-identity.mjs", import.meta.url), "utf8");
  const predObsSrc = readFileSync(new URL("../chains/observer-predicates.mjs", import.meta.url), "utf8");
  const obsSrc = readFileSync(new URL("../chains/observations.mjs", import.meta.url), "utf8");
  const reconSrc = readFileSync(new URL("../chains/reconstruct.mjs", import.meta.url), "utf8");

  const combinedCode = `${evalSrc}\n${chainObsSrc}\n${srcObsSrc}\n${identObsSrc}\n${predObsSrc}\n${obsSrc}\n${reconSrc}`.replace(/^\s*import\b.*?;\s*$/gm, "");
  const roots = findDottedRoots(combinedCode);

  const declaredAliases = new Set([
    "accounting", "act", "actKeys", "actTenants", "actor", "actual", "actualCounts",
    "actualEvents", "actualKeys", "actualList", "actualPartitions", "allFailed",
    "arrivalOrder", "bodies", "body", "caseDef", "chainEvents", "chainIds", "chains",
    "chains_small", "chains_volume", "checks", "config", "controls", "counts", "ctx", "curr",
    "decision", "defR01", "deliveries", "entry", "error", "ev", "evaluation",
    "evaluations", "events", "exchanges", "exp", "expTenants", "expected", "expectedAccounts",
    "expectedChains", "expectedCounts", "expectedEvents", "expectedKeys", "expectedList",
    "expectedPartitions", "expectedTenant", "failedAuths", "failedIds", "failedList",
    "failedTimestamps", "found", "foundA", "foundB", "groundTruth", "gt", "gtAccounts",
    "gtEvents", "gtKeys", "gtTenants", "handler", "handlers", "hexPattern", "HEX_PATTERN",
    "honest", "ident", "item", "items", "left", "match", "matches", "mergedChains",
    "message", "next", "obs", "obsArrival", "obsChain", "obsMerge", "observations",
    "observed", "order", "p", "pairs", "partitions", "persistedBodies", "phase",
    "phaseConfig", "phaseDef", "phaseGt", "phaseList", "phaseName", "phaseNames",
    "phaseObs", "phases", "planted", "plantedArrival", "plantedMerge", "proc",
    "reconAccounts", "reconTenants", "record", "reconstructed", "reconstructedEvents",
    "reconstructedTenant", "reconstruction", "records", "reply", "res", "resource",
    "result", "right", "role", "roots", "sanitized", "scenarios", "sender",
    "senderControlValues", "server", "serverState", "sessionKeys", "sessionId",
    "sessions", "sharedPairs", "smallActual", "smallChains", "smallExpected",
    "smallPhase", "sourceBuckets", "sourceGroup", "state", "step", "storage",
    "stored", "str", "subject", "target", "tenantAccounts", "tenants", "text",
    "timestamp", "total", "unit", "unexplained", "val", "value", "verdict",
    "violation", "violations", "volumeActual", "volumeChains", "volumeExpected",
    "volumePhase", "workload",
  ]);

  const allowedNonObservation = new Set([
    "Array", "Buffer", "Date", "JSON", "Math", "Number", "Object", "Promise", "Set", "Map", "String", "assert", "process", "globalThis", "console", "import", "EMAIL_PATTERN",
    "DELIVERED", "expectations", "caseDef", "cases", "phaseConfig", "evaluation", "evaluations", "allPhases", "allSenders", "allIngresses", "seenViolations", "uniqueIds", "phaseList", "schedule", "allowed", "label", "ids",
  ]);

  assertDeclaredRoots(roots, declaredAliases, allowedNonObservation);

  const rehearsal = await runChainsRehearsal();
  const allPhases = Object.values(rehearsal.phases);
  const allSenders = allPhases.map((p) => p.sender).filter(Boolean);
  const allIngresses = allPhases.map((p) => p.ingress).filter(Boolean);
  const allReconstructions = allPhases.map((p) => p.reconstruction).filter(Boolean);

  const targets = {
    phase: [...allPhases, ...FROZEN_V1.phases],
    sender: allSenders,
    ingress: allIngresses,
    reconstruction: allReconstructions,
    checks: allSenders.map((s) => s.controls?.chains_checks).filter(Boolean),
    config: FROZEN_V1.phases,
    accounting: allPhases.map((p) => computeAccounting(p, 36)).filter(Boolean),
  };

  assertTargetPathsResolved(targets, combinedCode);

  const pathMatches = [...reconSrc.matchAll(/getPath\s*\(\s*body\s*,\s*(\[[^\]]+\])/g)].map((m) => JSON.parse(m[1]));
  const simpleMatches = [...reconSrc.matchAll(/\["[a-zA-Z]+",\s*(\[[^\]]+\])/g)].map((m) => JSON.parse(m[1]));
  const allReconPaths = [...pathMatches, ...simpleMatches];
  const persistedBodies = rehearsal.phases.chains_small.ingress.persisted_bodies;

  assertReconPathsInBodies(allReconPaths, persistedBodies);
});

function assertMissingFieldVerdict(mutate) {
  const observations = honestFixture();
  mutate(observations);
  const verdict = evaluateCases({ observations, expectations: FROZEN_V1 });
  assert.equal(verdict.verdict.matched < 11, true);
  for (const evaluation of verdict.evaluations) {
    assert.equal(typeof evaluation.observed, "object");
    assert.notEqual(evaluation.observed, null);
  }
}

const MISSING_PARTS_CASES = [
  {
    name: "Q224: total observers - missing reconstruction parts produce mismatch with named field, never throw",
    mutate(fix) {
      fix.phases.chains_small.reconstruction = {};
      fix.phases.chains_volume.reconstruction = {};
    },
  },
  {
    name: "Q224: total observers - missing controls produce mismatch with named field, never throw",
    mutate(fix) {
      delete fix.phases.chains_small.sender.controls;
      delete fix.phases.chains_small.ingress.controls;
    },
  },
];

for (const { name, mutate } of MISSING_PARTS_CASES) {
  test(name, () => assertMissingFieldVerdict(mutate));
}

test("Q224: total observers - missing phases produce mismatch with named field, never throw", () => {
  const verdict = evaluateCases({ observations: {}, expectations: FROZEN_V1 });
  assert.equal(verdict.verdict.matched, 0);
  for (const evaluation of verdict.evaluations) {
    assert.equal(typeof evaluation.observed, "object");
    assert.notEqual(evaluation.observed, null);
  }
});
