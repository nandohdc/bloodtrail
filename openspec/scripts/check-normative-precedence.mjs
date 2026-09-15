#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatDiagnostics,
  inspectRepository,
  loadPolicy,
  STAGES
} from "./normative-precedence/model.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, "../..");

function parseArgs(args) {
  const options = { repoRoot: defaultRoot, policyPath: undefined, stage: "candidate", baseCommit: null, json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--repo") options.repoRoot = resolve(args[++index]);
    else if (arg === "--policy") options.policyPath = args[++index];
    else if (arg === "--stage") options.stage = args[++index];
    else if (arg === "--base") options.baseCommit = args[++index];
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function usage() {
  console.log("Usage: node openspec/scripts/check-normative-precedence.mjs [--repo PATH] [--policy PATH] [--stage candidate|merge|activation|release] [--base COMMIT] [--json]");
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }
  if (!STAGES.includes(options.stage)) throw new Error(`unsupported stage ${options.stage}`);
  const { policy, schema } = loadPolicy(options.repoRoot, options.policyPath);
  const result = inspectRepository(options.repoRoot, policy, { stage: options.stage, schema, baseCommit: options.baseCommit });
  if (options.json) {
    console.log(JSON.stringify({ stage: options.stage, ...result }, null, 2));
  } else {
    if (result.observations.length > 0) console.log(formatDiagnostics(result.observations));
    if (result.diagnostics.length > 0) console.error(formatDiagnostics(result.diagnostics));
    else console.log(`normative precedence passed at ${options.stage} stage`);
  }
  process.exit(result.diagnostics.length === 0 ? 0 : 1);
} catch (error) {
  console.error(`normative-precedence-checker-error: ${error.message}`);
  process.exit(2);
}
