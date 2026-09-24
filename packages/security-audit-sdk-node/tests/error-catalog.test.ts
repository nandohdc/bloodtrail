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

// The contract codes that part 1 leaves undocumented, in the core's order.
// Part 2 (#584) documents them and deletes this list.
const PENDING_CONTRACT_CODES: ReadonlyArray<string> = [
  "INVALID_DELEGATION",
  "UNKNOWN_EXTENSION",
  "ENVELOPE_PAYLOAD_CONFLICT",
  "UNSUPPORTED_MAPPING_VERSION",
  "PROHIBITED_BODY_ATTRIBUTES",
  "MISSING_NATIVE_MAPPING",
  "MAPPING_SCOPE_OVERCLAIM",
  "UNAPPROVED_POLICY_CRITICAL_POSTURE",
  "UNSUPPORTED_COMPATIBILITY_VERSION",
  "DERIVED_FROM_MALFORMED_INPUT",
  "DERIVED_FROM_DUPLICATE_INPUT",
  "DERIVED_FROM_NONCANONICAL_ORDER",
  "DERIVED_FROM_UNRESOLVABLE_INPUT",
  "DERIVED_FROM_ABSENT_INPUT",
  "DERIVED_FROM_EMPTY_INPUT",
  "DERIVED_FROM_NON_DERIVED",
  "DERIVED_FROM_CYCLE",
  "DERIVED_FROM_MISSING",
  "DERIVED_FROM_TRUST_FLOOR_EXCEEDED",
];

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
    missing: EXPORTED_CODES.filter((code) => !codes.includes(code) && !PENDING_CONTRACT_CODES.includes(code)),
    unknown: codes.filter((code) => !EXPORTED_CODES.includes(code)),
    repeated: codes.filter((code, index) => codes.indexOf(code) !== index),
    incomplete: entries.filter((entry) => !ENTRY_PARTS.every((part) => entry.body.includes(part))).map((entry) => entry.code),
  };
}

const NO_PROBLEMS = { missing: [], unknown: [], repeated: [], incomplete: [] };

describe("error catalog", () => {
  it("documents every exported code that is not pending, once, with every part, and no other code", () => {
    assert.deepEqual(catalogProblems(CATALOG), NO_PROBLEMS);
  });

  it("leaves pending exactly the contract codes it does not document", () => {
    const documented = documentedCodes(CATALOG);
    assert.deepEqual(PENDING_CONTRACT_CODES, CONTRACT_ERROR_CODES.filter((code) => !documented.includes(code)));
  });

  it("fails and names the code when one exported code's entry is removed", () => {
    for (const code of [SDK_ERROR_CODES[0], CONTRACT_ERROR_CODES[0]]) {
      const withoutEntry = CATALOG.replace(entryText(entryFor(CATALOG, code)), "");
      assert.deepEqual(catalogProblems(withoutEntry), { ...NO_PROBLEMS, missing: [code] });
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
