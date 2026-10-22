// FUTURE approval-gated entry only; task 3.1 never invokes this file.
import { runAttr } from "./roles.mjs";

const session = await runAttr({ entrypoint: import.meta.url });
process.exitCode = session.exitCode;
