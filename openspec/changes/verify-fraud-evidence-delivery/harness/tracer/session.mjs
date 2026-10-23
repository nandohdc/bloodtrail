// Orchestrator side of the tracer session: start the ingress, then the sender, under the frozen deadline;
// collect the sender's report and the ingress's read-back; stop both. The ingress token is generated per
// run and held only in memory (sent over IPC, never written or recorded).
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { assertResolution, spawnRole } from "../lib/launcher.mjs";
import { withDeadline } from "../lib/deadline.mjs";
import { roleProcessPath } from "../lib/plan.mjs";

// The run authorization names the project owner in the data, retention and key roles (G42).
export const OWNERS = Object.freeze({ dataOwner: "project owner (G42)", retentionAuthority: "project owner (G42)", keyOwner: "project owner (G42)" });

function killAll(roles) {
  for (const role of Object.values(roles)) if (role.exited() === null) role.kill();
}

// Scratch is deleted only after every role has closed, so a dying ingress cannot still be writing its
// SQLite files while they are removed. The wait is bounded; scratch deletion retries and is proven.
export const ROLE_CLOSE_TIMEOUT_MS = 5000;

export async function stopRoles(roles, { timeoutMs = ROLE_CLOSE_TIMEOUT_MS } = {}) {
  killAll(roles);
  let timer;
  const timeout = new Promise((resolveTimeout) => { timer = setTimeout(resolveTimeout, timeoutMs); });
  try {
    await Promise.race([Promise.all(Object.values(roles).map((role) => role.whenClosed())), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function stopAll(roles) {
  for (const [name, role] of Object.entries(roles)) {
    role.send({ type: "stop" });
    await role.next("stopped", name);
  }
}

function checkResolutions({ service, resolved }) {
  for (const url of Object.values(resolved)) assertResolution({ service, resolved: url });
}

async function exchange({ service, storage, flags, expectations, roles, token }) {
  // The same role paths the runner's import-closure check validated (plan.mjs ROLE_SCRIPTS).
  const script = (role) => roleProcessPath({ prefix: join(service, "harness"), probeDirectory: "tracer", role });
  roles.ingress = spawnRole({ service, script: script("ingress"), flags: flags.ingress });
  roles.ingress.send({ type: "start", token, fault_plan: expectations.fault_plan, storage_directory: storage, owners: OWNERS });
  const ready = await roles.ingress.next("ready", "ingress");
  checkResolutions({ service, resolved: ready.resolved });
  roles.sender = spawnRole({ service, script: script("sender"), flags: flags.sender });
  roles.sender.send({ type: "start", expectations, origin: `http://127.0.0.1:${ready.port}`, token, port: ready.port });
  const report = await roles.sender.next("report", "sender");
  checkResolutions({ service, resolved: report.resolved });
  roles.ingress.send({ type: "read_back" });
  const back = await roles.ingress.next("read_back", "ingress");
  await stopAll(roles);
  const { type: _ready, ...ingress } = ready;
  const { type: _report, ...sender } = report;
  return { ingress: { ...ingress, records: back.records, read_back: back.read_back }, sender, occurrence_count: report.ledger.occurrence_count };
}

// The failure that ends a session carries each started role's bounded stderr, with the run's token
// redacted, so a crash that spends a run stays diagnosable from its results.
export function withRoleStderr({ error, roles, token }) {
  error.role_stderr = Object.fromEntries(Object.entries(roles).map(([name, role]) => [name, role.stderr().replaceAll(token, "[redacted token]")]));
  return error;
}

export async function tracerSession({ service, storage, flags, expectations }) {
  const roles = {};
  const token = randomBytes(24).toString("hex");
  try {
    return await withDeadline({ ms: expectations.deadline_ms, onTimeout: () => killAll(roles), work: () => exchange({ service, storage, flags, expectations, roles, token }) });
  } catch (error) {
    throw withRoleStderr({ error, roles, token });
  } finally {
    await stopRoles(roles);
  }
}
