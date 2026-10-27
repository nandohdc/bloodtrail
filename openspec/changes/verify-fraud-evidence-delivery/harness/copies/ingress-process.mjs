// Ingress role for the Stage 2 copies probe (#839). Runs inside the own service under the permission model.
// Supports both persistent SQLite storage and storage-less in-memory operation, as well as restarting
// storage across processes while preserving SQLite database files.
import { reportViolations } from "../lib/role-guard.mjs";
import { join } from "node:path";
import * as collector from "@bloodtrail/security-audit-collector";
import { faultInjector } from "../lib/faults.mjs";
import { readBack, startIngress } from "../lib/ingress.mjs";
import { requireControls, writeControls } from "../lib/controls.mjs";

reportViolations((violation) => process.send({ type: "violation", message: `non-loopback connection to ${violation.host}` }));

const state = { server: null, storage: null, quiescent: false, directory: null, token: null, owners: null, faultPlan: null };

async function start({ token, fault_plan: faultPlan, storage_directory: directory, owners, without_storage = false }) {
  state.directory = directory;
  state.token = token;
  state.owners = owners;
  state.faultPlan = faultPlan;
  const controls = requireControls({
    write_outside_grant: writeControls({
      refusedPath: join(process.cwd(), "planted-write"),
      allowedPath: join(directory, "null-control-write"),
    }),
  });
  if (!without_storage && directory) {
    state.storage = new collector.SqliteStorage({ location: join(directory, "collector.db") });
  } else {
    state.storage = null;
  }
  const ingressOptions = {
    authenticator: new collector.SyntheticFixtureAuthenticator([token]),
    ...(state.storage ? { storage: { port: state.storage, owners } } : {}),
  };
  const ingress = new collector.CollectorIngress(ingressOptions);
  state.server = await startIngress({ collector, ingress, faults: faultInjector(faultPlan) });
  return { type: "ready", port: state.server.port, controls, resolved: { collector: import.meta.resolve("@bloodtrail/security-audit-collector") } };
}

async function restart({ fault_plan: faultPlan }) {
  if (state.server) await state.server.close();
  if (state.storage) state.storage.close();
  // Re-open persistent SQLite storage on the existing collector.db file in state.directory
  state.storage = new collector.SqliteStorage({ location: join(state.directory, "collector.db") });
  const plan = faultPlan ?? state.faultPlan;
  const ingress = new collector.CollectorIngress({
    authenticator: new collector.SyntheticFixtureAuthenticator([state.token]),
    storage: { port: state.storage, owners: state.owners },
  });
  state.server = await startIngress({ collector, ingress, faults: faultInjector(plan) });
  return { type: "restarted", port: state.server.port };
}

function report() {
  return { type: "read_back", records: state.server.state.records, read_back: readBack({ state: state.server.state, storage: state.storage }) };
}

async function stop() {
  if (!state.quiescent && state.server) await state.server.close();
  if (state.storage) state.storage.close();
  return { type: "stopped" };
}

async function finalize() {
  await state.server.quiesce();
  state.quiescent = true;
  return { ...report(), quiescent: true };
}

const HANDLERS = { start, restart, read_back: async () => report(), finalize, stop };

process.on("message", (message) => {
  const handler = HANDLERS[message.type];
  if (handler === undefined) return;
  handler(message).then(
    (reply) => process.send(reply, () => { if (reply.type === "stopped") process.exit(0); }),
    (error) => process.send({ type: "error", message: error.message }),
  );
});
