import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const TS_CODE_BLOCK_PATTERN = /```(?:typescript|ts)\r?\n([\s\S]*?)```/g;

export function extractTypeScriptDocBlocks(markdownText) {
  const blocks = [];
  let match;
  TS_CODE_BLOCK_PATTERN.lastIndex = 0;
  while ((match = TS_CODE_BLOCK_PATTERN.exec(markdownText)) !== null) {
    const code = match[1]?.trim();
    if (code) {
      blocks.push(code);
    }
  }
  return blocks;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const docsDir = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), "docs");
  const outputDir = process.argv[3] ? resolve(process.argv[3]) : resolve(process.cwd(), "doc-blocks");
  const files = await extractDocBlocksFromDir(docsDir, outputDir);
  process.stdout.write(`extracted ${files.length} TypeScript doc blocks to ${outputDir}\n`);
}
