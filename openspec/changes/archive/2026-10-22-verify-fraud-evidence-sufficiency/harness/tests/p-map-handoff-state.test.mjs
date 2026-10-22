import assert from "node:assert/strict";
import test from "node:test";
import { assertRunEvidenceState } from "./p-map-handoff-state.mjs";

const BASE = "# Ledger\n| 4 | P-E | #803 | inherited |\n";
const ROW = "| 5 | P-map | #804 | approved evidence |\n";
const INVALID = [
  { name: "row without result", ledger: BASE + ROW, hasResult: false },
  { name: "result without row", ledger: BASE, hasResult: true },
  { name: "edited inherited row", ledger: BASE.replace("inherited", "edited") + ROW, hasResult: true },
  { name: "second run-5 row", ledger: BASE + ROW + ROW, hasResult: true },
  { name: "another added row", ledger: BASE + ROW + "| 6 | other |\n", hasResult: true },
];

for (const hasResult of [false, true]) test(`portable run-5 ledger state (${hasResult})`, () => {
  assert.doesNotThrow(() => assertRunEvidenceState({ baseLedger: BASE, ledger: BASE + (hasResult ? ROW : ""), hasResult }));
});

for (const fixture of INVALID) test(`handoff rejects ${fixture.name}`, () => {
  assert.throws(() => assertRunEvidenceState({ baseLedger: BASE, ...fixture }), assert.AssertionError);
});
