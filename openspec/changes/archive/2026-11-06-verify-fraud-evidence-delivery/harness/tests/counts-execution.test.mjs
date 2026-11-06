import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCases } from "../counts/evaluate.mjs";
import { producerFixture } from "./counts-fixture.mjs";
import { FROZEN } from "./counts-rehearsal.mjs";

async function detects(plant) {
  const observations = await producerFixture();
  assert.deepEqual(evaluateCases({ observations, expectations: FROZEN }).verdict, { matched: 10, mismatched: 0 });
  plant(observations);
  const result = evaluateCases({ observations, expectations: FROZEN });
  assert.equal(result.evaluations.find((entry) => entry.case_id === "N-01").matched, false);
}

function removeRecords(phase, predicate) {
  phase.ingress.records = phase.ingress.records.filter((record) => !predicate(record));
}

const duplicate = (record) => record.outcome.kind === "duplicate" && record.status === 202;

test("N-01 refuses duplicates_volume with every duplicate record removed", async () => {
  await detects((observations) => removeRecords(observations.phases.copies_duplicates_volume, duplicate));
});

test("N-01 refuses duplicates_volume with only one occurrence's duplicate removed", async () => {
  await detects((observations) => removeRecords(observations.phases.copies_duplicates_volume,
    (record) => record.occurrence === 1 && duplicate(record)));
});

test("N-01 refuses identities without occurrence one's duplicate", async () => {
  await detects((observations) => removeRecords(observations.phases.copies_identities,
    (record) => record.occurrence === 1 && duplicate(record)));
});

test("N-01 refuses identities without occurrence one's 409 rejection", async () => {
  await detects((observations) => removeRecords(observations.phases.copies_identities,
    (record) => record.occurrence === 1 && record.outcome.kind === "rejected" && record.status === 409));
});

test("N-01 refuses identities when the re-execution retry_attempt is cleared", async () => {
  await detects((observations) => {
    const records = observations.phases.copies_identities.ingress.records;
    const original = records.find((record) => record.occurrence === 1).event_id;
    for (const record of records) {
      if (record.original_event_id === original) record.retry_attempt = null;
    }
  });
});

test("N-01 refuses collector_restart without a restart entry", async () => {
  await detects((observations) => { observations.phases.copies_collector_restart.ingress.restarts = []; });
});

test("N-01 refuses collector_restart without occurrence one's duplicate", async () => {
  await detects((observations) => removeRecords(observations.phases.copies_collector_restart,
    (record) => record.occurrence === 1 && duplicate(record)));
});

test("N-01 refuses collector_restart when the duplicate precedes the restart boundary", async () => {
  await detects((observations) => {
    const ingress = observations.phases.copies_collector_restart.ingress;
    const index = ingress.records.findIndex((record) => record.occurrence === 1 && duplicate(record));
    assert(index >= 0);
    ingress.restarts[0].before_record_count = index + 1;
  });
});

test("N-01 refuses consumer_restart when restart_triggered is false", async () => {
  await detects((observations) => { observations.phases.copies_consumer_restart.sender.restart_triggered = false; });
});

test("N-01 refuses the combined missing copies steps and raw duplicate sightings", async () => {
  await detects((observations) => {
    for (const name of ["copies_duplicates_volume", "copies_identities", "copies_collector_restart"]) {
      const phase = observations.phases[name];
      const original = phase.ingress.records.find((record) => record.occurrence === 1).event_id;
      for (const record of phase.ingress.records) {
        if (record.original_event_id === original) record.retry_attempt = null;
      }
      removeRecords(phase, (record) => duplicate(record) || record.status === 409);
      phase.ingress.raw_persisted_bodies = [...new Map(phase.ingress.raw_persisted_bodies.map((body) => [body.event.id, body])).values()];
    }
    observations.phases.copies_collector_restart.ingress.restarts = [];
  });
});
