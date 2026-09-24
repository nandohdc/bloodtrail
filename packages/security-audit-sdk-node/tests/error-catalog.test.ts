// The error catalog (#583, #584). docs/error-catalog.md documents the codes in
// the core's exported SDK and contract error code lists, and no other code. Its
// entries are the `### \`CODE\`` headings. Each entry gives the code's meaning,
// its common causes, the fix, and the result fields to read.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CONTRACT_ERROR_CODES, SDK_ERROR_CODES } from "@bloodtrail/security-audit-sdk-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = readFileSync(resolve(__dirname, "../docs/error-catalog.md"), "utf8");
const EXPORTED_CODES: ReadonlyArray<string> = [...SDK_ERROR_CODES, ...CONTRACT_ERROR_CODES];
const ENTRY_PARTS = ["**Meaning.**", "**Common causes.**", "**Fix.**", "**Fields.**"];

interface CatalogEntry {
  readonly code: string;
  readonly body: string;
}

// An entry runs from its heading to the next heading of level three or above.
function catalogEntries(catalog: string): CatalogEntry[] {
  return catalog
    .split(/^(?=#{1,3} )/m)
    .map((section) => /^### `([^`\n]+)`\n([\s\S]*)$/.exec(section))
    .filter((match) => match !== null)
    .map(([, code, body]) => ({ code: code!, body: body! }));
}

function documentedCodes(catalog: string): string[] {
  return catalogEntries(catalog).map((entry) => entry.code);
}

function entryFor(catalog: string, code: string): CatalogEntry {
  const entry = catalogEntries(catalog).find((candidate) => candidate.code === code);
  assert.ok(entry, `the catalog has no ${code} entry`);
  return entry;
}

// The entry's text exactly as the catalog holds it, heading included.
function entryText(entry: CatalogEntry): string {
  return `### \`${entry.code}\`\n${entry.body}`;
}

// Each list names the codes at fault, so a failed comparison says which ones.
function catalogProblems(catalog: string) {
  const entries = catalogEntries(catalog);
  const codes = documentedCodes(catalog);
  return {
    missing: EXPORTED_CODES.filter((code) => !codes.includes(code)),
    unknown: codes.filter((code) => !EXPORTED_CODES.includes(code)),
    repeated: codes.filter((code, index) => codes.indexOf(code) !== index),
    incomplete: entries.filter((entry) => !ENTRY_PARTS.every((part) => entry.body.includes(part))).map((entry) => entry.code),
  };
}

const NO_PROBLEMS = { missing: [], unknown: [], repeated: [], incomplete: [] };

describe("error catalog", () => {
  it("documents every exported code, once, with every part, and no other code", () => {
    assert.deepEqual(catalogProblems(CATALOG), NO_PROBLEMS);
  });

  it("fails and names the code when any one exported code's entry is removed", () => {
    for (const code of EXPORTED_CODES) {
      const withoutEntry = CATALOG.replace(entryText(entryFor(CATALOG, code)), "");
      assert.deepEqual(catalogProblems(withoutEntry), { ...NO_PROBLEMS, missing: [code] }, code);
    }
  });

  it("fails and names the code when the catalog documents a code that neither list contains", () => {
    const unknownEntry = entryText({ code: "SDK_NOT_A_CODE", body: `\n${ENTRY_PARTS.join(" text\n\n")} text\n` });
    assert.deepEqual(catalogProblems(`${CATALOG}\n${unknownEntry}`), { ...NO_PROBLEMS, unknown: ["SDK_NOT_A_CODE"] });
  });

  it("fails and names the code when an entry is repeated or lacks a part", () => {
    const entry = entryFor(CATALOG, SDK_ERROR_CODES[0]);
    assert.deepEqual(catalogProblems(`${CATALOG}\n${entryText(entry)}`), { ...NO_PROBLEMS, repeated: [entry.code] });
    for (const part of ENTRY_PARTS) {
      const stripped: string = CATALOG.replace(entry.body, entry.body.replaceAll(part, ""));
      assert.deepEqual(catalogProblems(stripped), { ...NO_PROBLEMS, incomplete: [entry.code] }, part);
    }
  });
});
