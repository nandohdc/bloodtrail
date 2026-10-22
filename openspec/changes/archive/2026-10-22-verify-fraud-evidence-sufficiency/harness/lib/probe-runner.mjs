import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argumentsFor } from "./arguments.mjs";
import { kitPipeline } from "./kit-pipeline.mjs";
import { copyApprovedFiles, launchProbe } from "./launcher.mjs";
import { command, jsonFile, sha256 } from "./io.mjs";
import { validateProbeInventory } from "./import-closure.mjs";
import { CHANGE, resultRecord, deliverResults } from "./results.mjs";
import { runApprovedSession, runSession } from "./orchestrate.mjs";
import { probeProcessPath, requireDatabasePlan, requireProbe, requireRoles } from "./plan.mjs";

export async function runProbe(plan) {
  requireProbe(plan);
  requireRoles(plan);
  requireDatabasePlan(plan);
  probeProcessPath({ prefix: `${CHANGE}/harness`, probeDirectory: plan.probeDirectory });
  const options = argumentsFor({ args: process.argv.slice(2), run: true });
  const started = new Date().toISOString();
  const prefix = `${CHANGE}/harness`;
  const expectationsPath = `${prefix}/expectations/${plan.probeDirectory}.v1.json`;
  const repo = resolve(options.repo || command({ program: "git", args: ["rev-parse", "--show-toplevel"] }).trim());
  assert(Number.isInteger(Number(options["run-number"])) && Number(options["run-number"]) >= 1 && Number(options["run-number"]) <= 10, "run number outside shared authorization");
  const expectations = plan.validate(jsonFile(join(repo, expectationsPath)));
  const expectationHash = sha256(readFileSync(join(repo, expectationsPath)));
  // Pre-run inventory validation: the probe process's full relative import
  // closure must be a subset of plan.files before any claim or marker, so a
  // missing support module never spends an approved run.
  validateProbeInventory({ repo, prefix, probeDirectory: plan.probeDirectory, files: plan.files });
  const evaluationSource = { repo, approvedHead: options.approvedHead };
  const context = { plan, options, started, prefix, expectationsPath, expectationHash, evaluationSource, approval: null, attempted: false };
  return approvedSession({ context, expectations });
}

// Q2: the evaluator is total, but the shared runner still guards every
// probe's plan.evaluate: a fault becomes an invalidation and the results
// are still written with every raw observation and process record.
export function evaluateWithGuard({ plan, context, observations, invalidations = context?.invalidations ?? [] }) {
  try {
    return { cases: plan.evaluate({ observations, expectations: context.expectations, source: context.evaluationSource }), invalidations };
  } catch (error) {
    invalidations.push({ message: `evaluation fault: ${error.message}`, attribution: "harness_fault" });
    return { cases: { evaluations: [], verdict: null }, invalidations };
  }
}

export function writeSession(context, { provenance, observations, invalidations, occurrence_count }) {
  const { options, plan } = context;
  const evaluated = evaluateWithGuard({ plan, context, observations, invalidations });
  const result = resultRecord({
    probe: plan.probe, ticket: plan.ticket, runNumber: Number(options["run-number"]), approvedHead: options.approvedHead, approval: context.approval,
    expectations: { path: context.expectationsPath, sha256: context.expectationHash }, started: context.started, ended: new Date().toISOString(),
    provenance: { driver: options.driver, ...provenance, executed_file_hashes: context.hashes }, cases: evaluated.cases, invalidations: evaluated.invalidations, occurrenceCount: occurrence_count,
  });
  if (plan.retainProcesses) result.process_observations = observations;
  context.attempted = true;
  return deliverResults({ path: options.results, result, serialize: plan.serialize });
}

function prepare(context, { service, approvedHead, repo, provenance, database }) {
  const { prefix, plan } = context;
  copyApprovedFiles({ repo, approvedHead, service, prefix, paths: plan.files.map((path) => `${prefix}/${path}`) });
  return (role) => launchProbe({ ...role, service, database, flags: provenance.permission_flags, probeDirectory: plan.probeDirectory, prefix, inventory: context.hashes });
}

async function approvedSession({ context, expectations }) {
  context.expectations = expectations;
  const { options, plan } = context;
  const session = await runApprovedSession({
    options, entrypoint: plan.entrypoint, probe: plan.probe, ticket: plan.ticket,
    session: async (record, hashes) => {
      context.approval = record;
      context.hashes = hashes;
      return runSession({ probe: plan.probe, ticket: plan.ticket, pipeline: (consume) => kitPipeline({ ...options, databaseScratch: plan.databaseScratch }, consume), prepare: (input) => prepare(context, input), expectations, roles: plan.roles, write: (input) => writeSession(context, input) });
    },
    failure: ({ error, approval }) => {
      context.approval = approval;
      if (!context.attempted) writeSession(context, { provenance: {}, observations: [], invalidations: [error.message], occurrence_count: 0 });
    },
    refuse: (reason) => console.error(reason),
  });
  return session;
}
