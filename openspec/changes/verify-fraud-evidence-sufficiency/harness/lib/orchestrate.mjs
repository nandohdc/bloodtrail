import assert from "node:assert/strict";
import { planBudget } from "./ledger.mjs";
import { approvalFromArgs, claimOnce } from "./approval.mjs";
import { sessionPreflight } from "./preflight.mjs";
import { requireProbe, requireRoles } from "./plan.mjs";

export async function runApprovedSession({ options, entrypoint, session, failure, refuse, now, probe, ticket }) {
  let claimed = false;
  let approval;
  try {
    approval = approvalFromArgs({ options, now, probe, ticket });
    const hashes = sessionPreflight({ options, approval, entrypoint });
    claimOnce({ path: options["once-marker"], approvedHead: options.approvedHead });
    claimed = true;
    return await session(approval, hashes);
  } catch (error) {
    if (claimed) await failure({ error, approval });
    else refuse(error.message);
    return { exitCode: 1 };
  }
}

export async function runRoles({ expectations, spawn, roles, probe, ticket }) {
  requireProbe({ probe, ticket });
  requireRoles({ roles });
  const plan = planBudget(expectations.planned_occurrence_budget);
  const observations = [];
  const invalidations = [];
  for (const role of roles) {
    try {
      const observed = await spawn({ role: role.role, budget: plan.processes[role.role] });
      observations.push(observed);
      assert(observed.ledger.occurrence_count <= plan.processes[role.role], "process budget exceeded");
      invalidations.push(...observed.invalidations);
      if (invalidations.length > 0) break;
    } catch (error) {
      invalidations.push({ role: role.role, message: error.message });
      break;
    }
  }
  return { observations, invalidations, occurrence_count: observations.reduce((count, process) => count + process.ledger.occurrence_count, 0) };
}

export async function runSession({ pipeline, prepare, expectations, write, roles, probe, ticket }) {
  requireProbe({ probe, ticket });
  requireRoles({ roles });
  let provenance = { invalidations: [], observations: { observations: [], invalidations: [], occurrence_count: 0 } };
  try {
    provenance = await pipeline(async (context) => {
      const spawn = await prepare(context);
      return runRoles({ expectations, spawn, roles, probe, ticket });
    });
  } catch (error) {
    provenance.invalidations.push(error.message);
  }
  const observed = provenance.observations || { observations: [], invalidations: [], occurrence_count: 0 };
  const invalidations = [...provenance.invalidations, ...observed.invalidations];
  const result = { provenance, ...observed, invalidations };
  const delivered = await write(result);
  const success = delivered !== false && invalidations.length === 0;
  return { result, exitCode: success ? 0 : 1 };
}
