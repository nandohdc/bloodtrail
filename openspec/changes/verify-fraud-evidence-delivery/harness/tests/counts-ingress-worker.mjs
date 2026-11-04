// The fake ingress has its own event loop, while remaining in the rehearsal process.
import { EventEmitter } from "node:events";
import { parentPort, workerData } from "node:worker_threads";
import { bindIngressProcess } from "../counts/ingress-role.mjs";
import { makeRestartCollector } from "./collector-fixture.mjs";

const proc = new EventEmitter();
proc.send = (message, callback) => {
  parentPort.postMessage(JSON.parse(JSON.stringify(message)));
  if (callback) callback();
};
proc.exit = () => parentPort.close();
parentPort.on("message", (message) => proc.emit("message", message));

bindIngressProcess({
  collector: makeRestartCollector(), proc, resolved: { collector: workerData.collector },
  controlsFor: () => ({ write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true } }),
});
