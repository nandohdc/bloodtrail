// Sender role for the Stage 2 tracer (#836). Runs inside the own service under
// `node --permission --allow-net --allow-fs-read=<own service>`: it may not write or spawn, and the
// loopback guard refuses any non-loopback connection. It never runs outside an approved session. The role
// guard is the first import, so it is installed before the kit modules evaluate.
import { reportViolations, roleGuard as guard } from "../lib/role-guard.mjs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
import { compositionSink, referenceComposition } from "../lib/composition.mjs";
import { gatedTimers, seededJitter, syntheticClock, timerGate } from "../lib/clock.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { guardControls, requireControls, syntheticControls, writeControls } from "../lib/controls.mjs";
import { tracerIdentities, tracerInput } from "./workload.mjs";

// The planted guard control makes one deliberate violation before traffic; from then on every violation
// halts the run.
const mode = { halt: false };
reportViolations((violation) => {
  if (mode.halt) process.send({ type: "violation", message: `non-loopback connection to ${violation.host}` });
});

function resolutions() {
  return {
    core: import.meta.resolve("@bloodtrail/security-audit-sdk-core"),
    node: import.meta.resolve("@bloodtrail/security-audit-sdk-node"),
  };
}

async function runControls({ port }) {
  return requireControls({
    loopback_guard: await guardControls({ guard, port }),
    write_outside_grant: writeControls({ refusedPath: join(process.cwd(), "planted-write"), allowedReadPath: join(process.cwd(), "package.json") }),
    synthetic_data: syntheticControls(),
  });
}

function buildSdk({ expectations, origin, token }) {
  const gate = timerGate();
  const composition = referenceComposition({
    sdkNode, origin, token, parameters: expectations.composition, timers: gatedTimers({ gate }), jitter: seededJitter(expectations.composition.jitter_seed),
  });
  const sdk = sdkNode.createNodeSecurityAuditSdk({
    contractVersion: expectations.contract_version, producer: { name: "stage-2-harness", version: "1.0.0" },
    service: { name: "stage-2-own-service", version: "1.0.0" }, environment: { name: "synthetic" },
    sink: compositionSink({ composition }), clock: syntheticClock({ start: expectations.clock.start, stepMs: expectations.clock.step_ms }),
  });
  return { sdk, composition };
}

async function emitWorkload({ sdk, expectations }) {
  const ledger = occurrenceLedger({ budget: expectations.planned_call_budget.processes.sender });
  const identities = tracerIdentities({ seed: expectations.workload.seed });
  const sessionKey = randomBytes(32);
  const calls = [];
  for (let index = 0; index < expectations.workload.occurrences; index += 1) {
    ledger.take("authenticationSucceeded");
    const result = await sdk.authenticationSucceeded(tracerInput({ core, identities, at: expectations.clock.start, sessionKey }));
    calls.push({ label: "authenticationSucceeded", ok: result.ok, value: result.ok ? result.value : undefined, error: result.ok ? undefined : result.error });
  }
  return { calls, ledger: ledger.report(), identities };
}

async function run({ expectations, origin, token, port }) {
  const controls = await runControls({ port });
  mode.halt = true;
  const { sdk, composition } = buildSdk({ expectations, origin, token });
  const emitted = await emitWorkload({ sdk, expectations });
  const shutdownReport = await composition.shutdown();
  return {
    type: "report", resolved: resolutions(), controls, calls: emitted.calls, ledger: emitted.ledger, identities: emitted.identities,
    deliveries: Object.fromEntries(composition.deliveries), delivery_log: composition.deliveryLog, exchanges: composition.exchanges, callbacks: composition.callbacks,
    shutdown_report: shutdownReport, guard_violations: guard.violations,
  };
}

process.on("message", (message) => {
  if (message.type === "start") run(message).then((report) => process.send(report), (error) => process.send({ type: "error", message: error.message }));
  if (message.type === "stop") process.send({ type: "stopped" }, () => process.exit(0));
});
