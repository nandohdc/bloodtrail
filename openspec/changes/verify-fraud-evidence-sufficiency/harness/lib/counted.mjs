import { callRecorder } from "./observe.mjs";

// One counted public-call wrapper for all probes. Counts BEFORE invoking
// (ledger.take), drains recorder outcomes in ledger-ordinal order, and never
// lets sticky budget exhaustion swallow the raw outer outcome.
// - stepIds: emit { step_id: `${label}/${ordinal}`, ...outcome } (P-D shape).
// - keepRaw: keep the raw result field (P-attr shape; opaque returns are
//   replaced later by the probe's callSnapshot).
// Nested calls (for example provider hook callbacks) get their own recorder,
// and every drained outcome is inserted into calls before the first entry
// whose ledger ordinal is larger, so public_calls stays in ledger-take order
// regardless of completion order.
function reject({ context, error }) {
  context.thrown = error;
  context.onThrow(error);
  throw error;
}

function invokePublic(context) {
  context.ordinal = context.ledger.report().occurrence_count;
  try {
    const value = context.fn();
    return value instanceof Promise ? value.catch((error) => reject({ context, error })) : value;
  } catch (error) { return reject({ context, error }); }
}

function insertOutcome(context, entry) {
  const index = context.ordinals.findIndex((ordinal) => ordinal > context.ordinal);
  if (index === -1) {
    context.calls.push(entry);
    context.ordinals.push(context.ordinal);
  } else {
    context.calls.splice(index, 0, entry);
    context.ordinals.splice(index, 0, context.ordinal);
  }
}

function drain(context) {
  for (const outcome of context.recorder.outcomes) insertOutcome(context, shape(context, outcome));
  context.recorder.outcomes.length = 0;
}

function shape(context, outcome) {
  if (context.stepIds) {
    const { raw, ...rest } = outcome;
    return { step_id: `${context.label}/${context.ordinal}`, ...rest };
  }
  if (context.keepRaw) return { ...outcome };
  const { raw, ...rest } = outcome;
  return { label: outcome.label, ...rest };
}

function failed({ context, error }) {
  drain(context);
  throw error;
}

function finished({ context, record }) {
  drain(context);
  if (context.assertAfter) context.ledger.assertAvailable();
  if (context.thrown !== undefined) throw context.thrown;
  return record.value;
}

function invokeCounted(context) {
  let result;
  try { result = context.recorder.call({ label: context.label, invoke: () => invokePublic(context) }); }
  catch (error) { return failed({ context, error }); }
  const finish = (record) => finished({ context, record });
  return result instanceof Promise ? result.then(finish, (error) => failed({ context, error })) : finish(result);
}

export function counted({ ledger, calls, onThrow = () => {}, stepIds = false, keepRaw = true, assertAfter = false }) {
  const shared = { ledger, calls, onThrow, stepIds, keepRaw, assertAfter, ordinals: [] };
  return ({ label, fn }) => invokeCounted({ ...shared, label, fn, thrown: undefined, ordinal: 0, recorder: callRecorder({ ledger }) });
}
