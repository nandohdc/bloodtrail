import { CONCRETE_CASES, CORRECTED_AT, COMMENT } from "../p-map/plan.mjs";
import { SIGNAL_RULES, dependencies, ownerReadings } from "../p-map/signal-rules.mjs";
import { logoutWorkload } from "../p-map/logout-workload.mjs";
import { mfaWorkload } from "../p-map/mfa-workload.mjs";
import { contactWorkload, brandWorkload } from "../p-map/contact-workload.mjs";
import { lockoutWorkload } from "../p-map/lockout-workload.mjs";
import { unlockWorkload } from "../p-map/unlock-workload.mjs";
import { rotationWorkload } from "../p-map/rotation-workload.mjs";
import { observations } from "../p-map/runtime.mjs";
import { lmFixture } from "./p-map-lm-fixtures.mjs";
import { cxFixture } from "./p-map-cx-fixtures.mjs";
import { kuFixture } from "./p-map-ku-fixtures.mjs";
import { rotationFixture } from "./p-map-r-fixtures.mjs";
import { LM_ORACLE } from "./p-map-lm-oracle.mjs";
import { CX_ORACLE } from "./p-map-cx-oracle.mjs";
import { KU_ORACLE } from "./p-map-ku-oracle.mjs";
import { R_ORACLE } from "./p-map-r-oracle.mjs";
import { SIGNAL_ORACLE, equal } from "./p-map-evaluation-oracle.mjs";
import { BASELINE_PLAN } from "../p-map/baseline-cases.mjs";
import { P_MAP_BUDGET, P_MAP_PREDICTED_TOTAL } from "../p-map/budget.mjs";

export const EMISSION_ORACLE = [...LM_ORACLE, ...CX_ORACLE, ...KU_ORACLE, ...R_ORACLE];
const EMISSIONS = new Map(EMISSION_ORACLE.map((row) => [row.step_id, row]));
const BOUNDARY = new Set(["kind", "accepted", "sink_count"]);

// Hand-written intermediate-step expectations from operations.ts:108-111,
// 212-222. Only inventory/metadata comes from descriptors, not observations.
function plannedStep(case_id, id) {
  const step_id = `${case_id}/${id}`;
  const oracle = EMISSIONS.get(step_id);
  if (oracle !== undefined) return { step_id, kind: oracle.fields.kind, accepted: oracle.fields.accepted,
    sink_count: oracle.fields.sink_count, assertions: Object.entries(oracle.fields)
      .filter(([path]) => !BOUNDARY.has(path)).map(([path, value]) => equal(path, value)) };
  const assertions = [equal("raw.ok", true)];
  if (!id.endsWith("begin")) assertions.push(equal("handle.state", handleState(case_id, id)));
  return { step_id, kind: "returned", accepted: true, sink_count: 0, assertions };
}

function handleState(case_id, id) {
  if (id === "compensate") return "compensated";
  if (case_id === "L5c") return "not_committed";
  return "committed";
}

function concretePlan(entry) {
  const row = { case_id: entry.case_id, setup: entry.setup, basis: entry.basis, confidence: entry.confidence,
    predicted_calls: entry.predicted_calls, expected: entry.steps.map((id) => plannedStep(entry.case_id, id)) };
  if (entry.candidate_verdict !== undefined) Object.assign(row, { verdict: entry.candidate_verdict, rubric_reasons: entry.rubric_reasons });
  if (entry.owner_review_required === true) Object.assign(row, { owner_review_required: true, alternative_verdict: entry.alternative_verdict });
  return row;
}

function signalPlan(oracle) {
  const rule = SIGNAL_RULES.find((entry) => entry.case_id === oracle.id);
  const alternatives = ownerReadings(rule);
  return { case_id: oracle.id, setup: "Fixture-only source-cited signal classification; no separate SDK invocation",
    basis: ["#804 comment 6137646538 rubric"], confidence: "medium", predicted_calls: 0, dependencies: dependencies(rule),
    verdict: oracle.verdict, rubric_reasons: [oracle.clause], owner_review_required: alternatives.length > 0,
    alternative_verdicts: alternatives, expected: { assertions: [
      ...oracle.best.map((id, index) => equal(`components.${index}.best_candidate`, id)),
      equal(`findings.observed.${oracle.finding[0]}`, oracle.finding[1]), equal("catalog_addition_nominated", false),
    ] } };
}

function criterionPlan(signals) {
  const alternative_verdicts = signals.flatMap((entry) => entry.alternative_verdicts.map((reading) => ({ ...reading,
    affected_signal: entry.case_id, criterion_2: "FAIL", misfits: [entry.case_id] })));
  return { case_id: "S-CRIT2", setup: "Best accepted expression for each signal; no misfits under recommended defaults",
    basis: ["#795 decision log G10"], confidence: "low", predicted_calls: 0,
    dependencies: SIGNAL_ORACLE.map((entry) => entry.id), verdict: "PASS", rubric_reasons: ["No required signal misrepresents"],
    owner_review_required: true, alternative_verdicts, expected: { assertions: [equal("misfits", []), equal("inconclusive", []),
      equal("conditional", true), equal("signals", SIGNAL_ORACLE.map((entry) => ({ case_id: entry.id, verdict: entry.verdict })))] } };
}

export function evaluationPlan() {
  const signals = SIGNAL_ORACLE.map(signalPlan);
  return structuredClone({ probe: "P-map", version: 1, corrected_at: CORRECTED_AT, drafted_from: { commit: "5d931ad", comment: COMMENT },
    baseline_plan: BASELINE_PLAN, planned_occurrence_budget: P_MAP_BUDGET, predicted_total: P_MAP_PREDICTED_TOTAL,
    cases: [...signals, criterionPlan(signals), ...CONCRETE_CASES.map(concretePlan)] });
}

export async function evaluationFixture() {
  const lm = lmFixture();
  await logoutWorkload(lm.state);
  await mfaWorkload(lm.state);
  const cx = cxFixture();
  await contactWorkload(cx.state);
  await brandWorkload(cx.state);
  const ku = kuFixture();
  const lock = await lockoutWorkload(ku.state);
  await unlockWorkload(ku.state, lock);
  const r = rotationFixture();
  await rotationWorkload(r.state);
  return { expectations: evaluationPlan(), observations: [lm, cx, ku, r].map(({ state }) => observations(state)) };
}
