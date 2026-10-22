import { runSession } from "../lib/orchestrate.mjs";
import { resultRecord, deliverResults } from "../lib/results.mjs";
import { evaluateWithGuard } from "../lib/probe-runner.mjs";
import { P_MAP_BUDGET } from "../p-map/budget.mjs";
import { ROLES } from "../p-map/roles.mjs";
import { OPENED } from "./p-map-runner-fixtures.mjs";

const EARLY_FAILURES = new Set(["build", "identity", "install"]);
export const RAW_PROCESS = { role: "sequential", records: [{ step_id: "L1/fixture", raw: { ok: true } }],
  baselines: { records: [{ step_id: "B-LOGOUT/emit", accepted: true }] },
  invalidations: [], ledger: { occurrence_count: 1 } };

function pipeline(context, consume) {
  const provenance = { invalidations: [], driver: { run_id: "fixture", harness: "pi" },
    identity: { commit: context.head, distributable: true },
    install: { single_core: { npm_ls_paths: ["fixture/core"], filesystem_paths: ["fixture/core"] } },
    permission_flags: ["--permission", "--allow-fs-read=/fixture/own-service"],
    executed_file_hashes: context.hashes };
  if (EARLY_FAILURES.has(context.stage)) {
    provenance.invalidations.push({ message: `fixture ${context.stage} failed` });
    return provenance;
  }
  return consume({ provenance }).then((observed) => {
    provenance.observations = observed;
    provenance.scratch_deletion = { recursively_absent: context.stage !== "cleanup" };
    if (context.stage === "cleanup") provenance.invalidations.push("fixture cleanup failure");
    return provenance;
  });
}

function persist(context, input) {
  const evaluated = evaluateWithGuard({ plan: { evaluate: () => {
    if (context.stage === "evaluation") throw new Error("fixture evaluator fault");
    return { evaluations: ["fixture retained result"] };
  } }, context: { expectations: {} }, observations: input.observations, invalidations: input.invalidations });
  context.evidence = resultRecord({ probe: "P-map", ticket: 804, runNumber: 5, approvedHead: context.head,
    approval: context.approval, expectations: { sha256: "e".repeat(64) }, started: OPENED, ended: OPENED,
    provenance: input.provenance, cases: evaluated.cases, invalidations: evaluated.invalidations, occurrenceCount: input.occurrence_count });
  context.evidence.process_observations = input.observations;
  return deliverResults({ path: context.destination, result: context.evidence,
    write: () => { if (context.stage === "write") throw new Error("fixture results-write fault"); },
    stderr: (text) => { context.fallback = JSON.parse(text); } });
}

export async function retainedSession({ fixture, approval, hashes, stage }) {
  const context = { head: fixture.options.approvedHead, destination: fixture.options.results, approval, hashes, stage };
  const session = await runSession({ probe: "P-map", ticket: 804, roles: ROLES,
    expectations: { planned_occurrence_budget: P_MAP_BUDGET },
    pipeline: (consume) => pipeline(context, consume),
    prepare: () => async (role) => {
      if (stage === "launch") throw new Error("fixture child launch fault");
      return { ...structuredClone(RAW_PROCESS), role: role.role };
    }, write: (input) => persist(context, input) });
  return { ...context, session };
}
