// Imported first by every Stage 2 role process, so it evaluates before any kit module does: the loopback
// guard is installed before a kit module could open a connection while it loads, and any uncaught failure
// reaches the orchestrator as an error report instead of a bare exit.
import { installLoopbackGuard } from "./loopback-guard.mjs";

const reporter = { onViolation: null };

export const roleGuard = installLoopbackGuard({ onViolation: (violation) => reporter.onViolation?.(violation) });

// The role decides how later violations are reported once its body runs. Violations recorded while the
// modules loaded are reported at once, whatever the role decides.
export function reportViolations(onViolation) {
  for (const violation of roleGuard.violations) process.send({ type: "violation", message: `non-loopback connection while modules loaded: ${violation.host}` });
  reporter.onViolation = onViolation;
}

function reportUncaught(error) {
  const message = { type: "error", message: `uncaught ${error?.name ?? "failure"}: ${error?.message ?? String(error)}` };
  if (process.connected) process.send(message, () => process.exit(1));
  else process.exit(1);
}

process.on("uncaughtException", reportUncaught);
process.on("unhandledRejection", reportUncaught);
