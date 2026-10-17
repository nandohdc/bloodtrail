// FUTURE approval-gated entry. Build-only task 1.1 must never execute this file.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argumentsFor } from "../lib/arguments.mjs";
import { kitPipeline } from "../lib/kit-pipeline.mjs";
import { copyApprovedFiles, launchProbe } from "../lib/launcher.mjs";
import { command, jsonFile, sha256 } from "../lib/io.mjs";
import { CHANGE, resultRecord, deliverResults } from "../lib/results.mjs";
import { validateExpectations } from "../lib/expectations.mjs";
import { PROBE_FILES } from "./roles.mjs";
import { evaluateCases } from "./evaluate.mjs";
import { runApprovedSession, runSession } from "./orchestrate.mjs";

const options = argumentsFor({ args: process.argv.slice(2), run: true });
const started = new Date().toISOString();
const prefix = `${CHANGE}/harness`;
const expectationsPath = `${prefix}/expectations/p-ids.v1.json`;
const repo = resolve(options.repo || command({ program: "git", args: ["rev-parse", "--show-toplevel"] }).trim());
assert(Number.isInteger(Number(options["run-number"])) && Number(options["run-number"]) >= 1 && Number(options["run-number"]) <= 10, "run number outside shared authorization");
const expectations = validateExpectations(jsonFile(join(repo, expectationsPath)));
const expectationHash = sha256(readFileSync(join(repo, expectationsPath)));
let approval = null;
let attempted = false;
let executedHashes;

function writeSession({ provenance, observations, invalidations, occurrence_count }) {
  const cases = evaluateCases({ observations, expectations });
  const result = resultRecord({
    runNumber: Number(options["run-number"]), approvedHead: options.approvedHead, approval,
    expectations: { path: expectationsPath, sha256: expectationHash }, started, ended: new Date().toISOString(),
    provenance: { driver: options.driver, ...provenance, executed_file_hashes: executedHashes }, cases, invalidations, occurrenceCount: occurrence_count,
  });
  attempted = true;
  return deliverResults({ path: options.results, result });
}

function prepare({ service, approvedHead, repo: root, provenance }) {
  copyApprovedFiles({ repo: root, approvedHead, service, prefix, paths: PROBE_FILES.map((path) => `${prefix}/${path}`) });
  return (role) => launchProbe({ ...role, service, flags: provenance.permission_flags });
}

const session = await runApprovedSession({
  options, entrypoint: import.meta.url,
  session: async (record, hashes) => {
    approval = record;
    executedHashes = hashes;
    return runSession({ pipeline: (consume) => kitPipeline(options, consume), prepare, expectations, write: writeSession });
  },
  failure: ({ error, approval: record }) => {
    approval = record;
    if (!attempted) writeSession({ provenance: {}, observations: [], invalidations: [error.message], occurrence_count: 0 });
  },
  refuse: (reason) => console.error(reason),
});
process.exitCode = session.exitCode;
