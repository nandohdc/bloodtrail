import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { preparePermissions } from "../lib/database-permissions.mjs";

export function permissionFixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "pe-database-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scratch = join(root, "scratch");
  const repo = join(root, "repo");
  const service = join(scratch, "own-service");
  for (const path of [repo, service]) mkdirSync(path, { recursive: true });
  const resolved = join(service, "fixture.mjs");
  writeFileSync(resolved, "// Offline fixture only; no installed package.\n");
  const paths = { root, scratch, repo, service };
  const permissions = preparePermissions({ ...paths, databaseScratch: true });
  return { ...paths, ...permissions, resolvedCore: pathToFileURL(resolved).href };
}

export function launchFixture(fixture, run) {
  return {
    service: fixture.service, database: fixture.database, flags: fixture.flags,
    role: "fixture", budget: 2, probeDirectory: "p-e", prefix: "harness",
    inventory: { "harness/p-e/probe-process.mjs": { git_blob: "fixture" } }, run,
  };
}

export function observedFixture(fixture) {
  return { role: "fixture", resolved_core: fixture.resolvedCore, ledger: { occurrence_count: 1 }, invalidations: [], outcomes: [{ raw: "opaque-observation" }] };
}
