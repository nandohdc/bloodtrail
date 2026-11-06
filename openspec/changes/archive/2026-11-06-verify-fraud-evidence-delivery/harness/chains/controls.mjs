// Planted-defect controls for the chains probe (#840, Q208 R-09, Q228, Q235, Q241).
// Executed by live senders before emitting probe traffic.
import { randomUUID } from "node:crypto";
import {
  chainReconstructionObserver,
  eventTimeOrderObserver,
  noSharedSourceMergeObserver,
} from "./evaluate.mjs";
import { reconstructChains, reconstructMergeBySource, reconstructOrderByArrival } from "./reconstruct.mjs";
import { CHAIN_EVENTS, generateWorkloadDefinition, sessionFingerprint } from "./workload.mjs";
import { TRANSACTION_BOUND_METHODS } from "./call-plan.mjs";

function buildEventSection(step, isFailed, isTxBound) {
  const name = isFailed ? "bloodtrail.audit.authentication.failed" : CHAIN_EVENTS[step.stepIndex];
  return {
    id: randomUUID(),
    name,
    timestamp: step.at,
    observed_at: step.at,
    outcome: isFailed ? "failure" : "success",
    commit_state: isTxBound ? "committed" : "not_applicable",
  };
}

function buildActorSection(ident, isFailed) {
  if (isFailed) {
    return { type: "anonymous", provenance: { trust_level: "client_claim", source: "request_boundary" } };
  }
  return {
    type: "authenticated_human",
    id: ident.accountId,
    tenant_id: ident.tenantId,
    provenance: { trust_level: "authoritative_server", source: "synthetic-server-authentication-authority" },
  };
}

function buildCorrelationSection(step, ident, idx, isTxBound) {
  const corr = { correlation_id: randomUUID() };
  if (isTxBound) {
    corr.operation_id = `op_${randomUUID()}`;
    corr.transaction_id = `tx_${randomUUID()}`;
  }
  if (step.method === "passwordResetCompleted") {
    corr.causation_id = ident.causationId ?? `syn-recovery-${idx}`;
    corr.original_event_id = ident.originalEventId ?? `syn-recovery-${idx}`;
  }
  return corr;
}

function buildContextSections(step, ident, fp) {
  if (step.method === "passwordResetCompleted") {
    return {
      resource: { type: "credential", id: ident.credentialId, owning_tenant_id: ident.tenantId, data_classification: "confidential" },
      authorization: {
        decision: "allow", capability: "complete_password_reset", enforcement_point: "recovery-transaction-owner",
        policy_id: "policy.audit-fixture", policy_version: "1.0.0", decision_reason: "accepted",
        resource_context: { type: "credential", id: ident.credentialId },
        tenant_context: { effective_tenant_id: ident.tenantId }, override: false, break_glass: false,
      },
    };
  }
  if (step.method === "mfaRemoved") {
    return {
      resource: { type: "credential", id: ident.credentialId, owning_tenant_id: ident.tenantId, data_classification: "confidential" },
      authorization: {
        decision: "allow", capability: "remove_mfa", enforcement_point: "mfa-account-authority",
        policy_id: "policy.audit-fixture", policy_version: "1.0.0",
      },
    };
  }
  if (step.method === "sessionRevoked") {
    return {
      resource: { type: "session", id: fp, owning_tenant_id: ident.tenantId, data_classification: "confidential" },
      authorization: {
        decision: "allow", capability: "revoke_session", enforcement_point: "session-authority",
        policy_id: "policy.audit-fixture", policy_version: "1.0.0",
      },
    };
  }
  return { resource: undefined, authorization: undefined };
}

function buildRunShapedBody(step, idx, workload) {
  const ident = step.identity;
  const isFailed = step.method === "authenticationFailed";
  const isTxBound = TRANSACTION_BOUND_METHODS.has(step.method);
  const fp = isFailed ? null : sessionFingerprint({ key: workload.sessionKey, handle: ident.sessionHandle });
  const contexts = buildContextSections(step, ident, fp);

  return {
    event: buildEventSection(step, isFailed, isTxBound),
    tenant: isFailed ? { scope: "tenantless" } : { effective_tenant_id: ident.tenantId, scope: "tenant" },
    actor: buildActorSection(ident, isFailed),
    authenticated_principal: isFailed ? undefined : { id: ident.accountId },
    session: isFailed ? undefined : { id: fp, created_at: step.at, age_seconds: 0, assurance_level: "aal2" },
    source: { observed: { address: ident.address, port: 443 } },
    request: isFailed ? { id: ident.requestId ?? `req_ctrl_${idx}`, method: "POST" } : undefined,
    correlation: buildCorrelationSection(step, ident, idx, isTxBound),
    resource: contexts.resource,
    authorization: contexts.authorization,
  };
}

export function makeControlsBodiesFixture(workload) {
  return workload.submissionSteps.map((step, idx) => buildRunShapedBody(step, idx, workload));
}

function makeFakeExpectations(groundTruth) {
  return {
    phases: [{ name: "chains_small" }],
    ground_truth: { chains_small: groundTruth },
  };
}

function checkMergeBySourceDefect(plantedMerge, groundTruth, persistedBodies) {
  const expectations = makeFakeExpectations(groundTruth);
  const obsMerge = noSharedSourceMergeObserver({
    observed: { chains_small: { reconstruction: plantedMerge, ingress: { persisted_bodies: persistedBodies } } },
    expectations,
    caseDef: { ground_truth: groundTruth },
  });
  const obsChain = chainReconstructionObserver({
    observed: { chains_small: { reconstruction: plantedMerge, ingress: { persisted_bodies: persistedBodies } } },
    expectations,
    caseDef: { ground_truth: groundTruth },
  });
  const mergeDetected = obsMerge?.shared_source_accounts_separated === false;
  const chainDetected = obsChain?.chains_match === false;
  return mergeDetected && chainDetected;
}

function checkArrivalOrderDefect(plantedArrival, persistedBodies) {
  const expectations = { phases: [{ name: "chains_small" }] };
  const obs = eventTimeOrderObserver({
    observed: { chains_small: { reconstruction: plantedArrival, ingress: { persisted_bodies: persistedBodies } } },
    expectations,
  });
  return obs?.event_time_ordered === false;
}

function checkNullControls(honest, groundTruth, persistedBodies) {
  const expectations = makeFakeExpectations(groundTruth);
  const obsMerge = noSharedSourceMergeObserver({
    observed: { chains_small: { reconstruction: honest, ingress: { persisted_bodies: persistedBodies } } },
    expectations,
    caseDef: { ground_truth: groundTruth },
  });
  const obsArrival = eventTimeOrderObserver({
    observed: { chains_small: { reconstruction: honest, ingress: { persisted_bodies: persistedBodies } } },
    expectations,
  });
  const obsChain = chainReconstructionObserver({
    observed: { chains_small: { reconstruction: honest, ingress: { persisted_bodies: persistedBodies } } },
    expectations,
    caseDef: { ground_truth: groundTruth },
  });
  const mergePass = obsMerge?.shared_source_accounts_separated === true;
  const arrivalPass = obsArrival?.event_time_ordered === true;
  const chainPass = obsChain?.chains_match === true;
  return mergePass && arrivalPass && chainPass;
}

export function chainsControls() {
  const workload = generateWorkloadDefinition({
    seed: 840999,
    chainCount: 6,
    tenantCount: 3,
    failedCount: 6,
  });

  const persistedBodies = makeControlsBodiesFixture(workload);
  const plantedMerge = reconstructMergeBySource(persistedBodies);
  const plantedArrival = reconstructOrderByArrival(persistedBodies);
  const honest = reconstructChains(persistedBodies);

  const mergeDetected = checkMergeBySourceDefect(plantedMerge, workload.groundTruth, persistedBodies);
  const arrivalDetected = checkArrivalOrderDefect(plantedArrival, persistedBodies);
  const nullPass = checkNullControls(honest, workload.groundTruth, persistedBodies);
  const holds = mergeDetected === true && arrivalDetected === true && nullPass === true;

  return {
    merge_by_source_defect_detected: mergeDetected,
    arrival_order_defect_detected: arrivalDetected,
    null_controls_pass: nullPass,
    holds,
  };
}
