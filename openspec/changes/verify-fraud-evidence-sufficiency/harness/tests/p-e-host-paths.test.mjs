import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openHostDatabase } from "../p-e/host.mjs";
import { scratchDirectory } from "./p-e-host-fixtures.mjs";

const OUTSIDE_NAMES = [
  ["parent traversal", () => "../escaped"],
  ["absolute path", (root) => join(root, "escaped")],
  ["shared directory prefix", () => "../database-sibling/escaped"],
];
const TARGET_STATES = ["absent", "existing"];

function pathFixture(t) {
  const root = scratchDirectory(t, "pe-host-paths-");
  const directory = join(root, "database");
  mkdirSync(directory);
  mkdirSync(join(root, "database-sibling"));
  return { root, directory };
}

for (const [label, nameFor] of OUTSIDE_NAMES) {
  test(`host refuses ${label} before reserving or opening a database`, (t) => {
    const { root, directory } = pathFixture(t);
    const name = nameFor(root);
    const outside = resolve(directory, `${name}.sqlite`);
    assert.equal(existsSync(outside), false);
    assert.throws(() => openHostDatabase({ directory, name }), /path outside service/);
    assert.equal(existsSync(outside), false, "refusal must not create the outside file");
    assert.deepEqual(readdirSync(directory), [], "refusal must not reserve any host file");
  });
}

for (const targetState of TARGET_STATES) {
  test(`exclusive reservation refuses a symlink to an ${targetState} outside target before SQLite opens it`, (t) => {
    const { root, directory } = pathFixture(t);
    const outside = join(root, "outside.sqlite");
    if (targetState === "existing") writeFileSync(outside, "untouched fixture");
    symlinkSync(outside, join(directory, "case.sqlite"));
    assert.throws(() => openHostDatabase({ directory, name: "case" }), /must not pre-exist/);
    assert.equal(existsSync(outside), targetState === "existing");
    if (targetState === "existing") assert.equal(readFileSync(outside, "utf8"), "untouched fixture");
  });
}

test("host checks the canonical directory while retaining its declared spelling", (t) => {
  const { root, directory } = pathFixture(t);
  const alias = join(root, "alias");
  symlinkSync(directory, alias);
  const host = openHostDatabase({ directory: alias, name: "case" });
  try {
    assert.equal(host.file, join(alias, "case.sqlite"));
    assert.equal(existsSync(join(directory, "case.sqlite")), true);
  } finally {
    host.close();
  }
  assert.deepEqual(readdirSync(directory), []);
});
