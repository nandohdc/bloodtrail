import { assertionIssues } from "../p-e/assertions.mjs";
import { validateAggregate } from "./aggregate-validation.mjs";
import { array, caseIdOf, fieldOf, ownsRecord } from "./evidence.mjs";

function ownEvidenceIssues(entry, context) {
  const records = context.records.filter((record) => ownsRecord(entry, record));
  const accounting = context.accounting.filter((row) => row?.case_id === entry.case_id);
  if (records.length + accounting.length === 0) return [];
  return ["aggregate must not emit records or accounting (including case_aborted); predicted public calls are zero"];
}

export function evaluateAggregate(entry, context) {
  const owners = [entry, ...array(fieldOf(entry, "dependencies")).map((case_id) => ({ case_id }))];
  const raw = context.records.filter((record) => owners.some((owner) => ownsRecord(owner, record)));
  const accounting = context.accounting.filter((row) => owners.some((owner) => caseIdOf(owner) === row?.case_id));
  const actual = context.verdicts.find((row) => row.case_id === caseIdOf(entry));
  const base = { case_id: caseIdOf(entry), raw, accounting, actual, notes: [] };
  try {
    validateAggregate(entry);
    const mismatches = [...ownEvidenceIssues(entry, context),
      ...assertionIssues({ assertions: entry.expected.assertions, actual, records: context.records })];
    if (actual.verdict !== entry.verdict) mismatches.push("derived verdict differs from frozen classification");
    if (context.duplicates.has(entry.case_id)) mismatches.push("duplicate planned case identity");
    return { ...base, matched: mismatches.length === 0, mismatches };
  } catch (error) { return { ...base, matched: false, mismatches: [`malformed planned aggregate: ${error.message}`] }; }
}
