import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { extractTypeScriptDocBlocks } from "./evaluation-kit-doc-blocks.mjs";
import { assert, byCodePoint, packageRoot, runChecked } from "./verification-helpers.mjs";

export const ANSWER_KEY_PATH = resolve(packageRoot, "facilitator/seeded-invalid-calls-answer-key.md");
const SEEDED_EXAMPLE_PATH = resolve(packageRoot, "examples/seeded-invalid-calls.ts");
const SEEDED_DOCUMENT_PATH = resolve(packageRoot, "docs/seeded-invalid-calls.md");

export const EXPECTED_SEEDED_CALLS = Object.freeze([
  {
    callNumber: 1,
    code: "MISSING_REQUIRED_ACTOR",
    path: "/actor",
    category: "validation",
  },
  {
    callNumber: 2,
    code: "MISSING_TENANT_CONTEXT",
    path: "/tenant",
    category: "validation",
  },
  {
    callNumber: 3,
    code: "PREMATURE_SUCCESS",
    path: "/operation/state",
    category: "validation",
  },
  {
    callNumber: 4,
    code: "AUTHORITY_ESCALATION",
    path: "/actor",
    category: "authority",
  },
  {
    callNumber: 5,
    code: "PROHIBITED_DATA",
    path: "/request/password",
    category: "privacy",
  },
]);

// Set by measurement. On the clean verification kit the highest fix-code score is 7, in
// docs/seeded-invalid-calls.md, and the highest mapping score is 2, in the core package's
// dist/validation/semantic.js. Fixes 2, 4 and 5 have the fewest distinctive lines, 10 each, and the
// answer key itself maps all five pairs.
export const FIX_CODE_RUN_THRESHOLD = 9;
export const MAPPING_LINE_WINDOW = 4;
export const MAPPING_PAIR_THRESHOLD = 3;
const DISTINCTIVE_FIX_LINE_MIN_LENGTH = 12;

export const ANSWER_KEY_MARKERS = Object.freeze([
  "Facilitator Answer Key",
  "This document is for evaluation facilitators only",
]);

const FORBIDDEN_SEEDED_SECTIONS = [
  "Fix & Explanation",
  "### Diagnostic Output",
  "### Expected Error",
  "### Verified Fix",
];

const ANSWER_KEY_MAPPING_PATTERN = /### Expected Error\r?\n- \*\*Error Code:\*\* `([^`]+)`\r?\n- \*\*Error Path:\*\* `([^`]+)`/g;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/**
 * Extracts TypeScript fix code blocks from the facilitator answer key and writes them into outputDir.
 */
export async function extractAnswerKeyFixBlocks(outputDir, answerKeyPath = ANSWER_KEY_PATH) {
  const text = await readFile(answerKeyPath, "utf8");
  const blocks = extractTypeScriptDocBlocks(text);
  assert(
    blocks.length === EXPECTED_SEEDED_CALLS.length,
    `answer key must contain exactly ${EXPECTED_SEEDED_CALLS.length} verified fix blocks, found ${blocks.length}`,
  );
  await mkdir(outputDir, { recursive: true });
  const writtenFiles = [];
  for (let i = 0; i < blocks.length; i++) {
    const outPath = resolve(outputDir, `answer-key-fix-${i + 1}.ts`);
    await writeFile(outPath, blocks[i] + "\n", "utf8");
    writtenFiles.push(outPath);
  }
  return writtenFiles;
}

function collapsedLine(line) {
  return line.trim().replaceAll(/\s+/g, " ");
}

function substantialLines(text) {
  return text
    .split(/\r?\n/)
    .map(collapsedLine)
    .filter((line) => line.length >= DISTINCTIVE_FIX_LINE_MIN_LENGTH);
}

function answerKeyMappings(text) {
  const mappings = [...text.matchAll(ANSWER_KEY_MAPPING_PATTERN)].map((match, index) => ({
    callNumber: index + 1,
    code: match[1],
    path: match[2],
  }));
  assert(
    mappings.length === EXPECTED_SEEDED_CALLS.length,
    `answer key must contain exactly ${EXPECTED_SEEDED_CALLS.length} expected code-to-path mappings, found ${mappings.length}`,
  );
  return mappings;
}

function expectedMappings() {
  return EXPECTED_SEEDED_CALLS.map(({ callNumber, code, path }) => ({ callNumber, code, path }));
}

function assertExpectedMappings(mappings) {
  assert(
    JSON.stringify(mappings) === JSON.stringify(expectedMappings()),
    "answer key expected code-to-path mappings must match the seeded invalid-call exercise",
  );
}

function seededExerciseBlocks(text) {
  const blocks = extractTypeScriptDocBlocks(text).slice(-EXPECTED_SEEDED_CALLS.length);
  assert(
    blocks.length === EXPECTED_SEEDED_CALLS.length,
    `seeded invalid-call document must contain ${EXPECTED_SEEDED_CALLS.length} exercise blocks`,
  );
  return blocks;
}

function fixFingerprints(blocks, sharedExampleLines, publicExerciseBlocks) {
  return blocks.map((block, index) => {
    const lines = substantialLines(block).filter((line) => !sharedExampleLines.has(line));
    const publicLines = new Set(substantialLines(publicExerciseBlocks[index]));
    assert(
      lines.length >= FIX_CODE_RUN_THRESHOLD,
      `answer key fix ${index + 1} must have at least ${FIX_CODE_RUN_THRESHOLD} distinctive lines`,
    );
    return Object.freeze({
      fixNumber: index + 1,
      lines: Object.freeze(lines),
      anchorLines: new Set(lines.filter((line) => !publicLines.has(line))),
    });
  });
}

/**
 * Reads the live facilitator key to derive independent fix-code and code-to-path recognizers for a gate run.
 */
export async function createAnswerKeyContentRecognizers(answerKeyPath = ANSWER_KEY_PATH) {
  const [answerKeyText, seededExampleText, seededDocumentText] = await Promise.all([
    readFile(answerKeyPath, "utf8"),
    readFile(SEEDED_EXAMPLE_PATH, "utf8"),
    readFile(SEEDED_DOCUMENT_PATH, "utf8"),
  ]);
  const sharedExampleLines = new Set(substantialLines(seededExampleText));
  const blocks = extractTypeScriptDocBlocks(answerKeyText);
  assert(
    blocks.length === EXPECTED_SEEDED_CALLS.length,
    `answer key must contain exactly ${EXPECTED_SEEDED_CALLS.length} verified fix blocks, found ${blocks.length}`,
  );
  const mappings = answerKeyMappings(answerKeyText);
  assertExpectedMappings(mappings);
  return Object.freeze({
    fixCode: Object.freeze({
      fingerprints: Object.freeze(fixFingerprints(blocks, sharedExampleLines, seededExerciseBlocks(seededDocumentText))),
      threshold: FIX_CODE_RUN_THRESHOLD,
    }),
    mapping: Object.freeze({
      pairs: Object.freeze(mappings.map((mapping) => Object.freeze(mapping))),
      threshold: MAPPING_PAIR_THRESHOLD,
      window: MAPPING_LINE_WINDOW,
    }),
    sharedExampleLines,
  });
}

function distinctCandidateLines(text, sharedExampleLines) {
  return substantialLines(text).filter((line) => !sharedExampleLines.has(line));
}

function runUsesFixAnchor(fingerprint, start, size) {
  if (fingerprint.anchorLines.size === 0) return true;
  return fingerprint.lines.slice(start, start + size).some((line) => fingerprint.anchorLines.has(line));
}

function sharedRunLength(fingerprintLines, candidateLines, fingerprintIndex, candidateIndex) {
  const limit = Math.min(fingerprintLines.length - fingerprintIndex, candidateLines.length - candidateIndex);
  for (let size = 0; size < limit; size++) {
    if (fingerprintLines[fingerprintIndex + size] !== candidateLines[candidateIndex + size]) return size;
  }
  return limit;
}

function longestSharedLineRun(fingerprint, candidateLines) {
  let longest = 0;
  for (let fingerprintIndex = 0; fingerprintIndex < fingerprint.lines.length; fingerprintIndex++) {
    for (let candidateIndex = 0; candidateIndex < candidateLines.length; candidateIndex++) {
      const size = sharedRunLength(fingerprint.lines, candidateLines, fingerprintIndex, candidateIndex);
      if (size <= longest) continue;
      if (runUsesFixAnchor(fingerprint, fingerprintIndex, size)) longest = size;
    }
  }
  return longest;
}

function higherFixScore(best, candidate) {
  if (candidate.score > best.score) return candidate;
  return best;
}

/**
 * Returns the highest normalized contiguous distinctive-line score for a facilitator fix in text.
 */
export function scoreAnswerKeyFixCode(text, recognizers) {
  const candidateLines = distinctCandidateLines(text, recognizers.sharedExampleLines);
  return recognizers.fixCode.fingerprints.reduce(
    (best, fingerprint) =>
      higherFixScore(best, {
        fixNumber: fingerprint.fixNumber,
        score: longestSharedLineRun(fingerprint, candidateLines),
        threshold: recognizers.fixCode.threshold,
      }),
    { fixNumber: 0, score: 0, threshold: recognizers.fixCode.threshold },
  );
}

function pairIsNear(lines, index, pair, window) {
  const first = Math.max(0, index - window);
  const last = Math.min(lines.length, index + window + 1);
  return lines.slice(first, last).some((line) => line.includes(pair.path));
}

function pairOccursWithinWindow(lines, pair, window) {
  return lines.some((line, index) => line.includes(pair.code) && pairIsNear(lines, index, pair, window));
}

/**
 * Returns the count of expected code-to-path pairs whose two values occur within the configured line window.
 */
export function scoreAnswerKeyMapping(text, recognizers) {
  const lines = text.split(/\r?\n/).map(collapsedLine);
  const matchedPairs = recognizers.mapping.pairs.filter((pair) => pairOccursWithinWindow(lines, pair, recognizers.mapping.window));
  return {
    matchedPairs,
    score: matchedPairs.length,
    threshold: recognizers.mapping.threshold,
    window: recognizers.mapping.window,
  };
}

function assertNoAnswerKeyMarkers(text, location) {
  for (const marker of ANSWER_KEY_MARKERS) {
    assert(
      !text.includes(marker),
      `evaluation kit must never contain facilitator answer key content in ${location} (marker recognizer: ${marker})`,
    );
  }
}

function assertNoRecognizedAnswerKeyContent(text, location, recognizers) {
  const fixCode = scoreAnswerKeyFixCode(text, recognizers);
  const mapping = scoreAnswerKeyMapping(text, recognizers);
  assert(
    fixCode.score < fixCode.threshold,
    `evaluation kit must never contain facilitator answer key content in ${location} (fix-code recognizer: fix ${fixCode.fixNumber}, score ${fixCode.score}/${fixCode.threshold})`,
  );
  assert(
    mapping.score < mapping.threshold,
    `evaluation kit must never contain facilitator answer key content in ${location} (code-to-path mapping recognizer: score ${mapping.score}/${mapping.threshold} within ${mapping.window} lines)`,
  );
}

function assertCleanSeededDoc(seededDoc) {
  for (const section of FORBIDDEN_SEEDED_SECTIONS) {
    assert(!seededDoc.includes(section), "kit docs/seeded-invalid-calls.md must not contain diagnoses or fixes");
  }
  for (const expected of EXPECTED_SEEDED_CALLS) {
    assert(
      !seededDoc.includes(expected.code),
      `kit docs/seeded-invalid-calls.md must not contain expected code ${expected.code}`,
    );
  }
}

async function appendEntryFiles(files, dir, entry) {
  const fullPath = resolve(dir, entry.name);
  if (entry.isDirectory()) {
    files.push(...(await collectFiles(fullPath)));
    return;
  }
  if (entry.isFile()) files.push(fullPath);
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((left, right) => byCodePoint(left.name, right.name));
  const files = [];
  for (const entry of entries) {
    await appendEntryFiles(files, dir, entry);
  }
  return files;
}

function isAnswerKeyFilename(rel) {
  const lower = rel.toLowerCase();
  if (lower.includes("answer-key")) return true;
  if (lower.includes("facilitator")) return true;
  return false;
}

function decodeUtf8(bytes) {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

async function readValidUtf8Text(file) {
  return decodeUtf8(await readFile(file));
}

async function assertTextHasNoAnswerKey(text, location, recognizers) {
  if (text === null) return;
  assertNoAnswerKeyMarkers(text, location);
  assertNoRecognizedAnswerKeyContent(text, location, recognizers);
}

async function assertKitFileClean(kitDir, file, recognizers) {
  const rel = relative(kitDir, file);
  assert(!isAnswerKeyFilename(rel), `evaluation kit must never contain facilitator answer key file: ${rel} (file-name rule)`);
  const text = await readValidUtf8Text(file);
  await assertTextHasNoAnswerKey(text, rel, recognizers);
}

function artifactEntries(identity) {
  assert(Array.isArray(identity.artifacts), "identity.json must list packed artifacts");
  return identity.artifacts.map(({ filename }) => filename).sort(byCodePoint);
}

async function assertArtifactEntriesClean(kitDir, artifactName, recognizers) {
  const extractionDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-answer-key-artifact-"));
  try {
    const artifactPath = resolve(kitDir, artifactName);
    runChecked("tar", ["-xzf", artifactPath, "-C", extractionDir]);
    const entries = await collectFiles(extractionDir);
    for (const entry of entries) {
      const entryName = relative(extractionDir, entry);
      const location = `packed artifact ${artifactName} entry ${entryName}`;
      assert(!isAnswerKeyFilename(entryName), `evaluation kit must never contain facilitator answer key file: ${location} (file-name rule)`);
      const text = await readValidUtf8Text(entry);
      await assertTextHasNoAnswerKey(text, location, recognizers);
    }
  } finally {
    await rm(extractionDir, { recursive: true, force: true });
  }
}

async function assertPackedArtifactsExcludeAnswerKey(kitDir, recognizers) {
  const identity = JSON.parse(await readFile(resolve(kitDir, "identity.json"), "utf8"));
  for (const artifactName of artifactEntries(identity)) {
    await assertArtifactEntriesClean(kitDir, artifactName, recognizers);
  }
}

/**
 * Asserts that the kit directory and every valid UTF-8 packed-artifact entry contain no answer-key material.
 */
export async function assertKitExcludesAnswerKey(kitDir) {
  const recognizers = await createAnswerKeyContentRecognizers();
  const allFiles = await collectFiles(kitDir);
  for (const file of allFiles) {
    await assertKitFileClean(kitDir, file, recognizers);
  }
  await assertPackedArtifactsExcludeAnswerKey(kitDir, recognizers);

  const seededDocPath = resolve(kitDir, "docs/seeded-invalid-calls.md");
  if (allFiles.includes(seededDocPath)) {
    const seededDoc = await readFile(seededDocPath, "utf8");
    assertCleanSeededDoc(seededDoc);
  }
}

function catalogDocumentsCode(catalogContent, code) {
  if (catalogContent.includes(`### \`${code}\``)) return true;
  if (catalogContent.includes(`### ${code}`)) return true;
  return false;
}

function seededCallPattern(expected) {
  const escapedPath = expected.path.replaceAll("/", String.raw`\/`);
  return new RegExp(
    String.raw`call[ -]?${expected.callNumber}[: ].*?code[=:\s]+${expected.code}.*?category[=:\s]+${expected.category}.*?path[=:\s]+${escapedPath}`,
    "i",
  );
}

function verifySeededCallEntry(output, catalogContent, expected) {
  const pattern = seededCallPattern(expected);
  assert(
    pattern.test(output),
    `seeded invalid call ${expected.callNumber} output mismatch:\nexpected code=${expected.code} category=${expected.category} path=${expected.path}\ngot output:\n${output}`,
  );
  assert(
    catalogDocumentsCode(catalogContent, expected.code),
    `error catalog must document seeded error code: ${expected.code}`,
  );
}

/**
 * Verifies that the stdout from running examples/seeded-invalid-calls.ts matches expected codes, categories, and paths,
 * and that docs/error-catalog.md documents every code.
 */
export function verifySeededCallsOutput(output, catalogContent) {
  for (const expected of EXPECTED_SEEDED_CALLS) {
    verifySeededCallEntry(output, catalogContent, expected);
  }
}
