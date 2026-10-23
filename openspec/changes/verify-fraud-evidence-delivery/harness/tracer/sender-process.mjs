// Sender role for the Stage 2 tracer (#836). Runs inside the own service under
// `node --permission --allow-net --allow-fs-read=<own service>`: it may not write or spawn, and the
// loopback guard refuses any non-loopback connection. It never runs outside an approved session. The role
// guard is the first import, so it is installed before the kit modules evaluate.
import { roleGuard as guard } from "../lib/role-guard.mjs";
import { randomBytes } from "node:crypto";
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
import { compositionSink, referenceComposition } from "../lib/composition.mjs";
import { gatedTimers, seededJitter, timerGate } from "../lib/clock.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { senderControls } from "../lib/controls.mjs";
import { haltOnViolations, kitResolutions, recordedCall, senderSdk, serveSender } from "../lib/sender-role.mjs";
import { tracerIdentities, tracerInput } from "./workload.mjs";

const mode = haltOnViolations();

function buildSdk({ expectations, origin, token }) {
  const gate = timerGate();
  const composition = referenceComposition({
    sdkNode, origin, token, parameters: expectations.composition, timers: gatedTimers({ gate }), jitter: seededJitter(expectations.composition.jitter_seed),
  });
  return { sdk: senderSdk({ sdkNode, input: expectations, sink: compositionSink({ composition }) }), composition };
}

async function emitWorkload({ sdk, expectations }) {
  const ledger = occurrenceLedger({ budget: expectations.planned_call_budget.processes.sender });
  const identities = tracerIdentities({ seed: expectations.workload.seed });
  const sessionKey = randomBytes(32);
  const calls = [];
  const invoke = () => sdk.authenticationSucceeded(tracerInput({ core, identities, at: expectations.clock.start, sessionKey }));
  for (let index = 0; index < expectations.workload.occurrences; index += 1) calls.push(await recordedCall({ ledger, label: "authenticationSucceeded", invoke }));
  return { calls, ledger: ledger.report(), identities };
}

async function run({ expectations, origin, token, port }) {
  const controls = await senderControls({ guard, port });
  mode.halt = true;
  const { sdk, composition } = buildSdk({ expectations, origin, token });
  const emitted = await emitWorkload({ sdk, expectations });
  const shutdownReport = await composition.shutdown();
  return {
    type: "report", resolved: kitResolutions((specifier) => import.meta.resolve(specifier)), controls, calls: emitted.calls, ledger: emitted.ledger, identities: emitted.identities,
    deliveries: Object.fromEntries(composition.deliveries), delivery_log: composition.deliveryLog, exchanges: composition.exchanges, callbacks: composition.callbacks,
    shutdown_report: shutdownReport, guard_violations: guard.violations,
  };
}

serveSender(run);
