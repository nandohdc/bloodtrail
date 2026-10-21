// Sequential P-E process assembly (implementer default): baselines first,
// then every case family, with fresh per-case resources and a sticky
// per-case budget assertion. P-E-g and P-E-adm are the baselines: a
// construction/capture refusal there is a precondition invalidation that
// stops every remaining case; normal expected/unexpected refusals and throws
// inside later families remain observations.
import assert from "node:assert/strict";
import { ADMISSION_CASE } from "./admission-cases.mjs";
import { admissionCase } from "./admission-workload.mjs";
import { CONCURRENCY_CASES } from "./concurrency-cases.mjs";
import { concurrencyWorkload } from "./concurrency-workload.mjs";
import { CONSTRUCTION_CASES } from "./construction-cases.mjs";
import { constructionWorkload } from "./construction-workload.mjs";
import { GUARANTEES_CASE, guaranteesCase } from "./guarantees-workload.mjs";
import { ORDERING_CASES } from "./ordering-cases.mjs";
import { orderingWorkload } from "./ordering-workload.mjs";
import { OUTBOX_CASES } from "./outbox-cases.mjs";
import { outboxWorkload } from "./outbox-workload.mjs";
import { RECOVERY_CASES } from "./recovery-cases.mjs";
import { recoveryWorkload } from "./recovery-workload.mjs";
import { REDELIVERY_CASES } from "./redelivery-cases.mjs";
import { redeliveryWorkload } from "./redelivery-workload.mjs";

const ADMISSION_ACCEPTED = 3;
const ADMISSION_REFUSALS = 6;
const BINDING_KEYS = JSON.stringify(["guarantees", "deliver"]);

function guaranteesFacts(state) {
  const record = state.records.find((entry) => entry.step_id === `${GUARANTEES_CASE.case_id}/read`);
  if (record === undefined) return { transaction_critical: false, frozen: false, public_keys: false };
  const guarantees = record.raw.guarantees;
  return {
    transaction_critical: guarantees === undefined ? false : guarantees.deliveryClass === "transaction_critical",
    frozen: record.raw.guarantees_frozen === true,
    public_keys: JSON.stringify(record.raw.public_keys) === BINDING_KEYS,
  };
}

function admissionFacts(state) {
  const records = state.records.filter((record) => record.step_id.startsWith(`${ADMISSION_CASE.case_id}/`));
  return {
    accepted: records.filter((record) => record.accepted === true).length,
    refused: records.filter((record) => record.accepted === false).length,
  };
}

function baselineHolds(state) {
  const gate = guaranteesFacts(state);
  const admission = admissionFacts(state);
  const pair = gate.transaction_critical && gate.frozen;
  const gateHolds = pair && gate.public_keys;
  const admissionHolds = admission.accepted === ADMISSION_ACCEPTED && admission.refused === ADMISSION_REFUSALS;
  return gateHolds && admissionHolds;
}

export async function baselines(state) {
  const rows = [await guaranteesCase(state), await admissionCase(state)];
  state.accounting.push(...rows);
  state.ledger.assertAvailable();
  if (!baselineHolds(state)) {
    state.invalidations.push({ message: "P-E baseline precondition failed; all remaining cases stopped" });
  }
}

const FAMILIES = [
  { cases: CONSTRUCTION_CASES, run: (state) => constructionWorkload(state) },
  { cases: ORDERING_CASES, run: (state) => orderingWorkload(state) },
  { cases: REDELIVERY_CASES, run: (state) => redeliveryWorkload(state) },
  { cases: CONCURRENCY_CASES, run: (state) => concurrencyWorkload(state) },
  { cases: OUTBOX_CASES, run: (state, directory) => outboxWorkload(state, { directory }) },
  { cases: RECOVERY_CASES, run: (state, directory) => recoveryWorkload(state, { directory }) },
];

async function families(state, directory) {
  for (const family of FAMILIES) {
    await family.run(state, directory);
    state.ledger.assertAvailable();
  }
}

export async function measure({ state, directory }) {
  assert.equal(typeof directory, "string", "declared database directory is required");
  try {
    await baselines(state);
    if (state.invalidations.length === 0) await families(state, directory);
  } catch (error) {
    state.invalidations.push({ message: error.message, attribution: "harness_fault", stopped_at: state.current });
  }
  return { role: "sequential", records: state.records, public_calls: state.calls,
    accounting: state.accounting, invalidations: state.invalidations, ledger: state.ledger.report(),
    case_aborts: state.case_aborts };
}
