import { randomBytes } from "node:crypto";
import { requireControls } from "../lib/controls.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { senderFactories as copiesFactories, awaitProcessMessage } from "../copies/sender-phases.mjs";
import { createEngine } from "./engine.mjs";
import { observeComposition } from "./deliveries.mjs";
import { environmentLabel } from "./environment.mjs";
import { latencyObservation } from "./observations.mjs";
import { runPhase } from "./phases.mjs";
import { workloadFor } from "./workload.mjs";

export { awaitProcessMessage };

export function senderFactories({ deps, input, origin, token, engine }) {
  const base = copiesFactories({ sdkNode: deps.sdkNode, senderSdk: deps.senderSdk });
  return {
    buildComposition: (options) => observeComposition(base.buildComposition({ input, origin, token, ...options }), engine.deliveryReports),
    buildSdk: ({ composition, onCaptured }) => base.buildSdk({
      input, composition, onCaptured: (event) => engine.capture(event, onCaptured),
    }),
  };
}

export async function senderRun({ deps, message }) {
  const input = message.expectations;
  const controls = requireControls(await deps.senderControls(message.port));
  deps.onBeforeRun();
  const ledger = occurrenceLedger({ budget: input.planned_call_budget.processes.sender });
  const engine = createEngine({ deps, ledger, sessionKey: randomBytes(32) });
  const factories = senderFactories({ deps, input, origin: message.origin, token: message.token, engine });
  const workload = workloadFor(input, input.phase);
  const outcome = await runPhase({ deps, input, ledger, engine, factories, steps: workload.submissionSteps });
  return {
    type: "report", resolved: deps.resolved(), controls,
    ...outcome, emissions: engine.emissions, delivery_reports: engine.deliveryReports,
    ledger: ledger.report(), guard_violations: deps.guardViolations(),
    observation: { measured_at: "sender", environment: environmentLabel(), delivery_latency: latencyObservation(engine.latencies) },
  };
}
