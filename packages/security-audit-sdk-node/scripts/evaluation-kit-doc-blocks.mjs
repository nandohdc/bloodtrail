import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

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
