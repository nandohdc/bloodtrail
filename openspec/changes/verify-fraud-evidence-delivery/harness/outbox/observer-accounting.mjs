// H-11 accounts for every frozen occurrence, including records deliberately rolled back.
import { computeAccounting } from "./observations.mjs";
import { allTrue, arrayCount, read } from "./observer-access.mjs";
import { isRollbackDiscarded } from "./observer-predicates.mjs";

function missingAccounting() {
  return { holds: false, accounted: false, unexplained: -1 };
}

function rollbackAccounting(phase, config) {
  const discarded = isRollbackDiscarded({
    host: read(phase, "sender.host"), count: config.change_count,
    relayed: read(phase, "sender.relayed_count"),
    persisted: arrayCount(read(phase, "ingress.persisted_bodies")),
  });
  const holds = allTrue([
    discarded, arrayCount(read(phase, "ingress.records")) === 0,
    arrayCount(read(phase, "ingress.read_back")) === 0,
    arrayCount(read(phase, "sender.exchanges")) === 0,
  ]);
  return { holds, accounted: holds, unexplained: holds ? 0 : config.occurrences };
}

function evaluateSinglePhaseAccounting(phase, config) {
  if (!phase) return missingAccounting();
  if (!config) return missingAccounting();
  if (!Array.isArray(read(phase, "ingress.persisted_bodies"))) return missingAccounting();
  if (config.kind === "rollback") return rollbackAccounting(phase, config);
  const accounting = computeAccounting(phase, config.occurrences);
  return {
    holds: accounting.holds === true,
    accounted: accounting.counts.persisted === config.occurrences,
    unexplained: accounting.counts.unexplained,
  };
}

export function accountingIdentityObserver({ observed, expectations, caseDef }) {
  const results = caseDef.phases.map((name) => evaluateSinglePhaseAccounting(
    read(observed, name), expectations.phases.find((p) => p.name === name),
  ));
  return {
    all_phases_hold: allTrue(results.map((result) => result.holds)),
    unexplained_total: results.reduce((sum, result) => sum + result.unexplained, 0),
    every_occurrence_accounted: allTrue(results.map((result) => result.accounted)),
  };
}
