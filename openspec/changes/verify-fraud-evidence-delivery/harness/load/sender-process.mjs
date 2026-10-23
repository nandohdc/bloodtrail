// Sender role for the Stage 2 load probe (#838). Runs inside the own service under the same permission grant
// as the tracer's sender, and never outside an approved session. The role guard is the first import, so it
// is installed before the kit modules evaluate. One phase per process:
// - a burst: every occurrence is submitted at once through the reference composition, so each meets the
//   admission gate before any held delivery can settle. Shutdown follows either once every delivery settled
//   or as soon as every occurrence met the gate, and the phase's later submissions arrive while it is
//   shutting down;
// - best_effort: occurrences in sequence through the binding's best_effort class.
import { roleGuard as guard } from "../lib/role-guard.mjs";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
import { bestEffortComposition, compositionSink, referenceComposition } from "../lib/composition.mjs";
import { gatedTimers, seededJitter, timerGate } from "../lib/clock.mjs";
import { senderControls } from "../lib/controls.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { haltOnViolations, kitResolutions, recordedCall, senderSdk, serveSender } from "../lib/sender-role.mjs";
import { tracerIdentities, tracerInput } from "../tracer/workload.mjs";
import { allowedInput, policyIdentities } from "./workload.mjs";

const mode = haltOnViolations();

function buildComposition({ input, origin, token }) {
  const parameters = input.composition;
  if (input.phase.kind === "best_effort") return bestEffortComposition({ sdkNode, origin, token, parameters });
  return referenceComposition({ sdkNode, origin, token, parameters, timers: gatedTimers({ gate: timerGate() }), jitter: seededJitter(parameters.jitter_seed) });
}

// One SDK call of the phase's event, counted against the ledger before it is made.
function caller({ sdk, input, ledger }) {
  if (input.phase.kind === "best_effort") {
    const identities = policyIdentities({ seed: input.workload.seed });
    const invoke = () => sdk.authorizationAllowed(allowedInput({ core, identities }));
    return { identities, call: () => recordedCall({ ledger, label: "authorizationAllowed", invoke }) };
  }
  const identities = tracerIdentities({ seed: input.workload.seed });
  const sessionKey = randomBytes(32);
  const invoke = () => sdk.authenticationSucceeded(tracerInput({ core, identities, at: input.clock.start, sessionKey }));
  return { identities, call: () => recordedCall({ ledger, label: "authenticationSucceeded", invoke }) };
}

// Waits, one event-loop turn at a time, until every burst occurrence has met the admission gate, or until
// every call has settled: a call that ends before the gate (refused by the SDK, or rejected by the
// lifecycle) never meets it, and the run must then report what happened rather than spin to its deadline.
async function gateDecisions({ composition, count, settled }) {
  const decided = () => composition.callbacks.admitted.length + composition.callbacks.rejected_overload.length;
  while (decided() < count && settled.count < count) await new Promise((resolveTurn) => { setImmediate(resolveTurn); });
}

// Each call's outcome is observed as it is made, so a rejection is never unhandled while the burst waits;
// it surfaces where the calls are awaited, and fails the phase through the role's error path.
function submit({ call, settled }) {
  const promise = call();
  promise.then(() => { settled.count += 1; }, () => { settled.count += 1; });
  return promise;
}

async function runBurst({ composition, phase, call }) {
  const settled = { count: 0 };
  const calls = Array.from({ length: phase.occurrences }, () => submit({ call, settled }));
  await gateDecisions({ composition, count: phase.occurrences, settled });
  if (phase.shutdown === "after_settle") await Promise.all(calls);
  const started = performance.now();
  const report = composition.shutdown();
  const later = Array.from({ length: phase.after_shutdown }, () => submit({ call, settled }));
  const shutdownReport = await report;
  const elapsed = Math.round(performance.now() - started);
  return { calls: await Promise.all([...calls, ...later]), shutdown_report: shutdownReport, shutdown_elapsed_ms: elapsed };
}

async function runSequence({ composition, phase, call }) {
  const calls = [];
  for (let index = 0; index < phase.occurrences; index += 1) calls.push(await call());
  return { calls, health: await composition.shutdown(), guarantees: composition.guarantees };
}

async function run({ expectations: input, origin, token, port }) {
  const controls = await senderControls({ guard, port });
  mode.halt = true;
  const composition = buildComposition({ input, origin, token });
  const sdk = senderSdk({ sdkNode, input, sink: compositionSink({ composition }) });
  const ledger = occurrenceLedger({ budget: input.planned_call_budget.processes.sender });
  const { identities, call } = caller({ sdk, input, ledger });
  const runner = input.phase.kind === "best_effort" ? runSequence : runBurst;
  const outcome = await runner({ composition, phase: input.phase, call });
  return {
    type: "report", resolved: kitResolutions((specifier) => import.meta.resolve(specifier)), controls, ...outcome, ledger: ledger.report(), identities,
    deliveries: Object.fromEntries(composition.deliveries), delivery_log: composition.deliveryLog, exchanges: composition.exchanges, callbacks: composition.callbacks,
    guard_violations: guard.violations,
  };
}

serveSender(run);
