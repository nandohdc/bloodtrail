import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permissionFixture } from "./p-e-permission-fixtures.mjs";

// Native-only sandbox fixture: no SDK, kit, workload or probe import. Reproduce
// the exact write-only database permission planned for P-E. existsSync needs
// an ungranted fs.read; exclusive creation and unlink need only fs.write.
const SCENARIOS = ["commit", "fault"];
const SCRIPT = `import assert from "node:assert/strict";
import { withHostDatabase } from "./p-e/host.mjs";
const [directory, mode] = process.argv.slice(2);
assert.equal(process.permission.has("fs.read", directory), false);
assert.equal(process.permission.has("net"), false);
let host;
let observedFault = false;
try {
  await withHostDatabase({ directory, name: mode, work(opened) {
    host = opened;
    host.begin();
    host.insertBusiness({ id: "pe-change-0001" });
    if (mode === "fault") throw new Error("pe-host-work-fault");
    host.commit();
  } });
} catch (error) {
  assert.equal(error.message, "pe-host-work-fault");
  observedFault = true;
}
console.log(JSON.stringify({ closed: host.closed, observedFault }));
`;

for (const scenario of SCENARIOS) {
  test(`outbox host file is removed with write-only permission after ${scenario}`, (t) => {
    const fixture = permissionFixture(t);
    for (const path of ["p-e", "lib"]) mkdirSync(join(fixture.service, path));
    copyFileSync(new URL("../p-e/host.mjs", import.meta.url), join(fixture.service, "p-e/host.mjs"));
    copyFileSync(new URL("../lib/io.mjs", import.meta.url), join(fixture.service, "lib/io.mjs"));
    const script = join(fixture.service, "cleanup.mjs");
    writeFileSync(script, SCRIPT);
    const result = spawnSync(process.execPath, [...fixture.flags, script, fixture.database.directory, scenario],
      { encoding: "utf8", cwd: fixture.service });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { closed: true, observedFault: scenario === "fault" });
    assert.deepEqual(readdirSync(fixture.database.directory), [], "per-case file must be unlinked, not merely invisible");
  });
}
