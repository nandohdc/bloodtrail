import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { marker, RECIPES, diagnosticPath } from "../p-d/markers.mjs";
import { EXPECTATIONS } from "./pd-fixtures.mjs";

function files(url) {
  return readdirSync(url, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(entry.name, url);
    return entry.isDirectory() ? files(new URL(entry.name + "/", url)) : [path];
  });
}
const additions = () => [
  ...files(new URL("../p-d/", import.meta.url)),
  ...files(new URL("./", import.meta.url)).filter((path) => path.pathname.split("/").at(-1).startsWith("pd-")),
  ...["expectations/p-d.v1.json", "README.md", "run-ledger.md", "lib/approval.mjs", "lib/launcher.mjs", "lib/results.mjs", "lib/probe-runner.mjs", "p-ids/orchestrate.mjs", "p-ids/run-p-ids.mjs"].map((path) => new URL("../" + path, import.meta.url)),
];

test("all labelled synthetic marker recipes join only at runtime with frozen lengths", () => {
  assert.deepEqual(EXPECTATIONS.synthetic_markers.recipes, RECIPES);
  for (const [name, recipe] of Object.entries(RECIPES)) {
    const built = marker(name);
    assert.equal(built.length, recipe.length, name);
    assert(recipe.fragments.every((fragment) => fragment.length < built.length));
    assert.equal(diagnosticPath({ prefix: "/request", recipe: name }), "/request/" + built);
  }
  const source = readFileSync(new URL("../p-d/markers.mjs", import.meta.url), "utf8");
  const prefix = source.split("export function marker")[0];
  assert(!prefix.includes(".join("));
  assert(!prefix.includes(".repeat("));
});

test("no full synthetic marker literal appears anywhere in P-D additions", () => {
  for (const path of additions()) {
    const source = readFileSync(path, "utf8");
    for (const name of Object.keys(RECIPES)) assert(!source.includes(marker(name)), `${path.pathname}: literal recipe ${name}`);
  }
});

test("all C9 supported combinations and recipe boundaries remain frozen", () => {
  const c9 = EXPECTATIONS.cases.find((entry) => entry.case_id === "PD-C9");
  assert.equal(c9.variants.length, 35);
  assert.equal(new Set(c9.variants.map((variant) => variant.method)).size, 15);
  assert.deepEqual([...new Set(c9.variants.map((variant) => variant.outcome))].sort(), ["cancelled", "denied", "failure", "partial"]);
  assert.equal(RECIPES.bearer16.length - RECIPES.bearer15.length, 1);
  assert.equal(RECIPES.key16.length - RECIPES.key15.length, 1);
});
