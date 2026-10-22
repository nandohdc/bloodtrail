import assert from "node:assert/strict";

const PREFIX = "| 5 | P-map | #804 | ";

export function assertRunEvidenceState({ baseLedger, ledger, hasResult }) {
  const rows = ledger.split("\n").filter((line) => line.startsWith(PREFIX));
  assert.equal(rows.length, Number(hasResult), "run-5 row must exist exactly with its result");
  const inherited = ledger.split("\n").filter((line) => !line.startsWith(PREFIX)).join("\n");
  assert.equal(inherited, baseLedger, "inherited ledger bytes differ");
}

export function assertRunTaskState({ tasks, hasResult }) {
  assert.match(tasks, hasResult ? /^- \[x\] 5\.2 /m : /^- \[ \] 5\.2 /m);
}
