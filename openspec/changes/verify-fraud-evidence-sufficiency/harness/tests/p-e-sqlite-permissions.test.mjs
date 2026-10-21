import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { permissionFixture } from "./p-e-permission-fixtures.mjs";

// Native fixture only: no kit, SDK, probe main, socket or DNS operation.
const SQLITE_FIXTURE = `import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const directory = process.argv[2];
const file = directory + "/fixture.sqlite";
assert.equal(process.permission.has("net"), false);
assert.equal(process.permission.has("child"), false);
assert.equal(process.permission.has("addons"), false);
assert.equal(process.permission.has("fs.read", file), false);
assert.throws(() => writeFileSync(directory + "/../escaped", "opaque"), { code: "ERR_ACCESS_DENIED" });
writeFileSync(directory + "/write-fixture", "opaque");
const db = new DatabaseSync(file);
db.exec("CREATE TABLE fixture (id TEXT PRIMARY KEY); BEGIN");
assert.equal(db.isTransaction, true);
db.prepare("INSERT INTO fixture VALUES (?)").run("pe-opaque-1");
db.exec("COMMIT; BEGIN");
db.prepare("INSERT INTO fixture VALUES (?)").run("pe-opaque-2");
db.exec("ROLLBACK");
assert.equal(db.isTransaction, false);
db.close();
const reopened = new DatabaseSync(file);
assert.equal(reopened.prepare("SELECT count(*) AS n FROM fixture").get().n, 1);
reopened.close();
console.log(JSON.stringify({ committed: 1, rolled_back: true, reopened: true }));
`;

test("native SQLite fixture commits, rolls back and reopens; the write grant covers fs operations only", (t) => {
  const f = permissionFixture(t);
  const script = join(f.service, "sqlite-fixture.mjs");
  writeFileSync(script, SQLITE_FIXTURE);
  const args = [...f.flags, script, f.database.directory];
  const result = spawnSync(process.execPath, args, { encoding: "utf8", cwd: f.service });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { committed: 1, rolled_back: true, reopened: true });
  const denied = spawnSync(process.execPath, [...f.flags.slice(0, 2), script, f.database.directory], { encoding: "utf8", cwd: f.service });
  assert.equal(denied.status, 1);
  // Removing the write grant denies the fixture's fs.writeFileSync, not SQLite.
  // Node 26.12.0 does not enforce node:sqlite file access through this grant.
  assert.match(denied.stderr, /ERR_ACCESS_DENIED/);
  assert.match(denied.stderr, /write-fixture/);
});
