import { AF_CASES } from "./af-cases.mjs";
import { AS_CASES } from "./as-cases.mjs";
import { PR_CASES, RA_CASES } from "./request-cases.mjs";

// #802 comments 6137582157/6137593009; build hypotheses, never run evidence.
// Implementer default: share L1 failure captures with L2, not duplicate emissions.
export const LINKAGE_BASIS = [
  "packages/security-audit-sdk-core/src/events.ts:98-131,287-352,510-525",
  "packages/security-audit-sdk-core/src/validation/semantic.ts:371-434",
  "packages/security-audit-sdk-core/src/context.ts:139-196,244-254",
  "contracts/security-audit/catalog/catalog.json:177-227,457-511,1-60",
  "openspec/specs/security-audit-event-contract/spec.md:90-117",
];
export const TARGETS = ["ex", "nx"].flatMap((target) => ["0001", "0002", "0003"].map((suffix) =>
  Object.freeze({ target, suffix, pid: `pid-${target}-${suffix}`, account: target === "ex" ? `acct-${suffix}` : undefined })));
export const REPETITIONS = 5;
const AF_ROSTER = [
  ["B"], ["C0t"], ["C1"], ["C2"], ["C2", "absent"], ["C3"], ["C3s"], ["C4"], ["C5"],
  ["CR"], ["CR", "credential-type"], ["C6"], ["C6s"], ["C7"], ["C7b", "equal-claim"],
  ["X1"], ["X2"], ["X3"], ["X4"], ["F1", "id"], ["F1", "route"], ["F2"], ["F3"], ["C0r"], ["F4"],
];
const AS_ROSTER = [["B"], ["C3"], ["C4"], ["CR"], ["C6"], ["X2"], ["C2"], ["C2", "honest-control"], ["C2", "keyed-mirror"]];
function select({ cases, family, id, mode = "main" }) {
  const entry = cases.find((item) => item.case_id === `${family}-${id}`);
  const variants = entry.variants.filter((variant) => variant.mode === mode);
  if (variants.length === 0) throw new Error(`missing linkage source variant ${family}-${id}/${mode}`);
  return { dataset_id: `${entry.case_id}/${mode}`, family, entry, variants, mode };
}
export const FAILURE_DATASETS = AF_ROSTER.map(([id, mode]) => select({ cases: AF_CASES, family: "AF", id, mode }));
export const SUCCESS_DATASETS = AS_ROSTER.map(([id, mode]) => select({ cases: AS_CASES, family: "AS", id, mode }));
export const REQUEST_DATASETS = [["PR", PR_CASES], ["RA", RA_CASES]].flatMap(([family, cases]) =>
  ["subject", "resource"].map((mode) => select({ cases, family, id: "C5", mode })));

function pair(from_family, from, to) { return Object.freeze({ from_family, from, to_family: "AS", to }); }
export const DECLARED_PAIRS = Object.freeze([
  pair("AF", "subject.id", "authenticated_principal.id"), pair("AF", "actor.id", "authenticated_principal.id"),
  pair("AF", "resource.id", "resource.id"), pair("AF", "credential.reference", "credential.reference"),
  pair("AF", "actor.display_name", "actor.display_name"),
  pair("AF", "subject.id", "subject.id"), pair("AF", "actor.id", "actor.id"),
  ...["PR", "RA"].flatMap((family) => [pair(family, "subject.id", "authenticated_principal.id"), pair(family, "resource.id", "authenticated_principal.id")]),
]);
// Q5: the accepted hook-keyed mirror (AS-X2-shaped input keyed under
// authentication_succeeded) is declared before the run; the refused
// AS-C2/main row remains a separate control whose 0 linkage comes from the
// refusal, not from the hook's purpose scope.
export const MIRRORS = [
  ["AF-C3/main", "AS-C3/main"], ["AF-C4/main", "AS-C4/main"], ["AF-CR/main", "AS-CR/main"],
  ["AF-C6/main", "AS-C6/main"], ["AF-C1/main", "AS-X2/main"], ["AF-X1/main", "AS-X2/main"],
  ["AF-X2/main", "AS-X2/main"], ["AF-C2/main", "AS-C2/keyed-mirror"], ["AF-C2/main", "AS-C2/main"],
].map(([from, to]) => ({ from, to }));

// Count every construction/emission/callback. Baseline public frames are prepared
// once (AF=4, three AS identities=21, PR/RA=6) and reused without cloning brands.
function datasetPrediction({ dataset, repeats, baseline }) {
  const targets = dataset.family === "AS" ? TARGETS.filter((target) => target.target === "ex") : TARGETS;
  const constructors = targets.reduce((sum, target) => {
    const variant = dataset.variants.find((item) => item.target === target.target);
    const hooks = dataset.entry.hook_mode !== "none" && dataset.mode !== "absent" ? 1 : 0;
    return sum + variant.predicted_calls - baseline - hooks;
  }, 0);
  const emissions = targets.length * repeats;
  const callbacks = dataset.entry.hook_mode !== "none" && dataset.mode !== "absent" ? emissions : 0;
  return { dataset_id: dataset.dataset_id, constructors, emissions, callbacks, instance_calls: 2,
    predicted_calls: constructors + emissions + callbacks + 2 };
}
export const LINKAGE_PREDICTIONS = [
  ...FAILURE_DATASETS.map((dataset) => datasetPrediction({ dataset, repeats: REPETITIONS, baseline: 7 })),
  ...SUCCESS_DATASETS.map((dataset) => datasetPrediction({ dataset, repeats: 1, baseline: 10 })),
  ...REQUEST_DATASETS.map((dataset) => datasetPrediction({ dataset, repeats: 1, baseline: 6 })),
];
const matrixCalls = [...AF_CASES, ...AS_CASES, ...PR_CASES, ...RA_CASES].reduce((sum, entry) => sum + entry.predicted_calls, 0);
const linkageCalls = 31 + LINKAGE_PREDICTIONS.reduce((sum, entry) => sum + entry.predicted_calls, 0);
export const P_ATTR_BUDGET = Object.freeze({ matrix_predicted: matrixCalls, linkage_setup: 31,
  linkage_predicted: linkageCalls, predicted_total: matrixCalls + linkageCalls,
  processes: { matrix: 2 * (matrixCalls + linkageCalls) }, total: 2 * (matrixCalls + linkageCalls), limit: 5000 });
