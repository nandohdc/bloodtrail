import { BASELINES } from "./baselines.mjs";
import { A_CASES } from "./group-a.mjs";
import { B_CASES } from "./group-b.mjs";
import { C_COMMIT_CASES } from "./group-c-commit.mjs";
import { C_HANDLE_CASES } from "./group-c-handles.mjs";
import { D_CASES } from "./group-d.mjs";
import { E_CASES } from "./group-e.mjs";
import { F_CASES } from "./group-f.mjs";

const OWN_INSTANCE = new Set(["PD-C12", "PD-C13", "PD-E3"]);
const GROUPS = [A_CASES, B_CASES, C_COMMIT_CASES, C_HANDLE_CASES, D_CASES, E_CASES, F_CASES];
const entries = GROUPS.flat().map(([case_id, calls, run]) => ({ case_id, calls, run, fresh: !OWN_INSTANCE.has(case_id) }));
const byId = new Map([...BASELINES, ...entries].map((entry) => [entry.case_id, entry]));
const range = (group, size) => Array.from({ length: size }, (_, index) => `PD-${group}${index + 1}`);
// Preserve the two comments' transcription order, including appended review cases.
export const CASE_ORDER = ["PD-00", "PD-01", ...range("A", 11), ...range("B", 6), ...range("C", 11), ...range("D", 12), ...range("E", 2), ...range("F", 10), "PD-A12", "PD-A13", "PD-B7", "PD-B8", "PD-B9", "PD-C12", "PD-C13", "PD-C14", "PD-D13", "PD-E3", "PD-E4", "PD-F11"];
export const CASES = CASE_ORDER.map((id) => byId.get(id));
export const PLANNED_TOTAL = CASES.reduce((sum, entry) => sum + entry.calls, 0);
