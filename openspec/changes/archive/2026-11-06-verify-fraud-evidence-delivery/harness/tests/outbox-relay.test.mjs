// Relay engine tests for Stage 2 outbox probe (#842, Q247, Q248, Q250).
// Covers ack-before-mark, crash mid-drain and restart resume, mark-before-ack defect, and outage deferral.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { openHostDatabase } from "../outbox/host.mjs";
import { executePhaseRelay } from "../outbox/phase-relay.mjs";
import { drainMarkBeforeAck, drainPendingOutbox, RelayCrashError } from "../outbox/relay.mjs";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "outbox-relay-test-"));
}

function populateHostOutbox(host, count) {
  host.begin();
  for (let i = 0; i < count; i += 1) {
    const eventId = `evt-${i}`;
    const txId = `tx-${i}`;
    const body = JSON.stringify({
      id: eventId,
      event: { id: eventId },
      correlation: { transaction_id: txId },
    });
    host.insertBusiness({ id: `biz-${i}` });
    host.insertOutbox({ event_id: eventId, transaction_id: txId, body });
  }
  host.commit();
}

function makeMockComposition(responses = []) {
  let callIndex = 0;
  const delivered = [];
  return {
    delivered,
    async deliver(event) {
      delivered.push({ event, callIndex });
      const resp = responses[callIndex] ?? { status: "acknowledged" };
      callIndex += 1;
      if (resp.error) throw resp.error;
      return resp;
    },
  };
}

async function dummyRecordCall({ ledger, label, invoke }) {
  ledger.take(label);
  const result = await invoke();
  return { label, ok: result.ok, value: result.value, error: result.error };
}

test("relay marks row relayed only after exact persisted acknowledgment", async () => {
  const dir = makeTempDir();
  try {
    const host = openHostDatabase({ directory: dir, name: "ack_test" });
    populateHostOutbox(host, 3);

    const comp = makeMockComposition([
      { status: "acknowledged" },
      { status: "accepted" }, // A sink acceptance is not a persisted acknowledgment
      { status: "acknowledged" },
    ]);
    const ledger = occurrenceLedger({ budget: 10 });

    await drainPendingOutbox({
      host,
      composition: comp,
      ledger,
      getLabel: (index) => `relay_call_${ledger.report().occurrence_count}_${index}`,
      recordCall: dummyRecordCall,
    });

    const pending = host.pendingOutboxRows();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].event_id, "evt-1");

    assert.equal(host.counts().relayed_outbox, 2);
    host.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("in-process crash after acknowledgment before mark resumes and redelivers row k", async () => {
  const dir = makeTempDir();
  try {
    const host1 = openHostDatabase({ directory: dir, name: "crash_test" });
    populateHostOutbox(host1, 6);

    const comp = makeMockComposition();
    const ledger = occurrenceLedger({ budget: 20 });

    // Drain with crash after 3rd acknowledgment (index 2) before marking
    let crashFired = false;
    try {
      await drainPendingOutbox({
        host: host1,
        composition: comp,
        ledger,
        getLabel: (index) => `relay_call_${ledger.report().occurrence_count}_${index}`,
        recordCall: dummyRecordCall,
        onBeforeMark: async ({ index }) => {
          if (index === 2) {
            throw new RelayCrashError("disclosed in-process crash");
          }
        },
      });
    } catch (err) {
      assert(err instanceof RelayCrashError);
      crashFired = true;
    }
    assert.equal(crashFired, true);
    host1.close();

    // In comp: 3 events were delivered (evt-0, evt-1, evt-2)
    assert.equal(comp.delivered.length, 3);

    // Resume fresh relay over fresh DatabaseSync on same file
    const host2 = openHostDatabase({ directory: dir, name: "crash_test", exists: true });
    // Pending rows should include evt-2 (acknowledged before crash but not marked) and evt-3, evt-4, evt-5
    const pendingOnResume = host2.pendingOutboxRows();
    assert.equal(pendingOnResume.length, 4);
    assert.equal(pendingOnResume[0].event_id, "evt-2");

    await drainPendingOutbox({
      host: host2,
      composition: comp,
      ledger,
      getLabel: (index) => `relay_call_${ledger.report().occurrence_count}_${index}`,
      recordCall: dummyRecordCall,
    });

    // In comp: total deliveries = 3 + 4 = 7 (evt-2 delivered twice!)
    assert.equal(comp.delivered.length, 7);
    const evt2Deliveries = comp.delivered.filter((d) => d.event.id === "evt-2");
    assert.equal(evt2Deliveries.length, 2);

    // All 6 rows in host are now relayed
    assert.equal(host2.counts().pending_outbox, 0);
    assert.equal(host2.counts().relayed_outbox, 6);
    host2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mark-before-ack planted defect loses record across crash", async () => {
  const dir = makeTempDir();
  try {
    const host1 = openHostDatabase({ directory: dir, name: "defect_test" });
    populateHostOutbox(host1, 6);

    const comp = makeMockComposition();
    const ledger = occurrenceLedger({ budget: 20 });

    let crashFired = false;
    try {
      await drainMarkBeforeAck({
        host: host1,
        composition: comp,
        ledger,
        getLabel: (index) => `relay_call_${ledger.report().occurrence_count}_${index}`,
        recordCall: dummyRecordCall,
        crashAfterMarkIndex: 2,
      });
    } catch (err) {
      assert(err instanceof RelayCrashError);
      crashFired = true;
    }
    assert.equal(crashFired, true);
    host1.close();

    // Delivered only 2 events (evt-0, evt-1) before crashing at index 2
    assert.equal(comp.delivered.length, 2);

    // Resume fresh relay
    const host2 = openHostDatabase({ directory: dir, name: "defect_test", exists: true });
    // evt-2 was marked relayed BEFORE delivery and crash! So it is NOT pending!
    const pending = host2.pendingOutboxRows();
    assert.equal(pending.length, 3);
    assert.equal(pending[0].event_id, "evt-3");

    await drainPendingOutbox({
      host: host2,
      composition: comp,
      ledger,
      getLabel: (index) => `relay_call_${ledger.report().occurrence_count}_${index}`,
      recordCall: dummyRecordCall,
    });

    // Delivered evt-3, evt-4, evt-5. Total delivered to collector = 2 + 3 = 5! evt-2 was lost!
    assert.equal(comp.delivered.length, 5);
    const hasEvt2 = comp.delivered.some((d) => d.event.id === "evt-2");
    assert.equal(hasEvt2, false);

    host2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("outage deferral leaves rows pending in durable host DB, then delivers after recovery", async () => {
  const dir = makeTempDir();
  try {
    const host = openHostDatabase({ directory: dir, name: "outage_test" });
    populateHostOutbox(host, 4);

    // Outage: composition returns 503 for first 4 attempts
    const comp = makeMockComposition([
      { status: "rejected_overload" },
      { status: "rejected_overload" },
      { status: "rejected_overload" },
      { status: "rejected_overload" },
      { status: "acknowledged" },
      { status: "acknowledged" },
      { status: "acknowledged" },
      { status: "acknowledged" },
    ]);
    const ledger = occurrenceLedger({ budget: 20 });

    // First attempt during outage: all 4 fail
    await drainPendingOutbox({ host, composition: comp, ledger, getLabel: (index) => `relay_call_${ledger.report().occurrence_count}_${index}`,
      recordCall: dummyRecordCall });
    assert.equal(host.counts().pending_outbox, 4);
    assert.equal(host.counts().relayed_outbox, 0);

    // Outage cleared: retry drain from durable host records
    await drainPendingOutbox({ host, composition: comp, ledger, getLabel: (index) => `relay_call_${ledger.report().occurrence_count}_${index}`,
      recordCall: dummyRecordCall });
    assert.equal(host.counts().pending_outbox, 0);
    assert.equal(host.counts().relayed_outbox, 4);

    host.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("phase crash counts acknowledgments after an earlier failed delivery", async () => {
  const dir = makeTempDir();
  let host = openHostDatabase({ directory: dir, name: "count_ack" });
  try {
    populateHostOutbox(host, 6);
    const composition = makeMockComposition([{ status: "rejected_overload" }]);
    const ledger = occurrenceLedger({ budget: 20 });
    const relay = await executePhaseRelay({
      host, hostDirectory: dir, composition, ledger, planIndex: 0,
      phase: { name: "count_ack", kind: "crash_restart", crash_after_acknowledgment: 3 },
      plan: Array.from({ length: 20 }, (_, index) => ({ label: `ack_${index}` })),
      record: (step, invoke) => dummyRecordCall({ ledger, label: step.label, invoke }),
    });
    host = relay.finalHost;
    assert.equal(relay.crash_fired, true);
    assert.deepEqual(composition.delivered.map(({ event }) => event.event.id),
      ["evt-0", "evt-1", "evt-2", "evt-3", "evt-0", "evt-3", "evt-4", "evt-5"]);
    assert.equal(host.counts().pending_outbox, 0);
  } finally {
    host.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const leaked of [false, true]) {
  test(`rollback drain reads the database with zero planned relay steps; leaked = ${leaked}`, async () => {
    const dir = makeTempDir();
    const host = openHostDatabase({ directory: dir, name: "rollback_drain" });
    try {
      if (leaked) populateHostOutbox(host, 1);
      let reads = 0;
      const pending = host.pendingOutboxRows;
      host.pendingOutboxRows = () => { reads += 1; return pending(); };
      const work = executePhaseRelay({ host, phase: { kind: "rollback" }, plan: [], planIndex: 0 });
      if (leaked) await assert.rejects(work, /relay plan exhausted/);
      else await work;
      assert.equal(reads, 1);
    } finally {
      host.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
