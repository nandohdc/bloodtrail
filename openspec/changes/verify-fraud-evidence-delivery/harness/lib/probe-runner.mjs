// The shared approval-gated runner for every Stage 2 probe.
//
// plan = { probe, ticket, probeDirectory, entrypoint, validate, files, session, evaluate }
//   - session({ service, storage, flags, expectations }) runs the probe's two processes and returns raw
//     observations; evaluate({ observations, expectations }) compares them with the frozen expectations.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argumentsFor } from "./arguments.mjs";
import { kitPipeline } from "./kit-pipeline.mjs";
import { copyApprovedFiles } from "./launcher.mjs";
import { command, jsonFile, sha256 } from "./io.mjs";
import { validateProbeInventory } from "./import-closure.mjs";
import { CHANGE, G42, G46, RUN_LIMIT, deliverResults, invalidationOf, resultRecord } from "./results.mjs";
import { runApprovedSession } from "./orchestrate.mjs";
import { ROLE_SCRIPTS, requireProbe } from "./plan.mjs";

const PREFIX = `${CHANGE}/harness`;

// A fault in the evaluator becomes an invalidation; the raw observations are still written.
export function evaluateWithGuard({ plan, observations, expectations, invalidations }) {
  try {
    return { cases: plan.evaluate({ observations, expectations }), invalidations };
  } catch (error) {
    invalidations.push({ ...invalidationOf(`evaluation fault: ${error.message}`), attribution: "harness_fault" });
    return { cases: { evaluations: [], verdict: null }, invalidations };
  }
}

// A fault while building the record itself (for example a wall clock that stepped back) must not drop a
// spent run's evidence: the raw provenance and observations are written with the fault as an invalidation.
export function fallbackRecord(context, { provenance, observations, cases, invalidations, occurrenceCount, error, ended = new Date().toISOString() }) {
  const { plan, options } = context;
  return {
    probe: plan.probe, ticket: plan.ticket, run_id: Number(options["run-number"]), record_fault: true, started_at: context.started, ended_at: ended,
    authorization: { reference: `${CHANGE}/proposal.md#run-authorization at ${options.approvedHead}`, G42, G46 }, approval: context.approval ?? null,
    expectations: { path: context.expectationsPath, sha256: context.expectationHash }, provenance, cases,
    occurrence_count: occurrenceCount, call_bound: context.expectations.planned_call_budget.total,
    invalidations: [...invalidations, invalidationOf(`result record fault: ${error.message}`)], observations,
  };
}

// Writes the run's one results file and reports whether it was written with no invalidation.
function writeSession(context, { provenance, observations, invalidations, occurrenceCount }) {
  const { options, plan } = context;
  context.attempted = true;
  const evaluated = evaluateWithGuard({ plan, observations, expectations: context.expectations, invalidations });
  let result;
  try {
    result = resultRecord({
      probe: plan.probe, ticket: plan.ticket, runNumber: Number(options["run-number"]), approvedHead: options.approvedHead, approval: context.approval,
      expectations: { path: context.expectationsPath, sha256: context.expectationHash }, started: context.started, ended: new Date().toISOString(),
      provenance: { ...provenance, driver: options.driver, executed_file_hashes: context.hashes }, cases: evaluated.cases, invalidations: evaluated.invalidations, occurrenceCount,
      callBound: context.expectations.planned_call_budget.total,
    });
    result.observations = observations;
  } catch (error) {
    result = fallbackRecord(context, { provenance, observations, cases: evaluated.cases, invalidations: evaluated.invalidations, occurrenceCount, error });
  }
  return deliverResults({ path: options.results, result }) && result.invalidations.length === 0;
}

async function runSession(context) {
  const { options, plan, expectations } = context;
  const provenance = await kitPipeline(options, ({ service, storage, approvedHead, repo, provenance: built }) => {
    built.role_files = copyApprovedFiles({ repo, approvedHead, service, prefix: PREFIX, paths: plan.files.map((path) => `${PREFIX}/${path}`) });
    return plan.session({ service, storage, flags: built.permission_flags, expectations });
  });
  const observations = provenance.observations ?? null;
  delete provenance.observations;
  const invalidations = [...provenance.invalidations];
  const clean = writeSession(context, { provenance, observations, invalidations, occurrenceCount: observations?.occurrence_count ?? null });
  return { exitCode: clean ? 0 : 1 };
}

export async function runProbe(plan) {
  requireProbe(plan);
  const options = argumentsFor({ args: process.argv.slice(2), run: true, probe: plan.probe, ticket: plan.ticket });
  const runNumber = Number(options["run-number"]);
  assert(Number.isInteger(runNumber) && runNumber >= 1 && runNumber <= RUN_LIMIT, "run number outside shared authorization");
  const repo = resolve(options.repo || command({ program: "git", args: ["rev-parse", "--show-toplevel"] }).trim());
  const supportedVersions = plan.supportedVersions ?? [1];
  const version = options["expectations-version"] ? Number(options["expectations-version"]) : (plan.expectationsVersion ?? 1);
  assert(supportedVersions.includes(version), `unsupported expectations version ${version} for probe ${plan.probe} (supported: ${supportedVersions.join(", ")})`);

  let expectationsPath;
  if (options["expectations-path"]) {
    expectationsPath = options["expectations-path"];
    assert.equal(
      expectationsPath,
      `${PREFIX}/expectations/${plan.probeDirectory}.v${version}.json`,
      `expectations-path does not match approved version v${version}`,
    );
  } else {
    expectationsPath = `${PREFIX}/expectations/${plan.probeDirectory}.v${version}.json`;
  }
  const fullExpectationsPath = join(repo, expectationsPath);
  assert(existsSync(fullExpectationsPath), `expectations file does not exist: ${expectationsPath}`);
  const expectations = plan.validate(jsonFile(fullExpectationsPath));
  assert.equal(expectations.version, version, `expectations version mismatch: expected ${version}, got ${expectations.version}`);
  // The role scripts' full relative import closure must be declared before any claim, so a missing
  // support module never spends an approved run.
  validateProbeInventory({ repo, prefix: PREFIX, probeDirectory: plan.probeDirectory, files: plan.files, roleScripts: Object.values(ROLE_SCRIPTS) });
  const context = { plan, options, expectations, expectationsPath, expectationHash: sha256(readFileSync(fullExpectationsPath)), started: new Date().toISOString(), attempted: false };
  return runApprovedSession({
    options, entrypoint: plan.entrypoint, probe: plan.probe, ticket: plan.ticket,
    session: (approval, hashes) => {
      context.approval = approval;
      context.hashes = hashes;
      return runSession(context);
    },
    failure: ({ error, approval }) => {
      context.approval = approval;
      if (!context.attempted) writeSession(context, { provenance: {}, observations: null, invalidations: [invalidationOf(error)], occurrenceCount: null });
    },
    refuse: (reason) => console.error(reason),
  });
}
