// Ingress role for the Stage 2 tracer (#836). Runs inside the own service under the permission model with
// read access to the own service and read and write access to one collector-storage directory in scratch.
// The kit's collector, with SQLite storage there, decides admission, duplicates and persistence. The role
// guard is the first import, so it is installed before the kit module evaluates.
import { reportViolations } from "../lib/role-guard.mjs";
import { join } from "node:path";
import * as collector from "@bloodtrail/security-audit-collector";
import { faultInjector } from "../lib/faults.mjs";
import { readBack, startIngress } from "../lib/ingress.mjs";
import { requireControls, writeControls } from "../lib/controls.mjs";

reportViolations((violation) => process.send({ type: "violation", message: `non-loopback connection to ${violation.host}` }));

const state = { server: null, storage: null, quiescent: false };

async function start({ token, fault_plan: faultPlan, storage_directory: directory, owners }) {
  const controls = requireControls({ write_outside_grant: writeControls({ refusedPath: join(process.cwd(), "planted-write"), allowedPath: join(directory, "null-control-write") }) });
  state.storage = new collector.SqliteStorage({ location: join(directory, "collector.db") });
  const ingress = new collector.CollectorIngress({ authenticator: new collector.SyntheticFixtureAuthenticator([token]), storage: { port: state.storage, owners } });
  state.server = await startIngress({ collector, ingress, faults: faultInjector(faultPlan) });
  return { type: "ready", port: state.server.port, controls, resolved: { collector: import.meta.resolve("@bloodtrail/security-audit-collector") } };
}

function report() {
  return { type: "read_back", records: state.server.state.records, read_back: readBack({ state: state.server.state, storage: state.storage }) };
}

async function stop() {
  if (!state.quiescent) await state.server.close();
  state.storage.close();
  return { type: "stopped" };
}

async function finalize() {
  await state.server.quiesce();
  state.quiescent = true;
  return { ...report(), quiescent: true };
}

const HANDLERS = { start, read_back: async () => report(), finalize, stop };

process.on("message", (message) => {
  const handler = HANDLERS[message.type];
  if (handler === undefined) return;
  handler(message).then(
    (reply) => process.send(reply, () => { if (reply.type === "stopped") process.exit(0); }),
    (error) => process.send({ type: "error", message: error.message }),
  );
});
