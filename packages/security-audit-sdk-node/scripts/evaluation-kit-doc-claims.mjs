import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { proseOutsideFencedBlocks } from "./evaluation-kit-doc-blocks.mjs";
import { assert } from "./verification-helpers.mjs";

// What the alpha plans and does not implement. A kit document may name these only as planned.
const PLANNED_FEATURES = Object.freeze([
  ["OCSF export", /\bOCSF\b/i],
  ["OpenTelemetry transport", /\bOpenTelemetry\b|\bOTLP\b/i],
  ["CloudEvents envelopes", /\bCloudEvents?\b/i],
  ["retries", /\bretr(?:y|ies|ying)\b/i],
  ["queues", /\bqueu(?:e|es|ing)\b/i],
  ["framework adapters", /\bframework (?:adapters?|middleware|plugins?|integrations?)\b/i],
]);

// A table cell that marks its row as available in the alpha.
const SUPPORTED_STATUS = /^(?:supported|implemented|available|included|yes)\b/i;
// A sentence that says a feature works, and the words that negate or defer that.
const SUPPORT_CLAIMS = Object.freeze([
  /\b(?:is|are) (?:now )?(?:supported|implemented|available|included)\b/i,
  /\b(?:supports|implements)\b/i,
  /:[\s*_]{0,4}(?:supported|implemented|available)\b/i,
]);
const NOT_IN_THE_ALPHA = /\b(?:not|no|never|without|planned|unsupported|outside)\b/i;
const SENTENCE_END = /(?<=[.!?])\s+/;

function plannedFeatureIn(text) {
  return PLANNED_FEATURES.find(([, pattern]) => pattern.test(text))?.[0];
}

function tableCells(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.replaceAll(/[*_`]/g, "").trim());
}

// A table row whose first cell names a planned feature must not mark it supported.
function tableRowClaim(row) {
  const [feature, ...rest] = tableCells(row);
  const planned = plannedFeatureIn(feature);
  return planned && rest.some((cell) => SUPPORTED_STATUS.test(cell)) ? planned : undefined;
}

// A sentence that names a planned feature must not say it works, unless it says the feature is not there.
function sentenceClaim(sentence) {
  const planned = plannedFeatureIn(sentence);
  const claimed = SUPPORT_CLAIMS.some((claim) => claim.test(sentence));
  return planned && claimed && !NOT_IN_THE_ALPHA.test(sentence) ? planned : undefined;
}

function lineClaims(line) {
  if (line.trim().startsWith("|")) {
    const planned = tableRowClaim(line);
    return planned ? [[planned, line.trim()]] : [];
  }
  return line
    .split(SENTENCE_END)
    .map((sentence) => [sentenceClaim(sentence), sentence.trim()])
    .filter(([planned]) => planned);
}

async function documentClaims(docsDir, name) {
  const prose = proseOutsideFencedBlocks(await readFile(resolve(docsDir, name), "utf8"));
  return prose
    .split("\n")
    .flatMap(lineClaims)
    .map(([planned, text]) => `docs/${name} describes ${planned} as available: ${text}`);
}

/**
 * The kit's documents describe OCSF export, OpenTelemetry transport, CloudEvents envelopes, retries, queues
 * and framework adapters only as planned, never as supported or implemented.
 */
export async function assertKitDocsClaimOnlyWhatShips(kitDir) {
  const docsDir = resolve(kitDir, "docs");
  const documents = (await readdir(docsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name) === ".md")
    .map((entry) => entry.name);
  const failures = [];
  for (const name of documents) {
    failures.push(...(await documentClaims(docsDir, name)));
  }
  assert(failures.length === 0, `kit documents describe planned features as available:\n  ${failures.join("\n  ")}`);
}
