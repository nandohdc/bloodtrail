// FUTURE approval-gated entry only; task 4.1 never invokes this file.
import { runPe } from "./roles.mjs";

const session = await runPe({ entrypoint: import.meta.url });
process.exitCode = session.exitCode;
