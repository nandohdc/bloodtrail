import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assert,
  changedPathsSince,
  git,
  packageRoot,
  readJson,
  repositoryRoot,
} from "./verification-helpers.mjs";

const provenance = await readJson(resolve(packageRoot, "contract-provenance.json"));
const base = provenance.proposalBaseline;
assert(typeof base === "string", "missing proposal baseline for Git checks");

git(["diff", "--check", base, "--"]);
git(["diff", "--cached", "--check"]);
try {
  git(["diff", "--cached", "--quiet"]);
} catch {
  throw new Error("Git index is not empty; verification must run before staging");
}

const whitespaceErrors = [];
for (const path of changedPathsSince(base)) {
  const absolute = resolve(repositoryRoot, path);
  let info;
  try { info = await stat(absolute); }
  catch { continue; } // Deleted paths are already covered by git diff --check.
  if (!info.isFile()) continue;
  const data = await readFile(absolute);
  if (data.includes(0)) continue;
  if (data.length > 0 && data.at(-1) !== 0x0a) whitespaceErrors.push(`${path}: missing final newline`);
  const text = data.toString("utf8");
  if (text.includes("\r")) whitespaceErrors.push(`${path}: CR bytes are not allowed`);
  for (const [index, line] of text.split("\n").entries()) {
    if (/[ \t]+$/.test(line)) whitespaceErrors.push(`${path}:${index + 1}: trailing whitespace`);
  }
}
if (whitespaceErrors.length > 0) {
  throw new Error(`direct changed-file whitespace checks failed:\n${whitespaceErrors.join("\n")}`);
}

process.stdout.write("Git whitespace/final-newline checks passed and index is empty\n");
