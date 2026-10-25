// Orchestrator side of a probe session: start the ingress, then the sender, collect the sender's report and
// the ingress's read-back, and stop both. Each probe's session wraps one or more of these exchanges in its
// frozen deadline. The ingress token is generated per run and held only in memory (sent over IPC, never
// written or recorded).
import { join } from "node:path";
import assert from "node:assert/strict";
import { assertResolution, spawnRole } from "./launcher.mjs";
import { roleProcessPath } from "./plan.mjs";

// The run authorization names the project owner in the data, retention and key roles (G42).
export const OWNERS = Object.freeze({ dataOwner: "project owner (G42)", retentionAuthority: "project owner (G42)", keyOwner: "project owner (G42)" });

export function killAll(roles) {
  for (const role of Object.values(roles)) if (role.exited() === null) role.kill();
}

// Scratch is deleted only after every role has closed, so a dying ingress cannot still be writing its
// SQLite files while they are removed. A bounded wait failure marks closure as unconfirmed so the outer
// finalizer records failed cleanup instead of removing scratch.
export const ROLE_CLOSE_TIMEOUT_MS = 5000;

async function waitForClose(roles, timeoutMs = ROLE_CLOSE_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`role closure exceeded its ${timeoutMs} ms deadline`)), timeoutMs); });
  try {
    const closed = Promise.all(Object.entries(roles).map(async ([name, role]) => [name, await role.whenClosed()]));
    return Object.fromEntries(await Promise.race([closed, timeout]));
  } finally {
    clearTimeout(timer);
  }
}

export async function stopRoles(roles, { timeoutMs = ROLE_CLOSE_TIMEOUT_MS, failure } = {}) {
  try {
    killAll(roles);
    const closed = await waitForClose(roles, timeoutMs);
    if (failure?.role_closure_confirmed === false) failure.role_closure_confirmed = true;
    return closed;
  } catch (error) {
    const failed = failure ?? error;
    failed.role_closure_error = error.message;
    failed.role_closure_confirmed = false;
    throw failed;
  }
}

async function stopRole(name, role) {
  role.send({ type: "stop" });
  await role.next("stopped", name);
  const closed = (await waitForClose({ [name]: role }))[name];
  assert.equal(closed.code, 0, `${name} must close cleanly`);
  return closed;
}

function checkResolutions({ service, resolved }) {
  for (const url of Object.values(resolved)) assertResolution({ service, resolved: url });
}

// One exchange between a fresh ingress, storing under `directory` and answering by `faultPlan`, and a fresh
// sender given `senderInput`. The role scripts are the ones the runner's import-closure check validated
// (plan.mjs ROLE_SCRIPTS) under `probeDirectory`. The started roles are set on `roles`, an object owned by
// this exchange, so the caller can kill them and attach their stderr whatever happens. `proceed` is asked
// again just before the sender spawns: a session halted while its ingress started spawns no sender.
export async function roleExchange({ service, directory, flags, probeDirectory, senderInput, faultPlan, roles, token, proceed = () => true }) {
  const script = (role) => roleProcessPath({ prefix: join(service, "harness"), probeDirectory, role });
  roles.ingress = spawnRole({ service, script: script("ingress"), flags: flags.ingress });
  roles.ingress.send({ type: "start", token, fault_plan: faultPlan, storage_directory: directory, owners: OWNERS });
  const ready = await roles.ingress.next("ready", "ingress");
  checkResolutions({ service, resolved: ready.resolved });
  if (!proceed()) throw new Error("session halted before the sender started");
  roles.sender = spawnRole({ service, script: script("sender"), flags: flags.sender });
  roles.sender.send({ type: "start", expectations: senderInput, origin: `http://127.0.0.1:${ready.port}`, token, port: ready.port });
  const report = await roles.sender.next("report", "sender");
  checkResolutions({ service, resolved: report.resolved });
  const senderClosed = await stopRole("sender", roles.sender);
  roles.ingress.send({ type: "finalize" });
  const back = await roles.ingress.next("read_back", "ingress");
  assert.equal(back.quiescent, true, "final read-back requires ingress quiescence");
  const ingressClosed = await stopRole("ingress", roles.ingress);
  const { type: _ready, ...ingress } = ready;
  const { type: _report, ...sender } = report;
  return { ingress: { ...ingress, records: back.records, read_back: back.read_back, quiescent: back.quiescent }, sender, role_closure: { sender: senderClosed, ingress: ingressClosed }, occurrence_count: report.ledger.occurrence_count };
}

// The failure that ends a session carries each started role's bounded stderr, with the run's token
// redacted, so a crash that spends a run stays diagnosable from its results.
export function withRoleStderr({ error, roles, token }) {
  error.role_stderr = Object.fromEntries(Object.entries(roles).map(([name, role]) => [name, role.stderr().replaceAll(token, "[redacted token]")]));
  return error;
}
