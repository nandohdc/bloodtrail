import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isIP } from "node:net";
import { markdownDocumentNames, proseLinesOutsideFencedBlocks } from "./evaluation-kit-doc-blocks.mjs";
import { assert, byCodePoint } from "./verification-helpers.mjs";

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

const URL_HOST = /\b[a-z][a-z\d+.-]*:\/\/([^\s/?#"'`),]+)/gi;
const EMAIL_ADDRESS = /\b[a-z\d._%+-]+@([a-z\d.-]+\.[a-z]{2,})\b/gi;
const BARE_DOMAIN = /\b(?:[a-z\d-]+\.)+[a-z]{2,}\b/gi;
const BARE_DOMAIN_TLDS = new Set([
  "com",
  "net",
  "org",
  "io",
  "dev",
  "app",
  "co",
  "ai",
  "cloud",
  "info",
  "biz",
  "me",
  "us",
  "uk",
  "de",
  "fr",
  "br",
  "jp",
  "in",
  "gov",
  "edu",
]);
const IPV4_ADDRESS = /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g;
const ENVIRONMENT_OBJECT = /(?:["']environment["']|\benvironment)\s*:\s*\{/g;
const ENVIRONMENT_NAME = /(?:["']name["']|\bname)\s*:\s*["']([^"']+)["']/;
const NODE_ENV_ASSIGNMENT = /\bNODE_ENV\s*=\s*(?:"([^"]*)"|'([^']*)'|([a-z\d_-]+))/gi;
const SYNTHETIC_HOST_NAMES = new Set(["localhost", "example.com", "example.net", "example.org"]);
const SYNTHETIC_HOST_SUFFIXES = Object.freeze([
  ".test",
  ".example",
  ".invalid",
  ".localhost",
  ".example.com",
  ".example.net",
  ".example.org",
]);
const SYNTHETIC_IPV4_CIDRS = Object.freeze([
  "127.0.0.0/8",
  "192.0.2.0/24",
  "198.51.100.0/24",
  "203.0.113.0/24",
]);
const SYNTHETIC_IPV4_RANGES = Object.freeze(SYNTHETIC_IPV4_CIDRS.map(ipv4Range));
const SYNTHETIC_ENVIRONMENT_NAMES = new Set(["development", "test", "synthetic"]);

// A reviewed pair identifies the kit-relative file and one value that has been explicitly accepted despite
// not being synthetic. The initial empty list ensures every current kit value proves its own classification.
export const REVIEWED_SYNTHETIC_VALUE_PAIRS = Object.freeze([]);

function ipv4Range(cidr) {
  const [address, prefixText] = cidr.split("/");
  const first = ipv4Number(address);
  const size = 2 ** (32 - Number(prefixText));
  return { first, last: first + size - 1 };
}

function ipv4Number(address) {
  return address.split(".").reduce((number, part) => number * 256 + Number(part), 0);
}

function lineFor(text, index) {
  return text.slice(0, index).split("\n").length;
}

function valueAt(file, text, index, found) {
  return { file, line: lineFor(text, index), ...found };
}

function urlHost(authority) {
  const bracketed = /^\[([^\]]+)\]/.exec(authority);
  if (bracketed) return bracketed[1];
  return authority.replace(/:\d+$/, "");
}

function urlHostValues(file, text) {
  return [...text.matchAll(URL_HOST)].flatMap((match) => {
    const authority = match[1];
    if (authority.includes("${")) return [];
    const host = urlHost(authority);
    const hostIndex = match.index + match[0].lastIndexOf(host);
    const hostValue = valueAt(file, text, hostIndex, { kind: "host", value: host });
    if (isIP(host) !== 6) return [hostValue];
    return [hostValue, valueAt(file, text, hostIndex, { kind: "IP address", value: host })];
  });
}

function emailValues(file, text) {
  return [...text.matchAll(EMAIL_ADDRESS)].flatMap((match) => {
    const email = match[0];
    const domain = match[1];
    const domainIndex = match.index + email.lastIndexOf(domain);
    return [
      valueAt(file, text, domainIndex, { kind: "host", value: domain }),
      valueAt(file, text, match.index, { kind: "email address", value: email }),
    ];
  });
}

function matchedValues(file, text, definition) {
  return [...text.matchAll(definition.pattern)].flatMap((match) => {
    const value = definition.valueAtMatch(match);
    if (!value) return [];
    const index = match.index + match[0].lastIndexOf(value);
    return [valueAt(file, text, index, { kind: definition.kind, value })];
  });
}

function allowedBareDomain(value) {
  return value
    .toLowerCase()
    .split(".")
    .slice(1)
    .some((label) => BARE_DOMAIN_TLDS.has(label));
}

function closingBrace(text, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function environmentObjectValues(file, text) {
  const values = [];
  for (const match of text.matchAll(ENVIRONMENT_OBJECT)) {
    const openingIndex = match.index + match[0].lastIndexOf("{");
    if (openingIndex < 0) continue;
    const closingIndex = closingBrace(text, openingIndex);
    if (closingIndex < 0) continue;
    const objectText = text.slice(openingIndex, closingIndex + 1);
    const name = ENVIRONMENT_NAME.exec(objectText);
    if (!name) continue;
    const value = name[1];
    const valueIndex = openingIndex + name.index + name[0].lastIndexOf(value);
    values.push(valueAt(file, text, valueIndex, { kind: "environment name", value }));
  }
  return values;
}

function assignedEnvironmentValue(match) {
  if (match[1] !== undefined) return match[1];
  if (match[2] !== undefined) return match[2];
  return match[3];
}

function kitValues(file, text) {
  return urlHostValues(file, text).concat(
    emailValues(file, text),
    matchedValues(file, text, {
      pattern: BARE_DOMAIN,
      kind: "host",
      valueAtMatch: (match) => (allowedBareDomain(match[0]) ? match[0] : null),
    }),
    matchedValues(file, text, { pattern: IPV4_ADDRESS, kind: "IP address", valueAtMatch: (match) => match[0] }),
    environmentObjectValues(file, text),
    matchedValues(file, text, {
      pattern: NODE_ENV_ASSIGNMENT,
      kind: "environment name",
      valueAtMatch: assignedEnvironmentValue,
    }),
  );
}

function isSyntheticIpv4(value) {
  const number = ipv4Number(value);
  return SYNTHETIC_IPV4_RANGES.some(({ first, last }) => number >= first && number <= last);
}

function isSyntheticIpv6(value) {
  if (value === "::1") return true;
  const [first, second] = value.toLowerCase().split(":");
  return first === "2001" && Number.parseInt(second, 16) === 0x0db8;
}

function isSyntheticHost(value) {
  const normalized = value.toLowerCase();
  if (SYNTHETIC_HOST_NAMES.has(normalized)) return true;
  if (isIP(normalized) === 4) return isSyntheticIpv4(normalized);
  if (isIP(normalized) === 6) return isSyntheticIpv6(normalized);
  return SYNTHETIC_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isSyntheticValue(value) {
  if (value.kind === "host") return isSyntheticHost(value.value);
  if (value.kind === "IP address") return isSyntheticIpv4(value.value) || isSyntheticIpv6(value.value);
  if (value.kind === "email address") return isSyntheticHost(value.value.split("@")[1]);
  return SYNTHETIC_ENVIRONMENT_NAMES.has(value.value);
}

function isReviewedSyntheticValue(value) {
  return REVIEWED_SYNTHETIC_VALUE_PAIRS.some(
    ([reviewedFile, reviewedValue]) => reviewedFile === value.file && reviewedValue === value.value,
  );
}

async function exampleFileNames(examplesDir, prefix = "") {
  const entries = await readdir(resolve(examplesDir, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile()) files.push(entryPath);
    if (entry.isDirectory()) files.push(...(await exampleFileNames(examplesDir, entryPath)));
  }
  return files.sort(byCodePoint);
}

async function syntheticValueSources(kitDir) {
  const docsDir = resolve(kitDir, "docs");
  const examplesDir = resolve(kitDir, "examples");
  const documents = await markdownDocumentNames(docsDir);
  const examples = await exampleFileNames(examplesDir);
  const docSources = documents.map((name) => ({ file: `docs/${name}`, path: resolve(docsDir, name) }));
  const exampleSources = examples.map((name) => ({ file: `examples/${name}`, path: resolve(examplesDir, name) }));
  return docSources.concat(exampleSources);
}

function syntheticValueFailure(value) {
  return `${value.file} line ${value.line}: ${value.kind} "${value.value}" is not synthetic`;
}

/**
 * Every host, email address, IP address, and environment name in the kit's documents and examples is
 * synthetic, unless a reviewed file-and-value pair explicitly accepts it.
 */
export async function assertKitSyntheticValues(kitDir) {
  const failures = [];
  for (const source of await syntheticValueSources(kitDir)) {
    const text = await readFile(source.path, "utf8");
    for (const value of kitValues(source.file, text)) {
      if (!isSyntheticValue(value) && !isReviewedSyntheticValue(value)) failures.push(syntheticValueFailure(value));
    }
  }
  assert(failures.length === 0, `kit files contain non-synthetic values:\n  ${failures.join("\n  ")}`);
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
