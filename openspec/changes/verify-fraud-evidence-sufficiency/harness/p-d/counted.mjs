import { callRecorder } from "../lib/observe.mjs";

function reject({ context, error }) {
  context.thrown = error;
  context.hasThrown = true;
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

function drain(context) {
  for (const { raw, ...outcome } of context.recorder.outcomes) context.calls.push({ step_id: `${context.label}/${context.ordinal}`, ...outcome });
  context.recorder.outcomes.length = 0;
}

function failed({ context, error }) {
  drain(context);
  throw error;
}

function finished({ context, record }) {
  drain(context);
  if (context.hasThrown) throw context.thrown;
  return record.value;
}

function invokeCounted(context) {
  let result;
  try { result = context.recorder.call({ label: context.label, invoke: () => invokePublic(context) }); }
  catch (error) { return failed({ context, error }); }
  const finish = (record) => finished({ context, record });
  return result instanceof Promise ? result.then(finish, (error) => failed({ context, error })) : finish(result);
}

// Counts before invoking, including callbacks. Drain even on sticky budget failure.
export function counted({ ledger, calls = [], onThrow = () => {} }) {
  const shared = { ledger, calls, onThrow, recorder: callRecorder({ ledger }) };
  return ({ label, fn }) => invokeCounted({ ...shared, label, fn, hasThrown: false });
}
