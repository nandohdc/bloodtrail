// Observers every probe's evaluator shares. Each reads one pass's raw sender and ingress observations.

// The live planted-defect controls each role ran before any traffic, and the guard's recorded violations.
export function isolationControls({ sender, ingress }) {
  return {
    sender_loopback_guard: sender.controls.loopback_guard.holds, sender_write_refused: sender.controls.write_outside_grant.holds,
    sender_synthetic_data: sender.controls.synthetic_data.holds, ingress_write_refused: ingress.controls.write_outside_grant.holds,
    guard_violations: sender.guard_violations.map((entry) => entry.host),
  };
}
