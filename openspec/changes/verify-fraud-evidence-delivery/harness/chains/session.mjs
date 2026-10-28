// Orchestrator side of the chains session (#840, Q207, Q209, Q221).
// Sequences the units in two passes (small pass and volume pass) under the frozen deadline.
import { exchangeUnit, gatedSession } from "../lib/gated-session.mjs";
import { senderInput as baseSenderInput } from "../copies/session.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { reconstructChains } from "./reconstruct.mjs";

export function senderInput({ expectations, phase }) {
  const base = baseSenderInput({ expectations, phase });
  return {
    ...base,
    phase: {
      ...base.phase,
      chain_count: phase.chain_count,
      tenant_count: phase.tenant_count,
      failed_count: phase.failed_count,
      seed_offset: phase.seed_offset,
    },
  };
}

export async function exchangeChainsUnit({ context, unit, senderInput: makeSenderInput }) {
  const result = await exchangeUnit({
    context,
    unit,
    probeDirectory: "chains",
    senderInput: makeSenderInput,
  });

  const persistedBodies = result.ingress?.persisted_bodies ?? [];
  const reconstruction = reconstructChains(persistedBodies);

  return {
    ...result,
    reconstruction,
    occurrence_count: result.occurrence_count,
  };
}

export function chainsSession({ service, storage, flags, expectations, exchange = exchangeChainsUnit, spawn }) {
  return gatedSession({
    expectations,
    units: expectations.phases,
    evaluate: evaluateCases,
    key: "phases",
    base: { service, storage, flags, ...(spawn !== undefined ? { spawn } : {}) },
    runUnit: ({ context, unit }) => exchange({
      context,
      unit,
      senderInput: (u) => senderInput({ expectations: context.expectations, phase: u }),
    }),
  });
}
