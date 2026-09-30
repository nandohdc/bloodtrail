import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { extractTypeScriptDocBlocks } from "./evaluation-kit-doc-blocks.mjs";
import { assert, packageRoot } from "./verification-helpers.mjs";

export const ANSWER_KEY_PATH = resolve(packageRoot, "facilitator/seeded-invalid-calls-answer-key.md");

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

const SCANNABLE_EXTENSIONS = new Set([".md", ".ts", ".js", ".json"]);

const FORBIDDEN_ANSWER_KEY_MARKERS = [
  "Facilitator Answer Key",
  "This document is for evaluation facilitators only",
];

const FORBIDDEN_SEEDED_SECTIONS = [
  "Fix & Explanation",
  "### Diagnostic Output",
  "### Expected Error",
  "### Verified Fix",
];

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

async function appendEntryFiles(files, dir, entry) {
  const fullPath = resolve(dir, entry.name);
  if (entry.isDirectory()) {
    files.push(...(await collectFiles(fullPath)));
    return;
  }
  if (entry.isFile()) {
    files.push(fullPath);
  }
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
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

function isScannableFile(file) {
  return SCANNABLE_EXTENSIONS.has(extname(file).toLowerCase());
}

function assertNoAnswerKeyMarkers(text, rel) {
  for (const marker of FORBIDDEN_ANSWER_KEY_MARKERS) {
    assert(!text.includes(marker), `evaluation kit must never contain facilitator answer key content in ${rel}`);
  }
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

async function assertKitFileClean(kitDir, file) {
  const rel = relative(kitDir, file);
  assert(!isAnswerKeyFilename(rel), `evaluation kit must never contain facilitator answer key file: ${rel}`);
  if (!isScannableFile(file)) return;
  const text = await readFile(file, "utf8");
  assertNoAnswerKeyMarkers(text, rel);
}

/**
 * Asserts that the kit directory contains no answer key files and no answer key content.
 */
export async function assertKitExcludesAnswerKey(kitDir) {
  const allFiles = await collectFiles(kitDir);
  for (const file of allFiles) {
    await assertKitFileClean(kitDir, file);
  }

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
