// Build-only provenance checks. Read the frozen plan as data; no probe,
// kit/SDK package, network or pipeline execution is involved.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateExpectations } from "../p-e/expectations-validate.mjs";

const EXPECTATIONS = JSON.parse(readFileSync(new URL("../expectations/p-e.v1.json", import.meta.url), "utf8"));
const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const RUN = "run-7ba34714-6905-4883-a37c-dd1d25f9e7cd";
const G8_RUN = "run-231ec5fd-ae55-4a37-b420-bb0ed167693f";
const ORIGINAL_LANES = [
  { stories: "US-001 to US-004 (implementation)", lane: "openai-codex/gpt-6.1-sol, thinking high" },
  { stories: "US-004 verification, US-005, US-006, and US-007 up to its interruption",
    lane: "deepseek/deepseek-v4-pro, thinking max" },
  { stories: "US-007 from its resumption at 17:16Z through US-010, and US-011 up to its interruption",
    lane: "openai-codex/gpt-6.1-sol, thinking high" },
  { stories: "US-011 from its resumption at 19:48Z, and every later story",
    lane: "deepseek/deepseek-v4-pro, thinking max" },
];
// Owner's 01:13Z switch recorded in the run progress log: two review rows,
// not the superseded single-lane description from the initial story brief.
const REVIEW_LANES = [
  { stories: `review fixes G3, G5, G6 and the probe side of G1 (Tamandua ${RUN})`,
    lane: "deepseek/deepseek-v4-pro, thinking max" },
  { stories: `review fixes: the evaluator side of G1, G2, G4, G7 and the fixup verification (Tamandua ${RUN})`,
    lane: "openai-codex/gpt-6.1-sol, thinking high" },
  { stories: `review fix G8: the P-E-6 parking flag left unfrozen (Tamandua ${G8_RUN})`,
    lane: "openai-codex/gpt-6.1-sol, thinking high" },
];
const ORIGINAL_NOTE = `G38 names no model, so every driver lane is recorded. The sole dry run used
\`openai-codex\`/\`gpt-6.1-sol\` with thinking high. This build ran US-001 through
US-004 on \`openai-codex\`/\`gpt-6.1-sol\` (thinking high); US-004 verification,
US-005, US-006 and US-007 up to its interruption on \`deepseek/deepseek-v4-pro\`
(thinking max); US-007 from its resumption through US-010, and US-011 up to its
interruption, on \`openai-codex\`/\`gpt-6.1-sol\`; and US-011 from its resumption
and every later story on \`deepseek/deepseek-v4-pro\`. No single lane is claimed
for the whole build.`;

function reviewRow(entry) {
  return `- ${entry.stories}: \`${entry.lane}\`.`;
}

test("P-E build provenance preserves six lanes and appends exactly one G8 lane", () => {
  assert.deepEqual(EXPECTATIONS.driver_provenance.build_lanes, [...ORIGINAL_LANES, ...REVIEW_LANES]);
});

test("P-E README preserves the original build note and appends each review lane once in order", () => {
  const rows = REVIEW_LANES.map(reviewRow);
  assert(README.includes(`${ORIGINAL_NOTE}\n\n${rows.join("\n")}\n\n### Frozen P-E plan`));
  for (const row of rows) assert.equal(README.split(row).length, 2);
});

test("P-E expectations with seven provenance rows still pass strict validation", () => {
  assert.equal(validateExpectations(EXPECTATIONS), EXPECTATIONS);
});
