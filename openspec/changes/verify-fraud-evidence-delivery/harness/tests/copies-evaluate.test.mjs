import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCases } from "../copies/evaluate.mjs";
import { copiesControls } from "../copies/controls.mjs";
import { jsonFile } from "../lib/io.mjs";
import { passGate } from "../lib/gated-session.mjs";

const FROZEN = jsonFile(new URL("../expectations/copies.v1.json", import.meta.url));

function buildIdentitiesPhase(hash0, hash1, hash2, hashConflict) {
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
      guard_violations: [],
      controls: { write_outside_grant: true, copies_checks: copiesControls() },
    },
    ingress: {
      records: [
        { event_id: "evt_0", attempt: 0, body_sha256: hash0, body: '{"event":{"id":"evt_0"}}', action: "acknowledge", status: 202 },
        { event_id: "evt_0", attempt: 0, body_sha256: hash0, body: '{"event":{"id":"evt_0"}}', action: "acknowledge", status: 202 },
        { event_id: "evt_0", attempt: 0, body_sha256: hashConflict, body: '{"event":{"id":"evt_0"},"port":8443}', action: "status", status: 409 },
        { event_id: "evt_1", attempt: 0, body_sha256: hash1, body: '{"event":{"id":"evt_1"}}', action: "acknowledge", status: 202 },
        { event_id: "evt_2", attempt: 0, body_sha256: hash2, body: '{"event":{"id":"evt_2"}}', action: "status", status: 503 },
        { event_id: "evt_2", attempt: 1, body_sha256: hash2, body: '{"event":{"id":"evt_2"}}', action: "acknowledge", status: 202 },
      ],
      read_back: [
        { event_id: "evt_0", persisted: true, stored_body_sha256: hash0 },
        { event_id: "evt_1", persisted: true, stored_body_sha256: hash1 },
        { event_id: "evt_2", persisted: true, stored_body_sha256: hash2 },
      ],
      controls: { write_outside_grant: true },
    },
  };
}

function buildCollectorRestartPhase(hash0, hash1) {
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
      guard_violations: [],
      controls: { write_outside_grant: true, copies_checks: copiesControls() },
    },
    ingress: {
      read_back: [
        { event_id: "evt_restart_0", persisted: true, stored_body_sha256: hash0 },
        { event_id: "evt_restart_1", persisted: true, stored_body_sha256: hash1 },
      ],
      controls: { write_outside_grant: true },
    },
  };
}

function buildConsumerRestartPhase(hash2) {
  return {
    sender: {
      calls: [
        { label: "consumer_restart_call_0", ok: false },
        { label: "consumer_restart_call_1", ok: false },
        { label: "consumer_restart_call_2", ok: true },
        { label: "consumer_restart_call_3", ok: true },
      ],
      restart_triggered: true,
      delivery_log: [
        { event_id: "evt_cr_0", status: "abandoned" },
        { event_id: "evt_cr_1", status: "abandoned" },
        { event_id: "evt_cr_2", status: "acknowledged" },
        { event_id: "evt_cr_3", status: "acknowledged" },
      ],
      guard_violations: [],
      controls: { write_outside_grant: true, copies_checks: copiesControls() },
    },
    ingress: {
      read_back: [
        { event_id: "evt_cr_2", persisted: true, stored_body_sha256: hash2 },
        { event_id: "evt_cr_3", persisted: true, stored_body_sha256: hash2 },
      ],
      controls: { write_outside_grant: true },
    },
  };
}

function buildStorageLessPhase() {
  return {
    sender: {
      calls: [
        ...Array.from({ length: 32 }, (_, i) => ({ label: `storage_less_call_${i}`, ok: true })),
        { label: "storage_less_call_32", ok: false, error: "SDK_SINK_FAILURE" },
      ],
      guard_violations: [],
      controls: { write_outside_grant: true, copies_checks: copiesControls() },
    },
    ingress: {
      records: [
        ...Array.from({ length: 32 }, (_, i) => ({ event_id: `sl_${i}`, status: 202 })),
        { event_id: "sl_32", status: 503 },
      ],
      read_back: [],
      controls: { write_outside_grant: true },
    },
  };
}

function buildDuplicatesVolumePhase(hash0) {
  return {
    sender: {
      calls: Array.from({ length: 100 }, () => ({ ok: true })),
      guard_violations: [],
      controls: { write_outside_grant: true, copies_checks: copiesControls() },
    },
    ingress: {
      read_back: Array.from({ length: 50 }, (_, i) => ({ event_id: `vol_${i}`, persisted: true, stored_body_sha256: hash0 })),
      controls: { write_outside_grant: true },
    },
  };
}

function honestFixture() {
  const hash0 = "a".repeat(64);
  const hash1 = "b".repeat(64);
  const hash2 = "c".repeat(64);
  const hashConflict = "d".repeat(64);

  return {
    phases: {
      identities: buildIdentitiesPhase(hash0, hash1, hash2, hashConflict),
      collector_restart: buildCollectorRestartPhase(hash0, hash1),
      consumer_restart: buildConsumerRestartPhase(hash2),
      storage_less: buildStorageLessPhase(),
      duplicates_volume: buildDuplicatesVolumePhase(hash0),
    },
  };
}

test("copies controls reject planted defects and pass null controls", () => {
  const result = copiesControls();
  assert.equal(result.changed_byte_defect_detected, true);
  assert.equal(result.duplicate_double_count_defect_detected, true);
  assert.equal(result.null_controls_pass, true);
});

test("an honest run matches every case", () => {
  const observations = honestFixture();
  const result = evaluateCases({ observations, expectations: FROZEN });
  assert.equal(result.verdict.matched, 11);
  assert.equal(result.verdict.mismatched, 0);
  for (const entry of result.evaluations) {
    assert.equal(entry.matched, true, `Case ${entry.case_id} failed`);
  }
});

test("small pass gate succeeds on honest small-pass observations", () => {
  const observations = honestFixture();
  const gate = passGate({ evaluate: evaluateCases, observations, expectations: FROZEN });
  assert.equal(gate.small_matched, true);
  assert.deepEqual(gate.small_mismatched, []);
});

test("planted defect: changed byte classified as duplicate fails C-09", () => {
  const observations = honestFixture();
  observations.phases.identities.sender.controls.copies_checks.changed_byte_defect_detected = false;
  const result = evaluateCases({ observations, expectations: FROZEN });
  const c09 = result.evaluations.find((e) => e.case_id === "C-09");
  assert.equal(c09.matched, false);
});

test("planted defect: duplicate double count fails C-09", () => {
  const observations = honestFixture();
  observations.phases.identities.sender.controls.copies_checks.duplicate_double_count_defect_detected = false;
  const result = evaluateCases({ observations, expectations: FROZEN });
  const c09 = result.evaluations.find((e) => e.case_id === "C-09");
  assert.equal(c09.matched, false);
});

test("planted defect: mismatched body hash fails byte identity C-01", () => {
  const observations = honestFixture();
  observations.phases.identities.ingress.read_back[0].stored_body_sha256 = "x".repeat(64);
  const result = evaluateCases({ observations, expectations: FROZEN });
  const c01 = result.evaluations.find((e) => e.case_id === "C-01");
  assert.equal(c01.matched, false);
});

test("planted defect: attempt field present in body fails C-02", () => {
  const observations = honestFixture();
  observations.phases.identities.ingress.records[0].body = '{"event":{"id":"evt_0"},"attempt":0}';
  const result = evaluateCases({ observations, expectations: FROZEN });
  const c02 = result.evaluations.find((e) => e.case_id === "C-02");
  assert.equal(c02.matched, false);
});

test("planted defect: readmitted duplicate fails C-03", () => {
  const observations = honestFixture();
  observations.phases.identities.ingress.read_back.push({ event_id: "evt_0", persisted: true, stored_body_sha256: "a".repeat(64) });
  const result = evaluateCases({ observations, expectations: FROZEN });
  const c03 = result.evaluations.find((e) => e.case_id === "C-03");
  assert.equal(c03.matched, false);
});

test("planted defect: duplicate inflation in volume pass fails C-11", () => {
  const observations = honestFixture();
  observations.phases.duplicates_volume.ingress.read_back.push({ event_id: "extra", persisted: true });
  const result = evaluateCases({ observations, expectations: FROZEN });
  const c11 = result.evaluations.find((e) => e.case_id === "C-11");
  assert.equal(c11.matched, false);
});
