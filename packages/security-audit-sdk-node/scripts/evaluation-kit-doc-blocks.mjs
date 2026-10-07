import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { assert, byCodePoint } from "./verification-helpers.mjs";

// Fence lines may be indented by any leading spaces or tabs, as in a nested list item. The lookaheads keep
// the marker run whole, so the info string never re-reads it.
const FENCE_OPENING = /^([ \t]*)(`{3,}(?!`)|~{3,}(?!~))(.*)$/;
const FENCE_CLOSING = /^([ \t]*)(`+|~+)[ \t]*\r?$/;

function fenceHeader(line) {
  const match = FENCE_OPENING.exec(line);
  if (!match) return null;
  const infoString = match[3].trim();
  const language = infoString.split(/\s+/, 1)[0] ?? "";
  return { marker: match[2], language, infoString };
}

function closesFence(line, marker) {
  const match = FENCE_CLOSING.exec(line);
  if (!match) return false;
  if (!match[2].startsWith(marker[0])) return false;
  return match[2].length >= marker.length;
}

function readFencedBlocks(markdownText) {
  const fences = [];
  let openFence = null;
  const lines = markdownText.split("\n");
  for (const [index, line] of lines.entries()) {
    if (openFence) {
      if (closesFence(line, openFence.marker)) {
        fences.push({ ...openFence, endLine: index + 1, body: openFence.body.join("\n") });
        openFence = null;
      } else {
        openFence.body.push(line);
      }
      continue;
    }
    const header = fenceHeader(line);
    if (header) openFence = { ...header, openingLine: index + 1, body: [] };
  }
  if (openFence) fences.push({ ...openFence, endLine: lines.length, body: openFence.body.join("\n") });
  return fences;
}

/**
 * Returns every fenced block in a document, with its language, complete info string, opening line, and body.
 */
export function extractFencedBlocks(markdownText) {
  return readFencedBlocks(markdownText).map(({ language, infoString, openingLine, body }) => ({
    language,
    infoString,
    openingLine,
    body,
  }));
}

// Every TypeScript fence, matched in any letter case with whatever follows the language, with its opening
// line and body, so checks can name where a block sits in its document.
export function extractTypeScriptFencedBlocks(markdownText) {
  return extractFencedBlocks(markdownText).filter(({ language }) =>
    ["ts", "typescript"].includes(language.toLowerCase()),
  );
}

export function extractTypeScriptDocBlocks(markdownText) {
  return extractTypeScriptFencedBlocks(markdownText)
    .map(({ body }) => body.trim())
    .filter(Boolean);
}

// The TypeScript scanner skips comments and reads a string's contents as one token, so only a declare
// keyword token marks a block as declaration-only; `declare` inside a comment or string does not count.
export function containsDeclareKeyword(blockText) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
  scanner.setText(blockText);
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    if (scanner.getToken() === ts.SyntaxKind.DeclareKeyword) return true;
  }
  return false;
}

const DECLARATION_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.BindingElement,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.MethodSignature,
]);

function declaredName(node) {
  const declares =
    DECLARATION_KINDS.has(node.kind) || (ts.isPropertyAssignment(node) && ts.isFunctionLike(node.initializer));
  return declares && node.name && ts.isIdentifier(node.name) ? node.name.text : null;
}

// The names a document's checked code blocks declare: functions, variables, classes, interfaces and types,
// and the methods they declare. A local helper a document names in prose is declared here, where the gate
// type-checks it.
export function declaredDocBlockNames(markdownText) {
  const names = new Set();
  const visit = (node) => {
    const name = declaredName(node);
    if (name) names.add(name);
    ts.forEachChild(node, visit);
  };
  for (const block of extractTypeScriptDocBlocks(markdownText)) {
    visit(ts.createSourceFile("doc-block.ts", block, ts.ScriptTarget.Latest));
  }
  return names;
}

// A document without its fenced code blocks, which the gate type-checks instead.
export function proseOutsideFencedBlocks(markdownText) {
  const fencedLines = new Set();
  for (const { openingLine, endLine } of readFencedBlocks(markdownText)) {
    for (let line = openingLine; line <= endLine; line++) fencedLines.add(line);
  }
  return markdownText
    .split("\n")
    .filter((_, index) => !fencedLines.has(index + 1))
    .join("\n");
}

export async function extractDocBlocksFromDir(docsDir, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const entries = await readdir(docsDir, { withFileTypes: true });
  const writtenFiles = [];

  for (const entry of entries) {
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      const filePath = resolve(docsDir, entry.name);
      const text = await readFile(filePath, "utf8");
      const blocks = extractTypeScriptDocBlocks(text);
      const docName = basename(entry.name, ".md");

      for (let i = 0; i < blocks.length; i++) {
        const outName = `${docName}-block-${i + 1}.ts`;
        const outPath = resolve(outputDir, outName);
        await writeFile(outPath, blocks[i] + "\n", "utf8");
        writtenFiles.push(outPath);
      }
    }
  }

  return writtenFiles;
}

export const ALLOWED_FENCE_LANGUAGES = Object.freeze(["bash", "http", "json", "sh", "ts", "typescript"]);

// How a failure shows a fence that names no language, so an anonymous fence is distinguishable from prose.
const EMPTY_LANGUAGE_DISPLAY = "(none)";

function unallowlistedFence(documentName, fence) {
  const language = fence.language.toLowerCase();
  if (ALLOWED_FENCE_LANGUAGES.includes(language)) return null;
  const shown = fence.language === "" ? EMPTY_LANGUAGE_DISPLAY : fence.language;
  return `docs/${documentName} line ${fence.openingLine}: fence language ${shown} is not allowlisted`;
}

// Markdown document names in code-point order, so every check that reports failures lists them the same
// way on every filesystem.
export async function markdownDocumentNames(docsDir) {
  const entries = await readdir(docsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".md")
    .map((entry) => entry.name)
    .sort(byCodePoint);
}

/**
 * Every fence in the kit's documents names an allowlisted language, matched in any letter case and with
 * any info string after it. A failure names the document and the fence's opening line.
 */
export async function assertKitDocFenceLanguages(kitDir) {
  const docsDir = resolve(kitDir, "docs");
  const documents = await markdownDocumentNames(docsDir);
  const failures = [];
  for (const name of documents) {
    failures.push(...(await documentFenceFailures(docsDir, name)));
  }
  assert(failures.length === 0, `kit document fences name unallowlisted languages:\n  ${failures.join("\n  ")}`);
}

async function documentFenceFailures(docsDir, name) {
  const text = await readFile(resolve(docsDir, name), "utf8");
  const failures = [];
  for (const fence of extractFencedBlocks(text)) {
    const failure = unallowlistedFence(name, fence);
    if (failure) failures.push(failure);
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const docsDir = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), "docs");
  const outputDir = process.argv[3] ? resolve(process.argv[3]) : resolve(process.cwd(), "doc-blocks");
  const files = await extractDocBlocksFromDir(docsDir, outputDir);
  process.stdout.write(`extracted ${files.length} TypeScript doc blocks to ${outputDir}\n`);
}
