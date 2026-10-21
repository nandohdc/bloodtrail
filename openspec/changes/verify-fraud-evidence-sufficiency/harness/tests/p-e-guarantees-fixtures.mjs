import { orderingWorkload } from "../p-e/ordering-workload.mjs";
import { ORDERING_CASES } from "../p-e/ordering-cases.mjs";
import { redeliveryWorkload } from "../p-e/redelivery-workload.mjs";
import { REDELIVERY_CASES } from "../p-e/redelivery-cases.mjs";
import { guaranteesCase } from "../p-e/guarantees-workload.mjs";
import { compareGuarantees } from "../p-e/guarantee-analysis.mjs";
import { tabulateSteps } from "../p-e/contract-columns.mjs";
import { concurrencyState } from "./p-e-concurrency-fixtures.mjs";

const PEERS = ["P-E-5", "P-E-7", "P-E-8"];

export async function guaranteeFixture(options) {
  const state = concurrencyState(options);
  const rows = await orderingWorkload(state, ORDERING_CASES.filter((entry) => entry.case_id === "P-E-2b"));
  rows.push(...await redeliveryWorkload(state, REDELIVERY_CASES.filter((entry) => PEERS.includes(entry.case_id))));
  rows.push(await guaranteesCase(state));
  const comparisons = compareGuarantees({ records: state.records, rows });
  const steps = tabulateSteps({ records: state.records, rows, comparisons });
  return { state, rows, comparisons, steps };
}
