import { acknowledgingExchange, exchangeThrower, scripted, timeoutOutcome } from "./scripts.mjs";
import { committedGate, deliverStep, scriptedDelivery, summarize, throwingOnce,
  trueProbe, truthfulSetup } from "./redelivery-steps.mjs";

const VALUE_VARIANTS = [
  { id: "gate-failed", probe: true, gate: "failed" },
  { id: "gate-undefined", probe: true, gate: undefined },
  { id: "probe-one", probe: 1, gate: "committed" },
  { id: "probe-string", probe: "no", gate: "committed" },
];
const FALSY_STEPS = ["falsy-zero", "falsy-empty", "falsy-undefined"];
const CALLBACK_STEPS = ["mark", "emit", "throw", "retry"];
const RETRY_STEPS = ["mark", "emit", "first", "second"];

function variantSteps(prefixes, steps) {
  return prefixes.flatMap((prefix) => steps.map((id) => `${prefix}/${id}`));
}

async function twice(state, setup, steps) {
  const deliver = deliverStep(state, setup, setup.deliveries[0]);
  for (const id of steps) await deliver(id);
}

export async function throwingCallbacksCase(state, entry) {
  const gateSetup = await truthfulSetup(state, entry,
    [{ exchange: acknowledgingExchange(), probe: trueProbe,
      gate: throwingOnce({ label: "gate", recovered: "committed" }) }], "gate");
  await twice(state, gateSetup, ["throw", "retry"]);
  const probeSetup = await truthfulSetup(state, entry,
    [{ exchange: acknowledgingExchange(), probe: throwingOnce({ label: "probe", recovered: true }),
      gate: committedGate }], "probe");
  await twice(state, probeSetup, ["throw", "retry"]);
  return summarize(state, entry, [gateSetup, probeSetup], variantSteps(["gate", "probe"], CALLBACK_STEPS));
}

export async function retryAfterFailClosedCase(state, entry, overrides) {
  const probe = overrides.probeA ?? scripted([false, true], true);
  const gate = overrides.gateB ?? scripted(["declined", "committed"], "committed");
  const probeSetup = await truthfulSetup(state, entry,
    [{ exchange: acknowledgingExchange(), probe, gate: committedGate }], "probe-false");
  await twice(state, probeSetup, ["first", "second"]);
  const gateSetup = await truthfulSetup(state, entry,
    [{ exchange: acknowledgingExchange(), probe: trueProbe, gate }], "gate-declined");
  await twice(state, gateSetup, ["first", "second"]);
  return summarize(state, entry, [probeSetup, gateSetup], variantSteps(["probe-false", "gate-declined"], RETRY_STEPS));
}

export async function unexpectedValuesCase(state, entry) {
  const setup = await truthfulSetup(state, entry, []);
  for (const variant of VALUE_VARIANTS) {
    const unit = scriptedDelivery(state, { exchange: acknowledgingExchange(),
      probe: scripted([variant.probe], true), gate: scripted([variant.gate], "committed") });
    setup.deliveries.push(unit);
    await deliverStep(state, setup, unit)(variant.id);
  }
  const falsyUnit = scriptedDelivery(state, { exchange: acknowledgingExchange(),
    probe: scripted([0, "", undefined], true), gate: committedGate });
  setup.deliveries.push(falsyUnit);
  const deliver = deliverStep(state, setup, falsyUnit);
  for (const id of FALSY_STEPS) await deliver(id);
  return summarize(state, entry, [setup], ["mark", "emit", ...VALUE_VARIANTS.map((row) => row.id), ...FALSY_STEPS]);
}

export async function exchangeFaultsCase(state, entry) {
  const setup = await truthfulSetup(state, entry, [
    { exchange: exchangeThrower(), probe: trueProbe, gate: committedGate },
    { exchange: timeoutOutcome(), probe: trueProbe, gate: committedGate },
  ]);
  const steps = [];
  for (const [index, prefix] of ["throw", "timeout"].entries()) {
    const deliver = deliverStep(state, setup, setup.deliveries[index]);
    await deliver(prefix);
    await deliver(`${prefix}-redeliver`);
    steps.push(prefix, `${prefix}-redeliver`);
  }
  return summarize(state, entry, [setup], ["mark", "emit", ...steps]);
}
