import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argumentsFor } from "./arguments.mjs";
import { kitPipeline } from "./kit-pipeline.mjs";
import { copyApprovedFiles, launchProbe } from "./launcher.mjs";
import { command, jsonFile, sha256 } from "./io.mjs";
import { CHANGE, resultRecord, deliverResults } from "./results.mjs";
import { runApprovedSession, runSession } from "./orchestrate.mjs";
import { probeProcessPath, requireProbe, requireRoles } from "./plan.mjs";

export async function runProbe(plan) {
  requireProbe(plan);
  requireRoles(plan);
  probeProcessPath({ prefix: `${CHANGE}/harness`, probeDirectory: plan.probeDirectory });
  const options = argumentsFor({ args: process.argv.slice(2), run: true });
  const started = new Date().toISOString();
  const prefix = `${CHANGE}/harness`;
  const expectationsPath = `${prefix}/expectations/${plan.probeDirectory}.v1.json`;
  const repo = resolve(options.repo || command({ program: "git", args: ["rev-parse", "--show-toplevel"] }).trim());
  assert(Number.isInteger(Number(options["run-number"])) && Number(options["run-number"]) >= 1 && Number(options["run-number"]) <= 10, "run number outside shared authorization");
  const expectations = plan.validate(jsonFile(join(repo, expectationsPath)));
  const expectationHash = sha256(readFileSync(join(repo, expectationsPath)));
  const context = { plan, options, started, prefix, expectationsPath, expectationHash, approval: null, attempted: false };
  return approvedSession({ context, expectations });
}

function writeSession(context, { provenance, observations, invalidations, occurrence_count }) {
  const { options, plan } = context;
  const cases = plan.evaluate({ observations, expectations: context.expectations });
  const result = resultRecord({
    probe: plan.probe, ticket: plan.ticket, runNumber: Number(options["run-number"]), approvedHead: options.approvedHead, approval: context.approval,
    expectations: { path: context.expectationsPath, sha256: context.expectationHash }, started: context.started, ended: new Date().toISOString(),
    provenance: { driver: options.driver, ...provenance, executed_file_hashes: context.hashes }, cases, invalidations, occurrenceCount: occurrence_count,
  });
  if (plan.retainProcesses) result.process_observations = observations;
  context.attempted = true;
  return deliverResults({ path: options.results, result, serialize: plan.serialize });
}

function prepare(context, { service, approvedHead, repo, provenance }) {
  const { prefix, plan } = context;
  copyApprovedFiles({ repo, approvedHead, service, prefix, paths: plan.files.map((path) => `${prefix}/${path}`) });
  return (role) => launchProbe({ ...role, service, flags: provenance.permission_flags, probeDirectory: plan.probeDirectory, prefix, inventory: context.hashes });
}

async function approvedSession({ context, expectations }) {
  context.expectations = expectations;
  const { options, plan } = context;
  const session = await runApprovedSession({
    options, entrypoint: plan.entrypoint, probe: plan.probe, ticket: plan.ticket,
    session: async (record, hashes) => {
      context.approval = record;
      context.hashes = hashes;
      return runSession({ probe: plan.probe, ticket: plan.ticket, pipeline: (consume) => kitPipeline(options, consume), prepare: (input) => prepare(context, input), expectations, roles: plan.roles, write: (input) => writeSession(context, input) });
    },
    failure: ({ error, approval }) => {
      context.approval = approval;
      if (!context.attempted) writeSession(context, { provenance: {}, observations: [], invalidations: [error.message], occurrence_count: 0 });
    },
    refuse: (reason) => console.error(reason),
  });
  return session;
}
