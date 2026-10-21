import { familyWorkload } from "./family-workload.mjs";
import { UNLOCK_CASES } from "./lock-cases.mjs";
import { lockModificationInput } from "./lock-inputs.mjs";
import { compensationFacts, lockFacts } from "./lock-facts.mjs";
import { instance, requireDependency } from "./runtime.mjs";
import { beginOperation, emitOccurrence, markOperation } from "./workload-steps.mjs";

const RELEASES = [
  { id: "administrator", actor: "admin", tenantless: false },
  { id: "scheduled", actor: "scheduled", tenantless: false },
  { id: "tenantless", actor: "admin", tenantless: true },
];

async function independentUnlock(state, variant) {
  for (const { id, actor, tenantless } of RELEASES) await variant(id, async () => {
    const target = instance(state);
    const handle = await beginOperation(state, { target, id: `${id}-begin` });
    // The scheduled variant has an explicit synthetic commit. A lazy TTL
    // check has NO emission here; U1's lazy_expiry analysis says why.
    await markOperation(state, { target, handle, id: `${id}-mark`, method: "markCommitted" });
    const input = { ...lockModificationInput(state, { actor, release: true, tenantless }), operation: handle };
    const record = await emitOccurrence(state, { target, handle, input, id, method: "sensitiveResourceModified", refusalExpected: tenantless });
    lockFacts(record);
  });
}

async function compensatedEmission(state, { target, handle, id, refusalExpected = false }) {
  const input = { ...lockModificationInput(state, { category: "lockout_release" }), operation: handle };
  // Retain K2a's service actor and lock-policy allow. Only the resource category
  // and lifecycle change; no independent-unlock policy is invented for U2.
  input.event = { lifecycle_phase: "compensating" };
  const record = await emitOccurrence(state, { target, handle, input, id, method: "sensitiveResourceModified", refusalExpected });
  lockFacts(record);
  return record;
}

async function compensationUnlock(state, variant, lock) {
  requireDependency(lock, "U2 requires K2a's live same-instance operation; no fabricated prerequisite");
  requireDependency(lock.target, "U2 K2a target");
  requireDependency(lock.handle, "U2 K2a handle");
  await variant("same-instance", async () => {
    await markOperation(state, { ...lock, id: "compensate", method: "markCompensated" });
    const record = await compensatedEmission(state, { ...lock, id: "same-instance" });
    record.compensation = compensationFacts(lock.record, record);
  });
  await variant("foreign", () => compensatedEmission(state, { target: instance(state), handle: lock.handle, id: "foreign", refusalExpected: true }));
  await variant("copied", () => compensatedEmission(state, { target: lock.target, handle: { ...lock.handle }, id: "copied", refusalExpected: true }));
}

const RUNNERS = { U1: independentUnlock, U2: compensationUnlock };
export async function unlockWorkload(state, lock, cases = UNLOCK_CASES) {
  const runners = { ...RUNNERS, U2: (current, variant) => RUNNERS.U2(current, variant, lock) };
  await familyWorkload(state, { cases, runners });
}
