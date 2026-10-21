import { named, requireDependency, step } from "./runtime.mjs";
import { handleFacts, occurrenceFacts } from "./snapshot.mjs";

// Keep the actual public handle local; the step stores only its public snapshot.
// A refused prerequisite remains observed, then aborts only its owning case.
export async function beginOperation(state, { target, id, input }) {
  requireDependency(target, "beginOperation target");
  requireDependency(target.sdk, "beginOperation target.sdk");
  let result;
  await step(state, { id, target, run: () => {
    result = state.method(target.sdk, "beginOperation", input);
    return result;
  } });
  if (result?.ok !== true) throw new Error("beginOperation prerequisite refused; see owned step");
  return requireDependency(result.value, "beginOperation handle");
}

export async function markOperation(state, { target, handle, id, method }) {
  requireDependency(target, "operation transition target");
  requireDependency(handle, "operation transition handle");
  let result;
  const business = { committed: false };
  const record = await step(state, { id, target, run: () => {
    // Implementer default: an in-memory synthetic commit marker immediately
    // before markCommitted, NOT a business-storage/durability measurement.
    business.committed = method === "markCommitted";
    result = state.method(handle, method);
    return result;
  } });
  record.handle = handleFacts(handle);
  record.synthetic_business_committed = business.committed;
  if (result?.ok !== true) throw new Error("operation transition prerequisite refused; see owned step");
  return record;
}

export async function emitOccurrence(state, { handle, ...options }) {
  const record = await named(state, options);
  record.occurrence = occurrenceFacts({ captures: record.captures, handle });
  if (handle !== undefined) record.handle = handleFacts(handle);
  return record;
}
