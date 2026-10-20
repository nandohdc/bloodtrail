import { withHostDatabase } from "./host.mjs";
import { caseSummary, handleFacts, runCase } from "./case-steps.mjs";
import { OUTBOX_CASES } from "./outbox-cases.mjs";
import { beginHostTransaction, finishHostTransaction, hostFacts, outboxEmit,
  outboxSetup, outboxSnapshot, outboxTransition } from "./outbox-steps.mjs";
import { relayOutboxRow } from "./outbox-relay.mjs";

const INITIAL_STEPS = ["mark", "emit", "snapshot"];
const ROLLBACK_TRANSITIONS = [
  { id: "markNot", method: "markNotCommitted", refusalExpected: true },
  { id: "markCancelled", method: "markCancelled", refusalExpected: true },
  { id: "markCommitted", method: "markCommitted" },
  { id: "markCompensated", method: "markCompensated" },
];
const ORDER_NAMES = ["begin", "businessInsert", "markCommitted", "sinkEmit", "commit", "rollback", "exchange"];

// Host acceptance is awaited BEFORE finishing the database transaction. An
// independent case reproduces every dependency with a fresh host and SDK;
// P-E-9b does not consume mutable P-E-9 state, nor does P-E-10 consume P-E-9b.
export async function acceptedHostTransaction(state, setup, method) {
  beginHostTransaction(state, setup);
  await outboxTransition(state, setup, { id: "mark", method: "markCommitted" });
  const emit = await outboxEmit(state, setup);
  finishHostTransaction(state, setup, method);
  const snapshot = await outboxSnapshot(state, setup);
  return { emit, snapshot };
}

async function commitCase(state, setup) {
  await acceptedHostTransaction(state, setup, "commit");
  await outboxEmit(state, setup, { id: "reemit", refusalExpected: true });
  return [...INITIAL_STEPS, "reemit"];
}

async function relayCase(state, setup) {
  await acceptedHostTransaction(state, setup, "commit");
  await relayOutboxRow(state, setup);
  return [...INITIAL_STEPS, "relay"];
}

export async function rollbackReplay(state, setup) {
  await acceptedHostTransaction(state, setup, "rollback");
  await outboxEmit(state, setup, { id: "reemit", refusalExpected: true });
  for (const transition of ROLLBACK_TRANSITIONS) await outboxTransition(state, setup, transition);
  return [...INITIAL_STEPS, "reemit", ...ROLLBACK_TRANSITIONS.map((entry) => entry.id)];
}

const RUNNERS = { "P-E-9": commitCase, "P-E-9b": relayCase, "P-E-10": rollbackReplay };

export async function outboxCase(state, entry, { directory }) {
  const seqStart = state.sequence.length;
  return withHostDatabase({ directory, name: entry.case_id, work: async (host) => {
    const setup = outboxSetup(state, { host, caseId: entry.case_id });
    const steps = await RUNNERS[entry.case_id](state, setup);
    return { ...caseSummary(state, entry, { seqStart, actual: setup.counters(), steps, orderNames: ORDER_NAMES }),
      database: hostFacts(setup), host_order: host.order, final_handle: handleFacts(setup.handle) };
  } });
}

export async function outboxWorkload(state, { directory, cases = OUTBOX_CASES }) {
  const rows = [];
  for (const entry of cases) {
    const row = await runCase(state, entry, () => outboxCase(state, entry, { directory }));
    if (row !== null) rows.push(row);
  }
  state.accounting.push(...rows);
  return rows;
}
