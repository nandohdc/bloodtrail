// Static build-only scope/hygiene tests for the frozen P-attr plan (US-009).
// Fixture-only: reads harness files as text, imports no kit/SDK code and
// executes no probe, pipeline or network call.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { filesBelow } from "../lib/io.mjs";

const HARNESS = fileURLToPath(new URL("..", import.meta.url));
const P_ATTR_DIR = join(HARNESS, "p-attr");
const TESTS_DIR = join(HARNESS, "tests");

const CORRECTED_AT = "cc4fdf5a3309db5077b85c4954c916b9ba902b8e";
const ENTRYPOINT_NAME = /(run-p-(attr|d|ids)|probe-process|kit-cli)\.mjs$/;
const DOC_RANGES = ["192.0.2.", "198.51.100.", "203.0.113."];
const P_ATTR_SOURCES = [
  ...filesBelow(P_ATTR_DIR).filter((path) => path.endsWith(".mjs")),
  ...filesBelow(TESTS_DIR).filter((path) => path.includes(`${sep}p-attr-`) && path.endsWith(".mjs")),
  join(HARNESS, "expectations/p-attr.v1.json"),
];

function importsOf(source) {
  const found = [];
  for (const match of source.matchAll(/from\s+"([^"]+)"/g)) found.push(match[1]);
  for (const match of source.matchAll(/import\(\s*"([^"]+)"/g)) found.push(match[1]);
  return found;
}

function ipV4s(source) {
  const found = [];
  for (const match of source.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
    const octets = match[0].split(".").map((part) => Number(part));
    if (octets.every((octet) => octet <= 255)) found.push(match[0]);
  }
  return found;
}

function relLabel(path) {
  return posix.relative(HARNESS, path);
}

function moduleRoots() {
  return [
    join(HARNESS, "lib"),
    join(HARNESS, "p-attr"),
    join(HARNESS, "p-d"),
    join(HARNESS, "p-ids"),
  ];
}

function modulesUnder(root) {
  return filesBelow(root).filter((path) => path.endsWith(".mjs") && posix.basename(path) !== "probe-process.mjs");
}

test("future probe entry imports only local harness modules", () => {
  const entry = readFileSync(join(P_ATTR_DIR, "run-p-attr.mjs"), "utf8");
  assert(entry.includes("await runAttr({ entrypoint: import.meta.url })"));
  for (const rel of ["p-attr/run-p-attr.mjs", "p-attr/roles.mjs"]) {
    const source = readFileSync(join(HARNESS, rel), "utf8");
    for (const specifier of importsOf(source)) {
      assert.match(specifier, /^\./, `${rel} must import a local harness module, got ${specifier}`);
    }
  }
});

test("only the three future probe processes import kit/SDK packages", () => {
  for (const root of moduleRoots()) {
    for (const path of modulesUnder(root)) {
      const source = readFileSync(path, "utf8");
      for (const specifier of importsOf(source)) {
        assert.match(specifier, /^(\.|node:)/, `${relLabel(path)} imports package ${specifier}`);
      }
    }
  }
  for (const specifier of importsOf(readFileSync(join(HARNESS, "kit-cli.mjs"), "utf8"))) {
    assert.match(specifier, /^(\.|node:)/, `kit-cli.mjs imports package ${specifier}`);
  }
});

test("no test imports, dynamic-imports or spawns a probe/CLI entrypoint", () => {
  for (const path of filesBelow(TESTS_DIR)) {
    if (!path.endsWith(".mjs")) continue;
    const source = readFileSync(path, "utf8");
    for (const specifier of importsOf(source)) {
      assert.doesNotMatch(specifier, ENTRYPOINT_NAME, `${relLabel(path)} imports ${specifier}`);
    }
    for (const match of source.matchAll(/(?:execFileSync|execSync|spawnSync|spawn|exec)\(\s*["']([^"']+)["']/g)) {
      assert.doesNotMatch(match[1], ENTRYPOINT_NAME, `${relLabel(path)} executes ${match[1]}`);
    }
  }
});

test("P-attr synthetic data uses only documentation-range addresses", () => {
  for (const path of P_ATTR_SOURCES) {
    const source = readFileSync(path, "utf8");
    for (const address of ipV4s(source)) {
      assert(DOC_RANGES.some((range) => address.startsWith(range)), `${relLabel(path)} address ${address} is outside the documentation ranges`);
    }
  }
});

test("P-attr identifiers are opaque synthetic and never email-like", () => {
  for (const path of P_ATTR_SOURCES) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
      `${relLabel(path)} contains an email-like identifier`);
  }
});

test("no serialized HMAC key or digest in P-attr sources or the frozen plan", () => {
  const frozen = readFileSync(join(HARNESS, "expectations/p-attr.v1.json"), "utf8");
  for (const match of frozen.matchAll(/[0-9a-f]{40,}/g)) {
    assert.equal(match[0], CORRECTED_AT, "the only long hex run in expectations must be corrected_at");
  }
  for (const path of [...filesBelow(P_ATTR_DIR), join(HARNESS, "expectations/p-attr.v1.json")]) {
    if (!path.endsWith(".mjs")) continue;
    assert.doesNotMatch(readFileSync(path, "utf8"), /"[0-9a-f]{64}"/, `${relLabel(path)} embeds a 64-hex key literal`);
  }
});
