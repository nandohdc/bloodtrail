import { baseInput, createInstance, emissions, operations, publicCall, RoleRefusal } from "./workload.mjs";
import { collisionControls, identifierProvider, setupGate, twoInstance } from "./controls.mjs";

async function measuredSequence({ state, plan }) {
  let identifiers;
  if (plan.randomProvider) identifiers = identifierProvider({ state, mode: "random" });
  const instance = createInstance({ state, identifiers, omitIdentifiers: !(plan.undefinedIdentifiers || plan.randomProvider) });
  const sdk = instance.value;
  if (plan.operationsFirst) operations({ state, sdk, count: plan.operationsFirst });
  if (plan.emissions) {
    const input = baseInput({ state });
    const passed = await emissions({ state, sdk, input, count: plan.emissions, stopOnRefusal: Boolean(plan.precondition) });
    if (!passed) return;
  }
  if (plan.operations) operations({ state, sdk, count: plan.operations });
  if (plan.inspect) state.retention = publicCall({ state, label: "inspectSdkRetentionForTesting", invoke: () => state.testing.inspectSdkRetentionForTesting(sdk) }).value;
}

const SPECIAL = {
  setup: setupGate,
  "two-instance": twoInstance,
  controls: collisionControls,
};

export async function measureRole({ state, plan }) {
  state.refusals = [];
  try {
    if (plan.kind) await SPECIAL[plan.kind]({ state });
    else await measuredSequence({ state, plan });
  } catch (error) {
    const ordinary = error instanceof RoleRefusal && !plan.precondition && plan.kind !== "setup";
    const target = ordinary ? state.refusals : state.invalidations;
    target.push(error.message);
  }
}
