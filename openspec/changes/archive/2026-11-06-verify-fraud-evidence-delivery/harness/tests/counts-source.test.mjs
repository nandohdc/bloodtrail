import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { codePointCompare } from "../counts/order.mjs";

const HARNESS = new URL("../", import.meta.url);

function modulePaths() {
  const counts = readdirSync(new URL("counts/", HARNESS)).filter((file) => file.endsWith(".mjs")).map((file) => `counts/${file}`);
  const tests = readdirSync(new URL("tests/", HARNESS)).filter((file) => file.startsWith("counts-")).map((file) => `tests/${file}`);
  return [...counts, ...tests, "expectations/counts.v1.json", "README.md", "../tasks.md"];
}

test("every new file has exactly one final newline, no trailing whitespace or CR bytes", () => {
  for (const path of modulePaths()) {
    const bytes = readFileSync(new URL(path, HARNESS), "utf8");
    assert.match(bytes, /[^\n]\n$/, path);
    assert.doesNotMatch(bytes, /\r|[\t ]+$/m, path);
  }
});

function esmImports(source) {
  return [...source.matchAll(/^(?:import|export)\s[\s\S]*?\sfrom\s["']([^"']+)["'];/gm)].map((match) => match[1]);
}

function inspectClosure({ url, visited }) {
  if (visited.has(url.href)) return;
  visited.add(url.href);
  assert.doesNotMatch(url.pathname, /\/(?:role-guard|sender-role|run-[^/]+|[^/]+-process)\.mjs$/);
  const source = readFileSync(url, "utf8");
  for (const specifier of esmImports(source)) visitImport({ specifier, url, visited });
  assert.doesNotMatch(source, /contracts\/security-audit\/examples|(?:from|import\()[\s"']+@bloodtrail\//);
}

function visitImport({ specifier, url, visited }) {
  if (specifier.startsWith("node:")) return;
  assert(specifier.startsWith("."), `external package import: ${specifier}`);
  inspectClosure({ url: new URL(specifier, url), visited });
}

test("counts tests' transitive ESM imports exclude kit packages and process shells", () => {
  const paths = modulePaths().filter((path) => path.endsWith(".test.mjs"));
  const visited = new Set();
  paths.forEach((path) => inspectClosure({ url: new URL(path, HARNESS), visited }));
  assert(visited.has(new URL("counts/engine.mjs", HARNESS).href));
  assert(visited.has(new URL("lib/gated-session.mjs", HARNESS).href));
  assert(visited.has(new URL("lib/composition.mjs", HARNESS).href));
});

test("ordering uses Unicode code points and never locale or bare sorts", () => {
  assert.deepEqual(["\u{10000}", "\uE000", "a", "aa"].sort(codePointCompare), ["a", "aa", "\uE000", "\u{10000}"]);
  const paths = modulePaths().filter((path) => path.startsWith("counts/"));
  paths.forEach((path) => {
    const source = readFileSync(new URL(path, HARNESS), "utf8");
    assert.doesNotMatch(source, /\.localeCompare\(|\.sort\(\s*\)/, fileURLToPath(new URL(path, HARNESS)));
  });
});
