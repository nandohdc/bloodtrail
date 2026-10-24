// Orchestrator side of the tracer session: one exchange between a fresh ingress and a fresh sender, under
// the frozen deadline. The ingress token is generated per run and held only in memory (lib/session.mjs).
import { randomBytes } from "node:crypto";
import { withDeadline } from "../lib/deadline.mjs";
import { killAll, roleExchange, stopRoles, withRoleStderr } from "../lib/session.mjs";

export async function tracerSession({ service, storage, flags, expectations }) {
  const roles = {};
  const token = randomBytes(24).toString("hex");
  let failure;
  try {
    return await withDeadline({
      ms: expectations.deadline_ms, onTimeout: () => killAll(roles),
      work: () => roleExchange({ service, directory: storage, flags, probeDirectory: "tracer", senderInput: expectations, faultPlan: expectations.fault_plan, roles, token }),
    });
  } catch (error) {
    failure = withRoleStderr({ error, roles, token });
    throw failure;
  } finally {
    await stopRoles(roles, { failure });
  }
}
