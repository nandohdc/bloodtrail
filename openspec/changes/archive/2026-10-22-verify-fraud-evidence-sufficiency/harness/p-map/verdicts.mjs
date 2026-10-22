import { acceptedStep, stepMatched } from "./evidence.mjs";
import { SIGNAL_RULES, RANK, RUBRIC, ownerReadings } from "./signal-rules.mjs";
import { signalFindings } from "./signal-findings.mjs";

function candidateEvidence(candidate, context) {
  const row = context.rows.find((entry) => entry.case_id === candidate.case_id);
  const base = { case_id: candidate.case_id, rubric_reasons: candidate.rubric_reasons, basis: candidate.basis };
  if (row?.integrity !== true) return { ...base, status: "inconclusive", verdict: null };
  const expression = candidate.expressions.find((steps) => steps.every((id) => acceptedStep(context.records, id)));
  const relevant = expression === undefined ? candidate.expressions.flat() : expression;
  if (!relevant.every((id) => stepMatched(context, id))) return { ...base, status: "inconclusive", verdict: null };
  if (expression === undefined) return { ...base, status: "refused", verdict: null };
  const alternate = candidate.owner_review_required === true && context.readings[candidate.case_id] === "alternative";
  const verdict = alternate ? candidate.alternative_verdict.verdict : candidate.verdict;
  const rubric_reasons = alternate ? [candidate.alternative_verdict.condition, candidate.alternative_verdict.consequence] : candidate.rubric_reasons;
  return { ...base, status: "accepted", verdict, rubric_reasons };
}

function componentEvidence(component, context) {
  const candidates = component.candidates.map((candidate) => candidateEvidence(candidate, context));
  const accepted = candidates.filter((candidate) => candidate.status === "accepted");
  accepted.sort((left, right) => RANK[left.verdict] - RANK[right.verdict]);
  const best = accepted[0];
  const couldImprove = component.candidates.some((candidate, index) =>
    candidates[index].status === "inconclusive" && RANK[candidate.verdict] < (RANK[best?.verdict] ?? Infinity));
  const verdict = couldImprove ? null : (best?.verdict ?? null);
  return { component: component.name, candidates, best_candidate: best?.case_id ?? null, verdict };
}

function worstVerdict(components) {
  if (components.some((part) => part.verdict === null)) return null;
  return components.map((part) => part.verdict).sort((left, right) => RANK[right] - RANK[left])[0];
}

function signal(rule, context) {
  const components = rule.components.map((part) => componentEvidence(part, context));
  const verdict = worstVerdict(components);
  const alternatives = ownerReadings(rule);
  return { case_id: rule.case_id, verdict, status: verdict === null ? "inconclusive" : "conclusive", components,
    rubric_clause: RUBRIC[verdict] ?? null, rubric_basis: "#804 comment 6137646538 rubric",
    rubric_reasons: components.flatMap((part) => part.candidates.filter((item) => item.case_id === part.best_candidate)
      .flatMap((item) => item.rubric_reasons)),
    findings: signalFindings(rule.case_id, context), owner_review_required: alternatives.length > 0,
    alternative_verdicts: alternatives, catalog_addition_nominated: verdict === "MISREPRESENTS" };
}

function criterion(signals) {
  const misfits = signals.filter((row) => row.verdict === "MISREPRESENTS").map((row) => row.case_id);
  const inconclusive = signals.filter((row) => row.verdict === null).map((row) => row.case_id);
  const verdict = misfits.length > 0 ? "FAIL" : (inconclusive.length > 0 ? "INCONCLUSIVE" : "PASS");
  const alternatives = signals.flatMap((row) => row.alternative_verdicts.map((reading) => ({ ...reading,
    affected_signal: row.case_id, criterion_2: "FAIL", misfits: [row.case_id] })));
  return { case_id: "S-CRIT2", verdict, misfits, inconclusive, conditional: alternatives.length > 0,
    owner_review_required: true, alternative_verdicts: alternatives,
    signals: signals.map((row) => ({ case_id: row.case_id, verdict: row.verdict })),
    rubric_reasons: ["Criterion 2 requires no missing signal to misrepresent; best accepted candidate per required component",
      "G10 permits catalog additions only for a real misfit; no readiness or fraud detection conclusion"],
    basis: ["#795 decision log G10", "#804 comment 6137646538 rubric"] };
}

export function computeVerdicts({ records, rows, readings = {} }) {
  const context = { records, rows, readings };
  const signals = SIGNAL_RULES.map((rule) => signal(rule, context));
  return [...signals, criterion(signals)];
}
