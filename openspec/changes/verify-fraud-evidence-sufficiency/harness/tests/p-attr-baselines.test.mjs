import assert from "node:assert/strict";
import test from "node:test";
import { BASELINES, baseline } from "../p-attr/baselines.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { fixtureState, FIXTURE_METHODS } from "./p-attr-foundation-fixtures.mjs";

// Source: generated/contract.generated.ts:515-548,575-625,737-763;
// context.ts:155-166,183-196; events.ts:185-227,383-414. Not run evidence.
const COUNTS = { "AF-B": 7, "AS-B": 10, "PR-B": 6, "RA-B": 6 };
const REQUIRED = {
  "AF-B": ["actor", "authentication", "source", "request", "correlation"],
  "AS-B": ["actor", "authenticated_principal", "authentication", "credential", "session", "source"],
  "PR-B": ["actor", "request", "source", "correlation"],
  "RA-B": ["actor", "tenant", "request", "source", "correlation"],
};

function checkDefaults({ record, entry }) {
  const event = record.events[0];
  const row = FIXTURE_METHODS.find(([method]) => method === entry.method);
  assert.equal(event.event.name, `bloodtrail.audit.${row[1]}`);
  assert.equal(event.event.outcome, row[2]);
  assert.equal(event.event.lifecycle_phase, row[3]);
  assert.deepEqual(event.resource, { operation_type: row[4] });
  assert.equal(event.event.commit_state, "not_applicable");
  assert.equal(event.event.delivery_class, "security_significant");
  assert.deepEqual(event.tenant, { scope: "tenantless" });
  assert.equal(event.subject, undefined);
}

function checkActor({ record, entry }) {
  const event = record.events[0];
  if (entry.case_id === "AS-B") {
    assert.equal(event.actor.id, "acct-0001");
    assert.equal(event.authenticated_principal.id, "acct-0001");
    assert.equal(event.credential.reference, "cref-0001");
    assert.match(event.session.id, /^sfp-[0-9a-f]{64}$/);
    assert.equal(record.origins["session.id"], "SR");
    return;
  }
  assert.deepEqual(event.actor, { type: "anonymous", provenance: { trust_level: "client_claim", source: "request_boundary" } });
  assert.equal(event.credential, undefined);
}

for (const entry of BASELINES) {
  test(`${entry.case_id}: public-shape baseline, exact calls and cloned capture`, async () => {
    const state = fixtureState();
    const { record, prepared, target } = await baseline(state, { entry, keying: memoryKeying() });
    assert.deepEqual(record.raw, { ok: true, value: { status: "accepted" } });
    assert.equal(record.kind, "returned");
    assert.equal(record.sink_count, 1);
    assert.deepEqual(record.frozen, [true]);
    assert(Object.isFrozen(target.sink.events[0].actor));
    for (const field of REQUIRED[entry.case_id]) assert(Object.hasOwn(prepared.input, field));
    assert.equal(state.ledger.report().occurrence_count, COUNTS[entry.case_id]);
    assert.equal(entry.calls, COUNTS[entry.case_id]);
    assert.equal(state.calls.length, COUNTS[entry.case_id]);
    checkDefaults({ record, entry });
    checkActor({ record, entry });
    assert.equal(record.captured_origins[0]["resource.operation_type"], "SC");
    record.events[0].actor.type = "fixture-mutation";
    assert.notEqual(target.sink.events[0].actor.type, "fixture-mutation");
    record.origins["actor.type"] = "CP";
    assert.notEqual(prepared.origins["actor.type"], "CP");
  });
}
