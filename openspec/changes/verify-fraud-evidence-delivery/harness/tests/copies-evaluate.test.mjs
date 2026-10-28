import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import net from "node:net";
import { test } from "node:test";
import { evaluateCases } from "../copies/evaluate.mjs";
import { copiesControls } from "../copies/controls.mjs";
import { computeAccounting } from "../copies/observations.mjs";
import { jsonFile } from "../lib/io.mjs";
import { passGate } from "../lib/gated-session.mjs";
import { installLoopbackGuard } from "../lib/loopback-guard.mjs";
import { dottedReads, resolves } from "./field-reads.mjs";
import { findDottedRoots } from "./copies-parity.mjs";
import { runRehearsal } from "./copies-fakes.mjs";

const FROZEN_V2 = jsonFile(new URL("../expectations/copies.v2.json", import.meta.url));

function makeHonestControls() {
  return {
    sender: {
      loopback_guard: { holds: true, planted: { refused: true, fired: true }, null_control: { connected: true, silent: true } },
      write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true },
      synthetic_data: { holds: true, planted_refused: true, null_control_passed: true },
      copies_checks: copiesControls(),
    },
    ingress: {
      write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true },
    },
  };
}

function buildIdentitiesPhase({ hash0, hash1, hash2, hashConflict, controls }) {
  const cloned = structuredClone(controls ?? makeHonestControls());
  return {
    sender: {
      calls: [
        { label: "clean_submission", ok: true },
        { label: "duplicate_submission", ok: true },
        { label: "conflict_submission", ok: false },
        { label: "re_execution_submission", ok: true },
        { label: "retry_redelivery_submission", ok: true },
      ],
      exchanges: [
        { event_id: "evt_0", attempt: 0, body_sha256: hash0 },
        { event_id: "evt_0", attempt: 0, body_sha256: hash0 },
        { event_id: "evt_0", attempt: 0, body_sha256: hashConflict },
        { event_id: "evt_1", attempt: 0, body_sha256: hash1 },
        { event_id: "evt_2", attempt: 0, body_sha256: hash2 },
        { event_id: "evt_2", attempt: 1, body_sha256: hash2 },
      ],
      delivery_log: [
        { event_id: "evt_0", status: "acknowledged" },
        { event_id: "evt_0", status: "acknowledged" },
        { event_id: "evt_0", status: "non_retryable" },
        { event_id: "evt_1", status: "acknowledged" },
        { event_id: "evt_2", status: "acknowledged" },
      ],
      guard_violations: [{ host: "192.0.2.1", stage: "before_connect" }],
      controls: cloned.sender,
    },
    ingress: {
      records: [
        { event_id: "evt_0", occurrence: 1, attempt: 0, body_sha256: hash0, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
        { event_id: "evt_0", occurrence: 1, attempt: 1, body_sha256: hash0, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "duplicate" } },
        { event_id: "evt_0", occurrence: 1, attempt: 2, body_sha256: hashConflict, action: "status", status: 409, retry_attempt: 0, original_event_id: null, outcome: { kind: "rejected", code: "COLLECTOR_STORAGE_CONFLICT" } },
        { event_id: "evt_1", occurrence: 2, attempt: 0, body_sha256: hash1, action: "acknowledge", status: 202, retry_attempt: 1, original_event_id: "evt_0", outcome: { kind: "persisted" } },
        { event_id: "evt_2", occurrence: 3, attempt: 0, body_sha256: hash2, action: "status", status: 503, retry_attempt: 0, original_event_id: null, outcome: { kind: "not_ingested" } },
        { event_id: "evt_2", occurrence: 3, attempt: 1, body_sha256: hash2, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
      ],
      read_back: [
        { event_id: "evt_0", persisted: true, stored_body_sha256: hash0 },
        { event_id: "evt_1", persisted: true, stored_body_sha256: hash1 },
        { event_id: "evt_2", persisted: true, stored_body_sha256: hash2 },
      ],
      controls: cloned.ingress,
    },
  };
}

function buildCollectorRestartPhase({ hash0, hash1, controls }) {
  const cloned = structuredClone(controls ?? makeHonestControls());
  return {
    sender: {
      calls: [
        { label: "before_restart_submission", ok: true },
        { label: "duplicate_across_restart_submission", ok: true },
        { label: "fresh_after_restart_submission", ok: true },
      ],
      exchanges: [
        { event_id: "evt_restart_0", attempt: 0, body_sha256: hash0 },
        { event_id: "evt_restart_0", attempt: 0, body_sha256: hash0 },
        { event_id: "evt_restart_1", attempt: 0, body_sha256: hash1 },
      ],
      guard_violations: [{ host: "192.0.2.1", stage: "before_connect" }],
      controls: cloned.sender,
    },
    ingress: {
      records: [
        { event_id: "evt_restart_0", occurrence: 1, attempt: 0, body_sha256: hash0, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
        { event_id: "evt_restart_0", occurrence: 1, attempt: 0, body_sha256: hash0, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "duplicate" } },
        { event_id: "evt_restart_1", occurrence: 2, attempt: 0, body_sha256: hash1, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
      ],
      read_back: [
        { event_id: "evt_restart_0", persisted: true, stored_body_sha256: hash0 },
        { event_id: "evt_restart_1", persisted: true, stored_body_sha256: hash1 },
      ],
      restarts: [
        { before_record_count: 1, storage_closed: true, storage_reopened: true },
      ],
      controls: cloned.ingress,
    },
  };
}

function buildConsumerRestartPhase({ hash2, controls }) {
  const cloned = structuredClone(controls ?? makeHonestControls());
  return {
    sender: {
      calls: [
        { label: "consumer_restart_call_0", ok: true },
        { label: "consumer_restart_call_1", ok: true },
        { label: "consumer_restart_call_2", ok: true },
        { label: "consumer_restart_call_3", ok: true },
        { label: "consumer_restart_redelivery_0", ok: true },
        { label: "consumer_restart_redelivery_1", ok: true },
      ],
      deliveries: {
        evt_cr_0: { status: "acknowledged", attempts: 1 },
        evt_cr_1: { status: "acknowledged", attempts: 1 },
        evt_cr_2: { status: "acknowledged", attempts: 1 },
        evt_cr_3: { status: "acknowledged", attempts: 1 },
      },
      exchanges: [
        { event_id: "evt_cr_0", attempt: 0, body_sha256: hash2 },
        { event_id: "evt_cr_1", attempt: 0, body_sha256: hash2 },
        { event_id: "evt_cr_2", attempt: 0, body_sha256: hash2 },
        { event_id: "evt_cr_3", attempt: 0, body_sha256: hash2 },
        { event_id: "evt_cr_0", attempt: 0, body_sha256: hash2 },
        { event_id: "evt_cr_1", attempt: 0, body_sha256: hash2 },
      ],
      delivery_log: [
        { event_id: "evt_cr_0", status: "abandoned" },
        { event_id: "evt_cr_1", status: "abandoned" },
        { event_id: "evt_cr_2", status: "acknowledged" },
        { event_id: "evt_cr_3", status: "acknowledged" },
        { event_id: "evt_cr_0", status: "acknowledged" },
        { event_id: "evt_cr_1", status: "acknowledged" },
      ],
      health: {
        before_restart: { abandoned: 2, accepted: 4, completed: 2 },
        after_restart: { abandoned: 0, accepted: 2, completed: 2 },
      },
      fenced_attempts: [
        { event_id: "evt_cr_0", attempt: 1 },
        { event_id: "evt_cr_1", attempt: 1 },
      ],
      exchanges_at_shutdown: 4,
      comp1_exchanges_count: 4,
      restart_triggered: true,
      guard_violations: [{ host: "192.0.2.1", stage: "before_connect" }],
      controls: cloned.sender,
    },
    ingress: {
      records: [
        { event_id: "evt_cr_0", occurrence: 1, attempt: 0, body_sha256: hash2, status: 503, retry_attempt: 0, original_event_id: null, outcome: { kind: "not_ingested" } },
        { event_id: "evt_cr_1", occurrence: 2, attempt: 0, body_sha256: hash2, status: 503, retry_attempt: 0, original_event_id: null, outcome: { kind: "not_ingested" } },
        { event_id: "evt_cr_2", occurrence: 3, attempt: 0, body_sha256: hash2, status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
        { event_id: "evt_cr_3", occurrence: 4, attempt: 0, body_sha256: hash2, status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
        { event_id: "evt_cr_0", occurrence: 1, attempt: 0, body_sha256: hash2, status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
        { event_id: "evt_cr_1", occurrence: 2, attempt: 0, body_sha256: hash2, status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" } },
      ],
      read_back: [
        { event_id: "evt_cr_0", persisted: true, stored_body_sha256: hash2 },
        { event_id: "evt_cr_1", persisted: true, stored_body_sha256: hash2 },
        { event_id: "evt_cr_2", persisted: true, stored_body_sha256: hash2 },
        { event_id: "evt_cr_3", persisted: true, stored_body_sha256: hash2 },
      ],
      controls: cloned.ingress,
    },
  };
}

function buildStorageLessPhase({ controls } = {}) {
  const cloned = structuredClone(controls ?? makeHonestControls());
  const hash0 = "a".repeat(64);
  return {
    sender: {
      calls: [
        ...Array.from({ length: 32 }, (_, i) => ({ label: `storage_less_call_${i}`, ok: true })),
        { label: "storage_less_call_32", ok: false },
      ],
      health: { accepted: 33, completed: 33, abandoned: 0 },
      guard_violations: [{ host: "192.0.2.1", stage: "before_connect" }],
      controls: cloned.sender,
    },
    ingress: {
      records: [
        ...Array.from({ length: 32 }, (_, i) => ({
          event_id: `sl_${i}`, occurrence: i + 1, attempt: 0, body_sha256: hash0, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "admitted" },
        })),
        {
          event_id: "sl_32", occurrence: 33, attempt: 0, body_sha256: hash0, action: "status", status: 503, retry_attempt: 0, original_event_id: null, outcome: { kind: "rejected", code: "COLLECTOR_DEDUPLICATION_CAPACITY" },
        },
      ],
      read_back: [],
      controls: cloned.ingress,
    },
  };
}

function buildDuplicatesVolumePhase({ hash0, controls }) {
  const cloned = structuredClone(controls ?? makeHonestControls());
  return {
    sender: {
      calls: Array.from({ length: 100 }, () => ({ ok: true })),
      exchanges: Array.from({ length: 100 }, (_, i) => ({
        event_id: `vol_${i % 50}`, attempt: 0, body_sha256: hash0,
      })),
      guard_violations: [{ host: "192.0.2.1", stage: "before_connect" }],
      controls: cloned.sender,
    },
    ingress: {
      records: [
        ...Array.from({ length: 50 }, (_, i) => ({
          event_id: `vol_${i}`, occurrence: i + 1, attempt: 0, body_sha256: hash0, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" },
        })),
        ...Array.from({ length: 50 }, (_, i) => ({
          event_id: `vol_${i}`, occurrence: i + 1, attempt: 0, body_sha256: hash0, action: "acknowledge", status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "duplicate" },
        })),
      ],
      read_back: Array.from({ length: 50 }, (_, i) => ({ event_id: `vol_${i}`, persisted: true, stored_body_sha256: hash0 })),
      controls: cloned.ingress,
    },
  };
}

function honestFixture(controls) {
  const baseControls = controls ?? makeHonestControls();
  const hash0 = "a".repeat(64);
  const hash1 = "b".repeat(64);
  const hash2 = "c".repeat(64);
  const hashConflict = "d".repeat(64);

  return {
    phases: {
      identities: buildIdentitiesPhase({ hash0, hash1, hash2, hashConflict, controls: structuredClone(baseControls) }),
      collector_restart: buildCollectorRestartPhase({ hash0, hash1, controls: structuredClone(baseControls) }),
      consumer_restart: buildConsumerRestartPhase({ hash2, controls: structuredClone(baseControls) }),
      storage_less: buildStorageLessPhase({ controls: structuredClone(baseControls) }),
      duplicates_volume: buildDuplicatesVolumePhase({ hash0, controls: structuredClone(baseControls) }),
    },
  };
}

test("copies controls reject planted defects and pass null controls", () => {
  const result = copiesControls();
  assert.equal(result.changed_byte_defect_detected, true);
  assert.equal(result.duplicate_double_count_defect_detected, true);
  assert.equal(result.null_controls_pass, true);
  assert.equal(result.holds, true);
});

test("an honest run matches every case", () => {
  const observations = honestFixture();
  const result = evaluateCases({ observations, expectations: FROZEN_V2 });
  assert.equal(result.verdict.matched, 11);
  assert.equal(result.verdict.mismatched, 0);
  for (const entry of result.evaluations) {
    assert.equal(entry.matched, true, `Case ${entry.case_id} failed`);
  }
});

test("small pass gate succeeds on honest small-pass observations", () => {
  const observations = honestFixture();
  const gate = passGate({ evaluate: evaluateCases, observations, expectations: FROZEN_V2 });
  assert.equal(gate.small_matched, true);
  assert.deepEqual(gate.small_mismatched, []);
});

test("real-data regression from run 6: C-01, C-02, C-04, C-05, C-06, C-07 fail; C-03, C-08, C-09, C-10 match", () => {
  const run6 = jsonFile(new URL("../results/copies-run-6.json", import.meta.url));
  const observations = { phases: run6.observations.phases };
  const evaluated = evaluateCases({ observations, expectations: FROZEN_V2, pass: "small" });

  const c01 = evaluated.evaluations.find((e) => e.case_id === "C-01");
  assert.equal(c01.matched, false, "C-01 fails because run 6 never executed the scheduled retry");

  const c02 = evaluated.evaluations.find((e) => e.case_id === "C-02");
  assert.equal(c02.matched, false, "C-02 fails because run 6 ingress records carry no retry_attempt correlation data");

  const c03 = evaluated.evaluations.find((e) => e.case_id === "C-03");
  assert.equal(c03.matched, true, "C-03 matches because run 6 duplicate copy was acknowledged without increasing stored count");

  const c04 = evaluated.evaluations.find((e) => e.case_id === "C-04");
  assert.equal(c04.matched, false, "C-04 fails because run 6 produced a 422 schema validation rejection instead of a storage conflict");

  const c05 = evaluated.evaluations.find((e) => e.case_id === "C-05");
  assert.equal(c05.matched, false, "C-05 fails because run 6 carries no retry correlation on the re-execution record");

  const c06 = evaluated.evaluations.find((e) => e.case_id === "C-06");
  assert.equal(c06.matched, false, "C-06 fails because run 6 restart dropped duplicate classification in ingress records");

  const c07 = evaluated.evaluations.find((e) => e.case_id === "C-07");
  assert.equal(c07.matched, false, "C-07 fails because run 6 performed no redelivery of unacknowledged occurrences");

  const c08 = evaluated.evaluations.find((e) => e.case_id === "C-08");
  assert.equal(c08.matched, true, "C-08 matches because run 6 storage-less deduplication admitted 32 identities and rejected the 33rd at capacity");

  const c09 = evaluated.evaluations.find((e) => e.case_id === "C-09");
  assert.equal(c09.matched, true, "C-09 matches because run 6 pre-traffic controls detected planted defects and passed null controls");

  const c10 = evaluated.evaluations.find((e) => e.case_id === "C-10");
  assert.equal(c10.matched, true, "C-10 matches because run 6 satisfied D5 with all controls holding and exactly one planted 192.0.2.1 violation");
});

const STRICT_DOTTED_TARGETS = Object.freeze(new Set([
  "phase", "sender", "ingress", "checks", "config", "accounting", "health",
  "call", "exchange", "duplicate", "entry", "record", "stored", "restart", "violation",
]));

function extractDottedPaths(text, name) {
  const pattern = new RegExp(`(?<![\\.\\?a-zA-Z0-9_$])\\b${name}((?:\\.[a-z0-9_]+)+)`, "g");
  return new Set([...text.matchAll(pattern)].map((match) => match[1].slice(1)));
}

function assertAliasPathsResolve({ text, name, objects }) {
  const isStrict = STRICT_DOTTED_TARGETS.has(name);
  const paths = isStrict ? dottedReads({ text, name }) : extractDottedPaths(text, name);
  assert(paths.size > 0, `must find ${name} reads in code`);
  for (const path of paths) {
    const found = objects.some((obj) => resolves({ object: obj, path }));
    assert(found, `${name} lacks field path: ${path}`);
  }
}

test("field-read parity covers the whole copies/evaluate.mjs file", { timeout: 15000 }, async () => {
  const evaluateText = readFileSync(new URL("../copies/evaluate.mjs", import.meta.url), "utf8");
  const observationsText = readFileSync(new URL("../copies/observations.mjs", import.meta.url), "utf8");
  const codeText = `${evaluateText}\n${observationsText}`.replace(/^\s*import\b.*?;\s*$/gm, "");

  const seenViolations = [];
  const guard = installLoopbackGuard({ onViolation: (v) => seenViolations.push(v) });
  try {
    const s = new net.Socket();
    s.on("error", () => {});
    s.connect(80, "192.0.2.1");
    s.destroy();
  } finally {
    guard.uninstall();
  }

  const rehearsal = await runRehearsal();
  const allPhases = Object.values(rehearsal.phases);
  const allSenders = allPhases.map((p) => p.sender).filter(Boolean);
  const allIngresses = allPhases.map((p) => p.ingress).filter(Boolean);

  const targets = {
    phase: allPhases,
    sender: allSenders,
    ingress: allIngresses,
    checks: allSenders.map((s) => s.controls?.copies_checks).filter(Boolean),
    config: FROZEN_V2.phases,
    accounting: allPhases.map((p) => computeAccounting(p, 4)).filter(Boolean),
    health: allSenders.map((s) => s.health).filter(Boolean),
    call: allSenders.flatMap((s) => s.calls ?? []),
    exchange: allSenders.flatMap((s) => s.exchanges ?? []),
    duplicate: allSenders.flatMap((s) => s.exchanges ?? []),
    entry: allSenders.flatMap((s) => [...(s.delivery_log ?? []), ...(s.fenced_attempts ?? [])]),
    record: allIngresses.flatMap((i) => i.records ?? []),
    stored: allIngresses.flatMap((i) => i.read_back ?? []),
    restart: allIngresses.flatMap((i) => i.restarts ?? []),
    violation: seenViolations,
    records: allIngresses.map((i) => i.records).filter(Boolean),
    exchanges: allSenders.map((s) => s.exchanges).filter(Boolean),
    calls: allSenders.map((s) => s.calls).filter(Boolean),
    fenced: allSenders.map((s) => s.fenced_attempts).filter(Boolean),
    matching: allIngresses.map((i) => i.records).filter(Boolean),
    matchingRecords: allIngresses.map((i) => i.records).filter(Boolean),
    redelivered: allSenders.map((s) => s.calls).filter(Boolean),
    readBack: allIngresses.map((i) => i.read_back).filter(Boolean),
    restarts: allIngresses.map((i) => i.restarts).filter(Boolean),
    violations: [seenViolations],
    observed: [rehearsal.phases],
    observations: [rehearsal],
    group: allIngresses.map((i) => i.records).filter(Boolean),
    initialDeliveries: allSenders.map((s) => s.delivery_log).filter(Boolean),
    redeliveries: allSenders.map((s) => s.calls).filter(Boolean),
    retriedIds: [["evt_1", "evt_2"]],
    redeliveredIds: [["evt_cr_0", "evt_cr_1"]],
    counts: [new Map()],
  };

  for (const [name, objects] of Object.entries(targets)) {
    assertAliasPathsResolve({ text: codeText, name, objects });
  }

  const declaredAliases = new Set(Object.keys(targets));
  const allowedNonObservation = new Set([
    "Math",
    "Object",
    "Number",
    "Array",
    "JSON",
    "Set",
    "Map",
    "String",
    "DELIVERED",
    "expectations",
    "caseDef",
    "cases",
    "phaseConfig",
    "evaluation",
    "evaluations",
    "allPhases",
    "allSenders",
    "allIngresses",
    "seenViolations",
    "uniqueIds",
    "phaseList",
    "schedule",
    "allowed",
    "label",
    "ids",
  ]);

  const roots = findDottedRoots(codeText);
  assert(roots.size > 0, "must find dotted roots in code");

  for (const root of roots) {
    const isDeclared = declaredAliases.has(root);
    const isAllowed = allowedNonObservation.has(root);
    assert(isDeclared || isAllowed, `undeclared blind root found in code: ${root}`);
  }
});

test("field-read parity scanner rejects undeclared root", () => {
  const badCode = "const x = mystery.property;";
  const roots = findDottedRoots(badCode);
  const allowed = new Set(["phase", "sender"]);
  const hasUndeclared = [...roots].some((r) => !allowed.has(r));
  assert.equal(hasUndeclared, true);
});

test("field-read parity rejects renamed control paths", () => {
  const badText = 'const loopback = phase.sender.controls.loopback_guard.held === true;';
  const paths = dottedReads({ text: badText, name: "phase" });
  const honest = honestFixture();
  const allPhases = Object.values(honest.phases);
  for (const path of paths) {
    const found = allPhases.some((phase) => resolves({ object: phase, path }));
    assert.equal(found, false, "renamed control path should not resolve");
  }
});

test("dottedReads rejects bracket access including optional bracket reads (Q124)", () => {
  assert.throws(() => dottedReads({ text: 'const x = record["test"];', name: "record" }), /dotted access/);
  assert.throws(() => dottedReads({ text: 'const x = record?.["test"];', name: "record" }), /dotted access/);
  assert.throws(() => dottedReads({ text: 'const x = phase?.[name];', name: "phase" }), /dotted access/);
  assert.throws(() => dottedReads({ text: 'const x = phase?.sender;', name: "phase" }), /dotted access/);
});

test("C-02 independent evaluation and planted defect tests (Q120)", () => {
  const honest = honestFixture();
  const resHonest = evaluateCases({ observations: honest, expectations: FROZEN_V2 });
  const c02Honest = resHonest.evaluations.find((e) => e.case_id === "C-02");
  assert.equal(c02Honest.matched, true);

  const bodyDefect = honestFixture();
  const retryRec = bodyDefect.phases.identities.ingress.records.find((r) => r.occurrence === 3 && r.attempt === 1);
  retryRec.body_sha256 = "x".repeat(64);
  const resBodyDef = evaluateCases({ observations: bodyDefect, expectations: FROZEN_V2 });
  const c02BodyDef = resBodyDef.evaluations.find((e) => e.case_id === "C-02");
  assert.equal(c02BodyDef.matched, false);
  assert.equal(c02BodyDef.observed.retry_attempt_constant_across_attempts, true);
  assert.equal(c02BodyDef.observed.body_identical_across_attempts, false);

  const retryDefect = honestFixture();
  const retryRec2 = retryDefect.phases.identities.ingress.records.find((r) => r.occurrence === 3 && r.attempt === 1);
  retryRec2.retry_attempt = 9;
  const resRetryDef = evaluateCases({ observations: retryDefect, expectations: FROZEN_V2 });
  const c02RetryDef = resRetryDef.evaluations.find((e) => e.case_id === "C-02");
  assert.equal(c02RetryDef.matched, false);
  assert.equal(c02RetryDef.observed.retry_attempt_constant_across_attempts, false);
  assert.equal(c02RetryDef.observed.body_identical_across_attempts, true);

  const noRetry = honestFixture();
  noRetry.phases.identities.sender.exchanges = noRetry.phases.identities.sender.exchanges.map((ex) => ({ ...ex, attempt: 0 }));
  const resNoRetry = evaluateCases({ observations: noRetry, expectations: FROZEN_V2 });
  const c02NoRetry = resNoRetry.evaluations.find((e) => e.case_id === "C-02");
  assert.equal(c02NoRetry.matched, false);
  assert.equal(c02NoRetry.observed.multi_attempt_occurrences, 0);
  assert.equal(c02NoRetry.observed.retry_attempt_constant_across_attempts, false);
  assert.equal(c02NoRetry.observed.body_identical_across_attempts, false);
});

test("C-06 collector restart planted defects (Q117, Q132, Q165)", () => {
  const noRestart = honestFixture();
  noRestart.phases.collector_restart.ingress.restarts = [];
  const resNoRest = evaluateCases({ observations: noRestart, expectations: FROZEN_V2 });
  const c06NoRest = resNoRest.evaluations.find((e) => e.case_id === "C-06");
  assert.equal(c06NoRest.matched, false);

  const dupBeforeBoundary = honestFixture();
  dupBeforeBoundary.phases.collector_restart.ingress.restarts[0].before_record_count = 2;
  const resDupBefore = evaluateCases({ observations: dupBeforeBoundary, expectations: FROZEN_V2 });
  const c06DupBefore = resDupBefore.evaluations.find((e) => e.case_id === "C-06");
  assert.equal(c06DupBefore.matched, false);
  assert.equal(c06DupBefore.observed.duplicate_at_or_after_boundary, false);

  const closedDefect = honestFixture();
  closedDefect.phases.collector_restart.ingress.restarts[0].storage_closed = false;
  const resClosed = evaluateCases({ observations: closedDefect, expectations: FROZEN_V2 });
  const c06Closed = resClosed.evaluations.find((e) => e.case_id === "C-06");
  assert.equal(c06Closed.matched, false);
  assert.equal(c06Closed.observed.storage_closed, false);

  const reopenedDefect = honestFixture();
  reopenedDefect.phases.collector_restart.ingress.restarts[0].storage_reopened = false;
  const resReopened = evaluateCases({ observations: reopenedDefect, expectations: FROZEN_V2 });
  const c06Reopened = resReopened.evaluations.find((e) => e.case_id === "C-06");
  assert.equal(c06Reopened.matched, false);
  assert.equal(c06Reopened.observed.storage_reopened, false);

  const missingBeforeCount = honestFixture();
  delete missingBeforeCount.phases.collector_restart.ingress.restarts[0].before_record_count;
  const resMissing = evaluateCases({ observations: missingBeforeCount, expectations: FROZEN_V2 });
  const c06Missing = resMissing.evaluations.find((e) => e.case_id === "C-06");
  assert.equal(c06Missing.matched, false);
  assert.equal(c06Missing.observed.persisted_before_boundary, false);

  const exceedingBeforeCount = honestFixture();
  exceedingBeforeCount.phases.collector_restart.ingress.restarts[0].before_record_count = 999;
  const resExceeding = evaluateCases({ observations: exceedingBeforeCount, expectations: FROZEN_V2 });
  const c06Exceeding = resExceeding.evaluations.find((e) => e.case_id === "C-06");
  assert.equal(c06Exceeding.matched, false);
  assert.equal(c06Exceeding.observed.persisted_before_boundary, false);
});

test("C-07 consumer restart planted defects (Q116, Q130)", () => {
  const honest = honestFixture();
  const posEval = evaluateCases({ observations: honest, expectations: FROZEN_V2 });
  const c07Pos = posEval.evaluations.find((e) => e.case_id === "C-07");
  assert.equal(c07Pos.matched, true);

  const noRedeliv = honestFixture();
  noRedeliv.phases.consumer_restart.sender.calls = noRedeliv.phases.consumer_restart.sender.calls.slice(0, 4);
  noRedeliv.phases.consumer_restart.sender.exchanges = noRedeliv.phases.consumer_restart.sender.exchanges.slice(0, 4);
  const resNoRedeliv = evaluateCases({ observations: noRedeliv, expectations: FROZEN_V2 });
  const c07NoRedeliv = resNoRedeliv.evaluations.find((e) => e.case_id === "C-07");
  assert.equal(c07NoRedeliv.matched, false);

  const changedBody = honestFixture();
  changedBody.phases.consumer_restart.sender.exchanges[4].body_sha256 = "x".repeat(64);
  const resChangedBody = evaluateCases({ observations: changedBody, expectations: FROZEN_V2 });
  const c07ChangedBody = resChangedBody.evaluations.find((e) => e.case_id === "C-07");
  assert.equal(c07ChangedBody.matched, false);
  assert.equal(c07ChangedBody.observed.redeliveries_match_first_exchange, false);

  const notPersisted = honestFixture();
  notPersisted.phases.consumer_restart.ingress.read_back = notPersisted.phases.consumer_restart.ingress.read_back.filter((s) => s.event_id !== "evt_cr_0");
  const resNotPersisted = evaluateCases({ observations: notPersisted, expectations: FROZEN_V2 });
  const c07NotPersisted = resNotPersisted.evaluations.find((e) => e.case_id === "C-07");
  assert.equal(c07NotPersisted.matched, false);
  assert.equal(c07NotPersisted.observed.redeliveries_persisted, false);

  const fencedReached = honestFixture();
  fencedReached.phases.consumer_restart.ingress.records.push({
    event_id: "evt_cr_0", occurrence: 1, attempt: 1, body_sha256: "c".repeat(64), status: 202, retry_attempt: 0, original_event_id: null, outcome: { kind: "persisted" },
  });
  const resFenced = evaluateCases({ observations: fencedReached, expectations: FROZEN_V2 });
  const c07Fenced = resFenced.evaluations.find((e) => e.case_id === "C-07");
  assert.equal(c07Fenced.matched, false);
  assert.equal(c07Fenced.observed.fenced_produced_no_ingress, false);
});

function assertSingleMismatch(observations, expectedMismatchCaseId) {
  const verdict = evaluateCases({ observations, expectations: FROZEN_V2 });
  assert.equal(verdict.verdict.matched, 10, `Expected exactly 10 matched, got ${verdict.verdict.matched}`);
  assert.equal(verdict.verdict.mismatched, 1, `Expected exactly 1 mismatch, got ${verdict.verdict.mismatched}`);
  const failed = verdict.evaluations.find((e) => !e.matched);
  assert.equal(failed?.case_id, expectedMismatchCaseId);
}

test("controls must be read with === true only (Q127, Q137)", () => {
  for (const nonBoolean of [1, "true", {}]) {
    const defLoopback = honestFixture();
    defLoopback.phases.identities.sender.controls.loopback_guard.holds = nonBoolean;
    assertSingleMismatch(defLoopback, "C-10");

    const defSenderWrite = honestFixture();
    defSenderWrite.phases.identities.sender.controls.write_outside_grant.holds = nonBoolean;
    assertSingleMismatch(defSenderWrite, "C-10");

    const defIngressWrite = honestFixture();
    defIngressWrite.phases.identities.ingress.controls.write_outside_grant.holds = nonBoolean;
    assertSingleMismatch(defIngressWrite, "C-10");

    const defSynthetic = honestFixture();
    defSynthetic.phases.identities.sender.controls.synthetic_data.holds = nonBoolean;
    assertSingleMismatch(defSynthetic, "C-10");

    const defByte = honestFixture();
    defByte.phases.identities.sender.controls.copies_checks.changed_byte_defect_detected = nonBoolean;
    assertSingleMismatch(defByte, "C-09");

    const defDup = honestFixture();
    defDup.phases.identities.sender.controls.copies_checks.duplicate_double_count_defect_detected = nonBoolean;
    assertSingleMismatch(defDup, "C-09");

    const defNull = honestFixture();
    defNull.phases.identities.sender.controls.copies_checks.null_controls_pass = nonBoolean;
    assertSingleMismatch(defNull, "C-09");
  }

  const fresh = honestFixture();
  const verdict = evaluateCases({ observations: fresh, expectations: FROZEN_V2 });
  assert.equal(verdict.verdict.matched, 11);
  assert.equal(verdict.verdict.mismatched, 0);
});
