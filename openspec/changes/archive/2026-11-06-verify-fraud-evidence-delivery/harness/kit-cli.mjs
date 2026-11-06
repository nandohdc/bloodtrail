// Dry-run entry: builds the evaluation kit from the clean HEAD, verifies its identity, installs the own
// service and checks every harness symbol against the packed declarations as text. It imports and runs no
// kit code, makes no probe traffic and spends no run; scratch is deleted before it exits.
import { argumentsFor } from "./lib/arguments.mjs";
import { kitPipeline } from "./lib/kit-pipeline.mjs";

const options = argumentsFor({ args: process.argv.slice(2) });
const result = await kitPipeline({ ...options, dryRun: true });
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
process.exitCode = result.invalidations.length === 0 ? 0 : 1;
