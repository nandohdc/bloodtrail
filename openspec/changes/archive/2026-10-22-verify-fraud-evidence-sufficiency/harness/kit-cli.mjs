import { argumentsFor } from "./lib/arguments.mjs";
import { kitPipeline } from "./lib/kit-pipeline.mjs";

const options = argumentsFor({ args: process.argv.slice(2) });
if (!options.dryRun) throw new Error("Use the approval-gated probe CLI for execution; kit CLI permits --dry-run only");
const result = await kitPipeline(options);
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
process.exitCode = result.invalidations.length === 0 ? 0 : 1;
