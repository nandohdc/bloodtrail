import { delivery } from "./delivery.mjs";
import { caseSummary, recordStep } from "./case-steps.mjs";
import { acknowledgingExchange } from "./scripts.mjs";
import { trueProbe } from "./redelivery-steps.mjs";

export const GUARANTEES_CASE = {
  case_id: "P-E-g", family: "guarantees", comment_id: "6137619745",
  setup: "Read a fresh binding's guarantees, Object.isFrozen(guarantees) and Object.keys(binding). Parent-only comparisons consume each owned row of P-E-2b/5/7/8 independently; tabulate every planned step against eight contract columns. All layout and analysis choices are implementer defaults; G-log supplies the Node factory for event-building peers.",
  expected: "Exactly {deliveryClass:'transaction_critical',semantic:'at_least_once',claimsAtLeastOnce:true,failsClosedBeforeCommit:true}, frozen. Public keys ['guarantees','deliver']; no shutdown/flush/backlog surface. Compare declared claims separately with row-local observations, never a production verdict.",
  classification: "Truthful-order before-commit refusal is vacuous (2b); standalone persistent retry/at-least-once is not provided (5); dedupe is per-instance (7); fail-closed can follow the gate (8); shutdown and backlog alert are not provided by this binding.",
  basis: ["packages/security-audit-sdk-node/src/delivery-classes.ts:44-52,225-232,258-288,342-356",
    "contracts/security-audit/source/contract.source.json:595-604"],
  confidence: "high", predicted_calls: 2,
  predicted: { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 },
};

export async function guaranteesCase(state, entry = GUARANTEES_CASE) {
  state.current = entry.case_id;
  const seqStart = state.sequence.length;
  const made = delivery(state, { exchange: acknowledgingExchange(), durabilityProbe: trueProbe });
  const counters = () => ({ probe: made.probe.counts.calls, gate: 0,
    exchange: made.boundary.counts.calls, sink: 0, business_commits: 0 });
  await recordStep(state, { id: "read", counters,
    run: () => ({ guarantees: structuredClone(made.binding.guarantees),
      guarantees_frozen: Object.isFrozen(made.binding.guarantees), public_keys: Object.keys(made.binding) }) });
  return caseSummary(state, entry, { seqStart, steps: ["read"], actual: counters() });
}
