import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { markdownDocumentNames, proseLinesOutsideFencedBlocks } from "./evaluation-kit-doc-blocks.mjs";
import { assert } from "./verification-helpers.mjs";

const INLINE_CODE_TOKEN = "DOCUMENT_CODE";
const HEADING = /^(#{1,6})\s+(\S.*)$/;
const LIST_ITEM = /^(?:[-*+]|\d+\.)\s(.*)$/;
const TABLE_SEPARATOR = /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=(?:[A-Z*()]|DOCUMENT_CODE\b))/;
const PLANNED_MARKER = /\b(?:planned|not implemented|future|does not authorize)\b/i;
const BOUNDED_DELIVERY_RETRY = /\bbounded(?: delivery)? retry\b/gi;
const DELIVERY_RETRY_NAME = "Delivery retry by the HTTP audit sink, in process or durable";

const PLANNED_FEATURES = Object.freeze([
  { name: "OCSF export", matches: hasOcsfExport },
  { name: "OpenTelemetry transport", matches: hasOpenTelemetryTransport },
  { name: "CloudEvents envelopes", matches: hasCloudEventsEnvelopes },
  { name: DELIVERY_RETRY_NAME, matches: hasDeliveryRetry },
  { name: "Queues", matches: hasQueue },
  { name: "Framework adapters", matches: hasFrameworkAdapter },
]);

export const REVIEWED_PAIRS = Object.freeze([
  { document: "node-readme.md", heading: "Delivery primitives outside the evaluated path" },
  { document: "node-readme.md", heading: "Single-attempt HTTP handoff" },
  { document: "node-readme.md", heading: "Bounded delivery retry" },
  { document: "node-readme.md", heading: "Bounded delivery backpressure" },
  { document: "node-readme.md", heading: "Deadline-bounded delivery shutdown" },
  { document: "core-readme.md", heading: "Purpose" },
  { document: "core-readme.md", heading: "Event, operation, privacy, and sink APIs" },
  { document: "core-readme.md", heading: "Examples and API reference" },
]);

function hasOcsfExport(text) {
  return /\bOCSF\b/i.test(text) && /\b(?:export|exports|exported|exporting|exporter|exporters)\b/i.test(text);
}

function hasOpenTelemetryTransport(text) {
  return /\b(?:OpenTelemetry|OTLP)\b/i.test(text) && /\b(?:transport|transports|transported|transporting)\b/i.test(text);
}

function hasCloudEventsEnvelopes(text) {
  const cloudEvents = /\bCloudEvents?\b/i.test(text);
  const envelope = /\b(?:envelope|envelopes|enveloped|wrap|wraps|wrapped|wrapping)\b/i.test(text);
  return cloudEvents && envelope;
}

function hasDeliveryRetry(text) {
  const withoutBoundedPrimitive = text.replace(BOUNDED_DELIVERY_RETRY, "");
  return /\b(?:retry|retries|retried|retrying)\b/i.test(withoutBoundedPrimitive);
}

function hasQueue(text) {
  return /\b(?:queue|queues|queued|queuing|queueing)\b/i.test(text);
}

function hasFrameworkAdapter(text) {
  return /\bframework\s+(?:adapter|adapters|middleware|plugin|plugins|integration|integrations)\b/i.test(text);
}

function normalizedMarkdown(text) {
  return text.replace(/`[^`\n]*`/g, INLINE_CODE_TOKEN).replace(/\]\([^\n)]*\)/g, "]").replaceAll("*", "").replaceAll("_", "");
}

function sentenceSource(text) {
  return text.replace(/`[^`\n]*`/g, INLINE_CODE_TOKEN).replace(/\]\([^\n)]*\)/g, "]");
}

function sentencesIn(text) {
  return sentenceSource(text)
    .split(SENTENCE_BOUNDARY)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function namedFeatures(text) {
  return PLANNED_FEATURES.filter(({ matches }) => matches(text)).map(({ name }) => name);
}

function tableCells(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => normalizedMarkdown(cell).trim());
}

function stripClosingHeadingHashes(text) {
  let stripped = text.trimEnd();
  while (stripped.endsWith("#")) stripped = stripped.slice(0, -1).trimEnd();
  return stripped;
}

function headingUnit(line) {
  const match = HEADING.exec(line.text);
  if (!match) return null;
  return { kind: "heading", line: line.line, level: match[1].length, text: stripClosingHeadingHashes(match[2]) };
}

function tableUnit(line) {
  return { kind: "table", line: line.line, text: line.text.trim() };
}

function listItemUnit(lines, start) {
  const match = LIST_ITEM.exec(lines[start].text);
  const parts = [match[1].trim()];
  let next = start + 1;
  while (next < lines.length && isListContinuation(lines[next])) {
    parts.push(lines[next].text.trim());
    next += 1;
  }
  return { unit: { kind: "list", line: lines[start].line, text: parts.join(" ") }, next };
}

function paragraphUnit(lines, start) {
  const parts = [];
  let next = start;
  while (next < lines.length && isParagraphLine(lines[next])) {
    parts.push(lines[next].text.trim());
    next += 1;
  }
  return { unit: { kind: "paragraph", line: lines[start].line, text: parts.join(" ") }, next };
}

function isListContinuation(line) {
  return line.text.trim() !== "" && !HEADING.test(line.text) && !line.text.startsWith("|") && !LIST_ITEM.test(line.text);
}

function isParagraphLine(line) {
  return line.text.trim() !== "" && !HEADING.test(line.text) && !line.text.startsWith("|") && !LIST_ITEM.test(line.text);
}

function isTableSeparator(line) {
  return Boolean(line) && TABLE_SEPARATOR.test(line.text);
}

function tableReadResult(lines, index) {
  const line = lines[index];
  const isHeaderOrSeparator = isTableSeparator(line) || isTableSeparator(lines[index + 1]);
  return { unit: isHeaderOrSeparator ? null : tableUnit(line), next: index + 1 };
}

function nextDocumentUnit(lines, index) {
  const line = lines[index];
  if (line.text.trim() === "") return { unit: null, next: index + 1 };
  const heading = headingUnit(line);
  if (heading) return { unit: heading, next: index + 1 };
  if (line.text.startsWith("|")) return tableReadResult(lines, index);
  if (LIST_ITEM.test(line.text)) return listItemUnit(lines, index);
  return paragraphUnit(lines, index);
}

export function readDocumentUnits(markdownText) {
  const lines = proseLinesOutsideFencedBlocks(markdownText);
  const units = [];
  let index = 0;
  while (index < lines.length) {
    const read = nextDocumentUnit(lines, index);
    if (read.unit) units.push(read.unit);
    index = read.next;
  }
  return units;
}

function updateHeadingStack(headings, unit) {
  while (headings.length > 0 && headings.at(-1).level >= unit.level) headings.pop();
  headings.push(unit);
}

function reviewedPairFor(document, headings) {
  const activeHeading = headings.findLast((heading) =>
    REVIEWED_PAIRS.some((pair) => pair.document === document && pair.heading === normalizedMarkdown(heading.text)),
  );
  if (!activeHeading) return undefined;
  return REVIEWED_PAIRS.find(
    (pair) => pair.document === document && pair.heading === normalizedMarkdown(activeHeading.text),
  );
}

function introducedPlannedList(unit) {
  if (unit?.kind !== "paragraph") return false;
  const sentences = sentencesIn(unit.text);
  const lastSentence = sentences.at(-1);
  return Boolean(lastSentence) && lastSentence.endsWith(":") && PLANNED_MARKER.test(normalizedMarkdown(lastSentence));
}

function sentenceIsAllowed(context) {
  if (PLANNED_MARKER.test(context.normalized)) return true;
  if (context.reviewedPair) return true;
  if (context.unit.kind === "table") return PLANNED_MARKER.test(normalizedMarkdown(context.unit.text));
  return context.unit.kind === "list" && context.listLeadIn;
}

function rowStatusStartsPlanned(cells) {
  return /^Planned\b/.test(cells[1] ?? "");
}

function rowFailure(document, unit, feature, rule) {
  return `docs/${document} line ${unit.line}: ${feature} violates ${rule}: ${unit.text}`;
}

function tableRowFacts(unit) {
  const cells = tableCells(unit.text);
  return { cells, features: namedFeatures(cells[0] ?? ""), statusIsPlanned: rowStatusStartsPlanned(cells) };
}

function tableRowFailures(document, unit, facts) {
  if (facts.features.length > 0 && !facts.statusIsPlanned) {
    return [rowFailure(document, unit, facts.features[0], "planned row status rule")];
  }
  if (facts.statusIsPlanned && facts.features.length !== 1) {
    return [`docs/${document} line ${unit.line}: planned row violates exact-one-feature rule: ${unit.text}`];
  }
  return [];
}

function recordPlannedRow(plannedRows, unit, facts) {
  if (facts.statusIsPlanned && facts.features.length === 1) plannedRows.get(facts.features[0]).push(unit);
}

function newPlannedRows() {
  return new Map(PLANNED_FEATURES.map(({ name }) => [name, []]));
}

function rowRuleFailures(document, units, plannedRows) {
  const failures = [];
  for (const unit of units.filter(({ kind }) => kind === "table")) {
    const facts = tableRowFacts(unit);
    failures.push(...tableRowFailures(document, unit, facts));
    if (document === "supported-and-planned.md") recordPlannedRow(plannedRows, unit, facts);
  }
  return failures;
}

function plannedRowInventoryFailures(plannedRows) {
  const failures = [];
  for (const [feature, rows] of plannedRows) {
    if (rows.length !== 1) {
      failures.push(`docs/supported-and-planned.md line 1: ${feature} violates planned row inventory rule: expected exactly one row, found ${rows.length}`);
    }
  }
  return failures;
}

function deliveryRetryTermFailures(plannedRows) {
  const rows = plannedRows.get(DELIVERY_RETRY_NAME) ?? [];
  if (rows.length !== 1) return [];
  const [row] = rows;
  const [firstCell] = tableCells(row.text);
  if (firstCell === DELIVERY_RETRY_NAME) return [];
  return [`docs/supported-and-planned.md line ${row.line}: ${DELIVERY_RETRY_NAME} violates glossary term rule: ${row.text}`];
}

function nextListLeadIn(unit, previousUnit, listLeadIn) {
  if (unit.kind !== "list") return false;
  if (previousUnit?.kind === "list") return listLeadIn;
  return introducedPlannedList(previousUnit);
}

function recordReviewedCoverage(reviewedPair, features, reviewedCoverage) {
  if (reviewedPair && features.length > 0) reviewedCoverage.add(reviewedPair);
}

function sentenceFailures(source, context) {
  const normalized = normalizedMarkdown(source);
  const features = namedFeatures(normalized);
  recordReviewedCoverage(context.reviewedPair, features, context.reviewedCoverage);
  if (sentenceIsAllowed({ unit: context.unit, normalized, reviewedPair: context.reviewedPair, listLeadIn: context.listLeadIn })) return [];
  const sentence = { line: context.unit.line, text: source };
  return features.map((feature) => rowFailure(context.document, sentence, feature, "sentence marker rule"));
}

function unitSentenceFailures(context) {
  return sentencesForUnit(context.unit).flatMap((source) => sentenceFailures(source, context));
}

function updateSentenceContext(unit, context) {
  if (unit.kind === "heading") updateHeadingStack(context.headings, unit);
  context.unit = unit;
  context.listLeadIn = nextListLeadIn(unit, context.previousUnit, context.listLeadIn);
  context.reviewedPair = reviewedPairFor(context.document, context.headings);
}

function documentSentenceFailures(document, units, reviewedCoverage) {
  const context = { document, headings: [], previousUnit: null, listLeadIn: false, reviewedPair: undefined, reviewedCoverage, unit: null };
  const failures = [];
  for (const unit of units) {
    updateSentenceContext(unit, context);
    failures.push(...unitSentenceFailures(context));
    context.previousUnit = unit;
  }
  return failures;
}

function sentencesForUnit(unit) {
  if (unit.kind === "heading" || unit.kind === "table") return [unit.text];
  return sentencesIn(unit.text);
}

function stalePairFailures(reviewedCoverage) {
  return REVIEWED_PAIRS.filter((pair) => !reviewedCoverage.has(pair)).map(
    (pair) => `docs/${pair.document} line 1: reviewed section "${pair.heading}" violates stale reviewed-pair rule`,
  );
}

async function documentFailures(docsDir, document, reviewedCoverage, plannedRows) {
  const text = await readFile(resolve(docsDir, document), "utf8");
  const units = readDocumentUnits(text);
  return rowRuleFailures(document, units, plannedRows).concat(documentSentenceFailures(document, units, reviewedCoverage));
}

/**
 * The kit's table rows and prose name planned features only with their planned status or a planned marker.
 */
export async function assertKitDocsClaimOnlyWhatShips(kitDir) {
  const docsDir = resolve(kitDir, "docs");
  const documents = await markdownDocumentNames(docsDir);
  const reviewedCoverage = new Set();
  const plannedRows = newPlannedRows();
  const failures = [];
  for (const document of documents) {
    failures.push(...(await documentFailures(docsDir, document, reviewedCoverage, plannedRows)));
  }
  failures.push(
    ...plannedRowInventoryFailures(plannedRows),
    ...deliveryRetryTermFailures(plannedRows),
    ...stalePairFailures(reviewedCoverage),
  );
  assert(failures.length === 0, `kit documents violate planned-feature documentation:\n  ${failures.join("\n  ")}`);
}
