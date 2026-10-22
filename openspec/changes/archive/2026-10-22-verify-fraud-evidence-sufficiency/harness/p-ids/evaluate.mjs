import { compareIds, distinctIds } from "../lib/metrics.mjs";

const CASE_ROLES = [
  ["setup"], ["core-A", "core-B"], ["core-A", "core-B"], ["core-C", "core-D"],
  ["core-E", "core-F"], ["core-G"], ["core-A"], ["controls"],
  ["node-A", "node-B"], ["node-C", "node-D"], ["core-H", "core-I"], [],
];
const PLAIN_FIELDS = ["event_id", "operation_id", "correlation_id"];
const HANDLE_FIELDS = ["handle_operationId", "handle_transactionId", "handle_correlationId"];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function emissionOutcomes(process) {
  return process.outcomes.filter((entry) => entry.label === "authenticationFailed");
}

function validEmissions({ process, count }) {
  const calls = emissionOutcomes(process);
  return calls.length === count && process.ids.event_id.length === count && calls.every((call) => call.accepted && call.raw.value.status === "accepted");
}

function distinctProcess(process) {
  return distinctIds({ arrays: Object.values(process.ids) }).all_distinct;
}

function noRepeats({ pair, fields }) {
  return fields.every((field) => {
    const metrics = compareIds({ left: pair[0].ids[field], right: pair[1].ids[field] });
    return metrics.positional_equality === 0 && metrics.intersection === 0;
  });
}

function plainPair({ pair, count }) {
  return pair.every((process) => validEmissions({ process, count }) && distinctProcess(process) && process.ids.transaction_id.length === 0 && process.ids.event_id.every((id) => UUID_V4.test(id))) && noRepeats({ pair, fields: PLAIN_FIELDS });
}

function setupMatched({ pair, expected }) {
  const calls = pair[0].outcomes.filter((entry) => entry.label.includes(":"));
  return calls.length === 14 && calls.every((call) => {
    const row = call.label.split(":")[1];
    if (row === "positive") return call.accepted && call.raw.state === "ready" && call.raw.frozen;
    const wanted = expected.negative.find((entry) => entry.row === row);
    return !call.accepted && ["code", "category", "path"].every((key) => call.diagnostic[key] === wanted[key]);
  });
}

function operationPair({ pair, count }) {
  return pair.every((process) => process.handles.length === count && distinctProcess(process) && process.outcomes.every((entry) => entry.accepted)) && noRepeats({ pair, fields: HANDLE_FIELDS });
}

function collisionErrorsMatch(errors) {
  return errors.length === 2
    && errors.every((entry) => entry.code === "SDK_INVALID_IDENTIFIER" && entry.category === "validation")
    && errors[0].path === "/event/id" && errors[1].path === "/operation/operation_id";
}

function repeatedCorrelation(process) {
  return ["operation_id", "correlation_id"].every((field) => process.ids[field][2] === process.ids[field][3]);
}

function collisionMatched({ pair }) {
  const process = pair[0];
  const emissions = emissionOutcomes(process);
  const operations = process.outcomes.filter((entry) => entry.label === "beginOperation");
  const errors = process.outcomes.filter((entry) => !entry.accepted).map((entry) => entry.diagnostic);
  return emissions.length === 5 && emissions.map((entry) => entry.accepted).join() === "true,false,true,true,true"
    && operations.map((entry) => entry.accepted).join() === "true,false"
    && collisionErrorsMatch(errors)
    && process.captures.map((capture) => capture.events.length).join() === "1,1,2"
    && repeatedCorrelation(process);
}

const CHECKS = [
  setupMatched,
  ({ pair, expected }) => plainPair({ pair, count: expected.accepted_per_process }),
  ({ pair, expected }) => noRepeats({ pair, fields: ["operation_id", "correlation_id"] }) && pair.every((process) => process.ids.transaction_id.length === 0 && distinctIds({ arrays: PLAIN_FIELDS.map((field) => process.ids[field]) }).distinct === expected.distinct_generated_ids_per_process),
  ({ pair, expected }) => operationPair({ pair, count: expected.accepted_per_process }),
  ({ pair }) => plainPair({ pair, count: 3 }) && compareIds({ left: Object.values(pair[0].ids).flat(), right: Object.values(pair[1].ids).flat() }).intersection === 0 && pair[1].handles.length === 1,
  ({ pair, expected }) => validEmissions({ process: pair[0], count: expected.accepted_emissions }) && distinctProcess(pair[0]) && Object.values(pair[0].ids).flat().length === expected.distinct_generated_ids,
  ({ pair, expected }) => JSON.stringify(pair[0].retention) === JSON.stringify(expected.retention) && emissionOutcomes(pair[0]).every((entry) => entry.accepted),
  collisionMatched,
  ({ pair, expected }) => plainPair({ pair, count: expected.accepted_emissions_per_process }) && operationPairHandles({ pair, count: expected.accepted_operations_per_process }),
  ({ pair, expected }) => plainPair({ pair, count: expected.accepted_per_process }),
  ({ pair, expected }) => plainPair({ pair, count: expected.accepted_per_process }),
];

function operationPairHandles({ pair, count }) {
  return pair.every((process) => process.handles.length === count) && noRepeats({ pair, fields: HANDLE_FIELDS });
}

export function evaluateCases({ observations, expectations }) {
  return expectations.cases.map((entry, index) => {
    const pair = CASE_ROLES[index].map((role) => observations.find((process) => process.role === role));
    if (index === 11) return { case_id: entry.case_id, raw: { execution: "not executed: Stage 2 (G22)" }, matched: null, notes: ["Analysis retained in expectations; no collector outcome measured."] };
    const available = pair.every(Boolean);
    const present = pair.filter(Boolean);
    const refusals = present.flatMap((process) => process.refusals || []);
    const clean = available && present.every((process) => process.invalidations.length === 0);
    const matched = Boolean(clean && refusals.length === 0 && CHECKS[index]({ pair, expected: entry.expected }));
    const notes = available ? refusals : ["Not observed: earlier precondition invalidated run."];
    return { case_id: entry.case_id, raw: { processes: present }, matched, notes };
  });
}
