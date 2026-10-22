import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { peDouble } from "./p-e-case-fixtures.mjs";
import { fixtureState } from "./p-e-runtime-fixtures.mjs";
import { recoveryWorkload } from "../p-e/recovery-workload.mjs";
import { RECOVERY_CASES } from "../p-e/recovery-cases.mjs";

const NAME = "bloodtrail.audit.authentication.mfa.removed";
const BINDINGS = [["operationId", "operation_id"], ["correlationId", "correlation_id"], ["transactionId", "transaction_id"]];

// Independent extension of the construction double, abcbefa sdk.ts:82-84,
// 231-233,308-338 and events.ts:55-70,134-149. Retained redelivery validates the
// existing occurrence and matches public ids, NOT the handle's current state.
async function retainedDelivery(sink, event) {
  try { return { ok: true, value: await sink.emit(event) }; }
  catch { return { ok: false, error: { code: "SDK_SINK_FAILURE", category: "sink", path: "/sink", eventName: NAME } }; }
}

function namedRetained(sink, input) {
  const event = input.redelivery.event;
  for (const [getter, field] of BINDINGS) {
    if (input.operation[getter] !== event.correlation[field]) {
      return Promise.resolve({ ok: false, error: { code: "SDK_OPERATION_EVENT_MISMATCH", category: "lifecycle", path: `/correlation/${field}` } });
    }
  }
  return retainedDelivery(sink, event);
}

async function normalizeSinkDiagnostic(pending) {
  const result = await pending;
  if (result.ok) return result;
  if (result.error.code !== "SDK_SINK_FAILURE") return result;
  return { ...result, error: { ...result.error, eventName: NAME } };
}

export function recoveryDouble() {
  const modules = peDouble();
  const factory = modules.node.createNodeSecurityAuditSdk;
  modules.node.createNodeSecurityAuditSdk = (config) => {
    const sdk = factory(config);
    return { ...sdk,
      redeliver: (event) => retainedDelivery(config.sink, event),
      mfaRemoved: (input) => input.redelivery === undefined
        ? normalizeSinkDiagnostic(sdk.mfaRemoved(input)) : namedRetained(config.sink, input) };
  };
  return modules;
}

export function recoveryFixture(t, { modules = recoveryDouble(), budget = 600 } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "pe-recovery-fixture-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const state = fixtureState({ ...modules, budget });
  return { directory, state, async run(caseId) {
    const cases = RECOVERY_CASES.filter((entry) => entry.case_id === caseId);
    const rows = await recoveryWorkload(state, { directory, cases });
    assert.deepEqual(readdirSync(directory), [], "all settled case databases removed");
    return rows[0];
  } };
}

export function recoveryRecord(state, caseId, id) {
  const record = state.records.find((row) => row.step_id === `${caseId}/${id}`);
  assert.notEqual(record, undefined, id);
  return record;
}

export function assertRecoveryDiagnostic(record, tuple) {
  assert.equal(record.accepted, false);
  assert.deepEqual([record.diagnostic.code, record.diagnostic.category, record.diagnostic.path], tuple);
  assert.equal(record.counters.sink, 0);
  assert.deepEqual(record.captures, []);
}

export function mutateRecovery(decorate) {
  const modules = recoveryDouble();
  const factory = modules.node.createNodeSecurityAuditSdk;
  modules.node.createNodeSecurityAuditSdk = (config) => decorate(factory(config));
  return modules;
}
