import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { databaseDirectory, preparePermissions } from "../lib/database-permissions.mjs";
import { launchProbe } from "../lib/launcher.mjs";
import { requireDatabasePlan } from "../lib/plan.mjs";
import { launchFixture, observedFixture, permissionFixture } from "./p-e-permission-fixtures.mjs";

const PROBES = ["p-ids", "p-d", "p-attr"];
const REFUSED_DIRECTORIES = [
  ["repository", (f) => f.repo],
  ["service", (f) => f.service],
  ["service descendant", (f) => join(f.service, "child")],
  ["outside scratch", (f) => f.root],
  ["scratch root", (f) => f.scratch],
  ["traversal", (f) => `${f.database.directory}/../host-database`],
  ["multiple directories", (f) => [f.database.directory, f.service]],
];
const EXTRA_GRANTS = ["--allow-net", "--allow-child-process", "--allow-addons", "--allow-fs-write=*", "--allow-fs-read=*", "--allow-wasi"];
const BAD_DECLARATIONS = [["host-database"], "host-database", {}, null, 1];

for (const probeDirectory of PROBES) {
  test(`${probeDirectory} keeps its exact two flags and no database argument`, (t) => {
    const fixture = permissionFixture(t);
    const permissions = preparePermissions({ ...fixture, databaseScratch: false });
    const expected = ["--permission", `--allow-fs-read=${fixture.service}`];
    assert.equal(JSON.stringify(permissions.flags), JSON.stringify(expected));
    assert.equal(permissions.database, undefined);
    const inventory = { [`harness/${probeDirectory}/probe-process.mjs`]: {} };
    launchProbe({ ...launchFixture(fixture), ...permissions, database: undefined, probeDirectory, inventory, run: ({ args }) => {
      assert.deepEqual(args, [...expected, join(fixture.service, "harness", probeDirectory, "probe-process.mjs"), "--role", "fixture", "--budget", "2"]);
      return JSON.stringify(observedFixture(fixture));
    } });
  });
}

test("one opt-in directory supplies exactly the write grant and child argument", (t) => {
  const f = permissionFixture(t);
  assert.equal(databaseDirectory(f.database), join(f.scratch, "host-database"));
  launchProbe(launchFixture(f, ({ args }) => {
    assert.deepEqual(args, ["--permission", `--allow-fs-read=${f.service}`, `--allow-fs-write=${f.database.directory}`,
      join(f.service, "harness/p-e/probe-process.mjs"), "--role", "fixture", "--budget", "2", "--database-directory", f.database.directory]);
    return JSON.stringify(observedFixture(f));
  }));
});

for (const [name, directory] of REFUSED_DIRECTORIES) {
  test(`database launch refuses ${name} before spawning`, (t) => {
    const fixture = permissionFixture(t);
    mkdirSync(join(fixture.service, "child"));
    const database = { ...fixture.database, directory: directory(fixture) };
    assert.throws(() => launchProbe({ ...launchFixture(fixture, () => assert.fail("must not spawn")), database }));
  });
}

test("real paths refuse symlink escapes and protected repo aliases", (t) => {
  const f = permissionFixture(t);
  const outside = join(f.scratch, "alias");
  symlinkSync(f.root, outside);
  assert.throws(() => databaseDirectory({ ...f.database, directory: outside }), /outside service/);
  const repoAlias = join(f.root, "repo-alias");
  symlinkSync(f.scratch, repoAlias);
  assert.throws(() => databaseDirectory({ ...f.database, repo: repoAlias }), /overlaps/);
  const serviceAlias = join(f.scratch, "service-alias");
  symlinkSync(f.service, serviceAlias);
  assert.throws(() => databaseDirectory({ ...f.database, directory: serviceAlias }), /overlaps/);
});

for (const grant of EXTRA_GRANTS) {
  test(`database launch refuses extra ${grant} before spawning`, (t) => {
    const f = permissionFixture(t);
    assert.throws(() => launchProbe({ ...launchFixture(f, () => assert.fail("must not spawn")), flags: [...f.flags, grant] }), /unexpected permission grant/);
  });
}

test("database declaration admits only a boolean, never directories or arbitrary grants", () => {
  requireDatabasePlan({});
  requireDatabasePlan({ databaseScratch: true });
  for (const databaseScratch of BAD_DECLARATIONS) {
    assert.throws(() => requireDatabasePlan({ databaseScratch }), /boolean opt-in/);
    assert.throws(() => preparePermissions({ databaseScratch }), /boolean opt-in/);
  }
});
