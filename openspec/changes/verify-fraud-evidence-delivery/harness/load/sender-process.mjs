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
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
import { bestEffortComposition, compositionSink, referenceComposition } from "../lib/composition.mjs";
import { gatedTimers, seededJitter, timerGate } from "../lib/clock.mjs";
import { requireControls, senderControls } from "../lib/controls.mjs";
import { accountingControls } from "./controls.mjs";
import { emitBurst } from "./burst.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { haltOnViolations, kitResolutions, recordedCall, senderSdk, serveSender } from "../lib/sender-role.mjs";
import { tracerIdentities, tracerInput } from "../tracer/workload.mjs";
import { allowedInput, policyIdentities } from "./workload.mjs";

const mode = haltOnViolations();

function buildComposition({ input, origin, token }) {
  const parameters = input.composition;
  if (input.phase.kind === "best_effort") return bestEffortComposition({ sdkNode, origin, token, parameters });
  const gate = timerGate();
  if (input.phase.shutdown === "after_retry_scheduled") gate.close();
  const composition = referenceComposition({ sdkNode, origin, token, parameters, timers: gatedTimers({ gate }), jitter: seededJitter(parameters.jitter_seed) });
  return { ...composition, releaseRetries: () => gate.open() };
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

async function runSequence({ composition, phase, call }) {
  const calls = [];
  for (let index = 0; index < phase.occurrences; index += 1) calls.push(await call());
  return { calls, health: await composition.shutdown(), guarantees: composition.guarantees };
}

async function run({ expectations: input, origin, token, port }) {
  const controls = requireControls({ ...await senderControls({ guard, port }), accounting_checks: accountingControls() });
  mode.halt = true;
  const composition = buildComposition({ input, origin, token });
  const sdk = senderSdk({ sdkNode, input, sink: compositionSink({ composition }) });
  const ledger = occurrenceLedger({ budget: input.planned_call_budget.processes.sender });
  const { identities, call } = caller({ sdk, input, ledger });
  const runner = input.phase.kind === "best_effort" ? runSequence : emitBurst;
  const outcome = await runner({ composition, phase: input.phase, call });
  return {
    type: "report", resolved: kitResolutions((specifier) => import.meta.resolve(specifier)), controls, ...outcome, ledger: ledger.report(), identities,
    deliveries: Object.fromEntries(composition.deliveries), delivery_log: composition.deliveryLog, exchanges: composition.exchanges, callbacks: composition.callbacks,
    trace: composition.trace ?? [],
    guard_violations: guard.violations,
  };
}

serveSender(run);
