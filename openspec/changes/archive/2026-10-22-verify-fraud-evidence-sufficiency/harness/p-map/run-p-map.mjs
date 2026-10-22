// FUTURE approval-gated entry only; task 5.1 never invokes this file.
import { runPmap } from "./roles.mjs";

if (import.meta.main) {
  const session = await runPmap({ entrypoint: import.meta.url });
  process.exitCode = session.exitCode;
}
