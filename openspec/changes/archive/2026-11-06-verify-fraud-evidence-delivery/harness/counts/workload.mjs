// Q261: the accepted chains reconstruction generator and branded input builder.
import { assertSynthetic } from "../lib/workload.mjs";
import { buildEventInput, generateWorkloadDefinition } from "../chains/workload.mjs";

export function workloadFor(expectations, phase) {
  const workload = generateWorkloadDefinition({
    seed: expectations.workload.seed + phase.seed_offset,
    chainCount: phase.chain_count,
    tenantCount: phase.tenant_count,
    failedCount: phase.failed_count,
    clockStart: expectations.clock.start,
    clockStepMs: expectations.clock.step_ms,
  });
  workload.submissionSteps.forEach(assertStepSynthetic);
  if (phase.name === "copies_identities") adaptReExecution(workload.submissionSteps);
  return workload;
}

function adaptReExecution(steps) {
  const original = steps.find((step) => step.method === "authenticationSucceeded");
  const replacement = steps.findLastIndex((step) => step.method === "authenticationSucceeded");
  steps[replacement] = { ...original, retry: { retry_attempt: 1 } };
}

function assertStepSynthetic(step) {
  const ids = Object.entries(step.identity)
    .filter(isIdentifierEntry)
    .map(([, value]) => value);
  assertSynthetic({ ids, addresses: [step.identity.address] });
}

function isIdentifierEntry([key, value]) {
  return key !== "address" && typeof value === "string";
}

export function inputFor({ core, step, sessionKey }) {
  assertStepSynthetic(step);
  return buildEventInput({ core, method: step.method, identity: step.identity, at: step.at, sessionKey });
}

export function category(method) {
  if (method === "authenticationSucceeded") return "successful";
  if (method === "authenticationFailed") return "failed";
  return "other";
}

export function signature(step) {
  return JSON.stringify([step.method, step.identity.address, step.at, step.retry?.retry_attempt ?? 0]);
}

export function sourceTruth(workload) {
  const truth = {};
  for (const step of workload.submissionSteps) {
    const source = step.identity.address;
    if (!Object.hasOwn(truth, source)) truth[source] = { successful: 0, failed: 0, other: 0 };
    truth[source][category(step.method)] += 1;
  }
  return truth;
}
