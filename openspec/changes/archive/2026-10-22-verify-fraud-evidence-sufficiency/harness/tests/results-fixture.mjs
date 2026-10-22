import { G38, resultRecord } from "../lib/results.mjs";

export function fixtureResult(patch = {}) {
  const identity = { commit: "1".repeat(40), package_set_digest: "2".repeat(64), manifest_digest: "3".repeat(64), distributable: true, artifacts: [{ filename: "fixture.tgz", sha256: "8".repeat(64) }] };
  return resultRecord({
    probe: "P-ids", ticket: 800, runNumber: 1, approvedHead: identity.commit,
    started: "2026-10-16T00:00:00.000Z", ended: "2026-10-16T00:00:01.000Z",
    approval: { url: G38, createdAt: "fixture", updatedAt: "fixture", body_sha256: "4".repeat(64) },
    expectations: { path: "expectations/p-ids.v1.json", sha256: "5".repeat(64) },
    provenance: { identity, install: {
      lifecycle: [{ name: "fixture", install_lifecycle_absent: true }],
      single_core: { npm_ls_paths: ["/fixture/core"], filesystem_manifests: ["/fixture/core/package.json"] },
      declarations: [{ name: "fixture", symbols: ["opaque"], declarations: [{ path: "fixture.d.ts", sha256: "9".repeat(64) }] }],
    }, kit_digest: "6".repeat(64), runtime: { node: "26", npm: "fixture", v8: "fixture", sqlite: "fixture" }, environment: { kernel: "fixture", filesystem: "fixture" }, permission_flags: ["--permission", "--allow-fs-read=/fixture"], executed_file_hashes: { "fixture.mjs": { sha256: "7".repeat(64) } }, driver: { harness: "pi", provider: "fixture", model: "fixture", thinking: "fixture", run_id: "fixture" }, scratch_deletion: { recursively_absent: true } },
    cases: [{ case_id: "P-ids-01", raw: { processes: [{ ids: { event_id: ["opaque-a"] } }] }, matched: false, notes: ["fixture mismatch"] }],
    invalidations: [], occurrenceCount: 1, ...patch,
  });
}
