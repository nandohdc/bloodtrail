// H-08 through H-10; H-11 is kept in its own accounting module.
import { allTrue, arrayCount, phaseFor, read } from "./observer-access.mjs";
import { crashPersistenceIdentityObserver } from "./observers-atomicity.mjs";
export { accountingIdentityObserver } from "./observer-accounting.mjs";

export function plantedControlsObserver(args) {
  const checks = read(phaseFor(args), "sender.controls.outbox_checks");
  const name = args.caseDef.phases[0];
  const observe = (value) => crashPersistenceIdentityObserver({ ...args, observed: { [name]: value } });
  const planted = observe(read(checks, "planted"));
  const honest = observe(read(checks, "null_control"));
  return {
    mark_before_ack_defect_detected: allTrue([
      read(checks, "mark_before_ack_defect_detected") === true,
      planted.crash_fired === true,
      planted.persisted_count === args.config.change_count - args.caseDef.expected.lost_records,
      planted.persisted_exactly_once === false,
    ]),
    null_control_passed: allTrue([
      read(checks, "null_control_passed") === true, honest.persisted_exactly_once === true,
    ]),
    lost_records: args.config.change_count - planted.persisted_count,
  };
}

export function hostDbIsolationObserver(args) {
  const isolation = read(phaseFor(args), "sender.controls.host_db_isolation");
  return {
    host_database_grant_isolated: read(isolation, "host_database_grant_isolated") === true,
    planted_write_refused: read(isolation, "planted_write_refused") === true,
    null_control_allowed: read(isolation, "null_control_allowed") === true,
  };
}

function checkGuardViolation(phase, count) {
  const violations = read(phase, "sender.guard_violations");
  if (!Array.isArray(violations)) return false;
  if (violations.length !== count) return false;
  return violations[0].host === "192.0.2.1";
}

function holds(phase, path) {
  return read(phase, path) === true;
}

export function isolationControlsObserver(args) {
  const phases = args.caseDef.phases.map((name) => read(args.observed, name));
  const every = (path) => allTrue(phases.map((phase) => holds(phase, path)));
  return {
    loopback_holds: every("sender.controls.loopback_guard.holds"),
    permissions_hold: allTrue([
      every("sender.controls.write_outside_grant.holds"),
      every("ingress.controls.write_outside_grant.holds"),
    ]),
    synthetic_data_holds: every("sender.controls.synthetic_data.holds"),
    guard_violations_match: allTrue(phases.map((phase) => checkGuardViolation(phase, args.caseDef.expected.guard_violation_count))),
    guard_violation_count: arrayCount(read(phases[0], "sender.guard_violations")),
  };
}
