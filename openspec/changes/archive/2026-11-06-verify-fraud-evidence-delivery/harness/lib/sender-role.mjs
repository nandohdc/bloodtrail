// Plumbing every sender role shares: the violation switch, the kit resolutions it reports, the SDK it builds
// over a probe's sink, the ledger-counted call record and the IPC handler. It imports no kit code: the role
// script imports the kit and passes it in.
import { reportViolations } from "./role-guard.mjs";
import { syntheticClock } from "./clock.mjs";

// The planted guard control makes one deliberate violation before traffic. The role sets `halt` once its
// controls ran; from then on every violation halts the run.
export function haltOnViolations() {
  const mode = { halt: false };
  reportViolations((violation) => {
    if (mode.halt) process.send({ type: "violation", message: `non-loopback connection to ${violation.host}` });
  });
  return mode;
}

// Where the kit resolves from the role script that imports it: the role passes its own resolver
// (`(specifier) => import.meta.resolve(specifier)`), so the orchestrator checks the role's kit, not this module's.
export function kitResolutions(resolve) {
  return { core: resolve("@bloodtrail/security-audit-sdk-core"), node: resolve("@bloodtrail/security-audit-sdk-node") };
}

// The Node binding's SDK over the probe's sink, on the frozen synthetic clock.
export function senderSdk({ sdkNode, input, sink }) {
  return sdkNode.createNodeSecurityAuditSdk({
    contractVersion: input.contract_version, producer: { name: "stage-2-harness", version: "1.0.0" },
    service: { name: "stage-2-own-service", version: "1.0.0" }, environment: { name: "synthetic" },
    sink, clock: syntheticClock({ start: input.clock.start, stepMs: input.clock.step_ms }),
  });
}

// One SDK call, counted against the ledger before it is made, recorded as its result.
export async function recordedCall({ ledger, label, invoke }) {
  ledger.take(label);
  const result = await invoke();
  return { label, ok: result.ok, value: result.ok ? result.value : undefined, error: result.ok ? undefined : result.error };
}

export function serveSender(run) {
  process.on("message", (message) => {
    if (message.type === "start") run(message).then((report) => process.send(report), (error) => process.send({ type: "error", message: error.message }));
    if (message.type === "stop") process.send({ type: "stopped" }, () => process.exit(0));
  });
}
