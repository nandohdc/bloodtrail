import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fieldPolicy, POLICY_BASE } from "../p-attr/policy.mjs";
import { SOURCE_TABLE } from "./p-attr-source-table.mjs";

function baseText(path) {
  return execFileSync("git", ["show", `${POLICY_BASE}:${path}`], { encoding: "utf8" });
}

// Read as text only; canonical JSON is never imported through a package.
const FIELDS = JSON.parse(baseText("contracts/security-audit/policies/field-policy.json"));
const POLICY_PATHS = [
  "actor.id", "actor.type", "actor.display_name", "subject.id", "subject.display_name",
  "authenticated_principal.id", "credential.reference", "session.id", "session.age_seconds",
  "tenant.claimed_tenant_id", "request.id", "request.route", "request.user_agent",
  "correlation.request_id", "correlation.trace_id", "authentication.method",
  "authorization.resource_context.id", "event.outcome_reason.message", "source.observed.address",
];

test("Q8: the analytical policy has zero mismatches against every published field-policy entry", () => {
  for (const canonical of FIELDS) {
    assert.deepEqual(fieldPolicy(canonical.path), { authority: canonical.authority, trust: canonical.trust }, canonical.path);
  }
  assert.equal(FIELDS.length, 142);
});

test("Q8: every path any carrier uses resolves to the published trust and authority", () => {
  for (const path of POLICY_PATHS) {
    const canonical = FIELDS.find((field) => field.path === path);
    assert(canonical, path);
    assert.deepEqual(fieldPolicy(path), { authority: canonical.authority, trust: canonical.trust });
  }
  assert.equal(fieldPolicy("not.a.published.path"), undefined, "unknown paths fail closed instead of defaulting");
});

for (const path of POLICY_PATHS) {
  test(`local analytical policy matches pinned public policy ${path}`, () => {
    const canonical = FIELDS.find((field) => field.path === path);
    assert(canonical, path);
    assert.deepEqual(fieldPolicy(path), { authority: canonical.authority, trust: canonical.trust });
  });
}

test("all hand-written table citations resolve at the pinned base, not draft line numbers", () => {
  for (const row of SOURCE_TABLE) {
    for (const citation of row.basis) {
      const [path, ranges] = citation.split(":");
      const lines = baseText(path).trimEnd().split("\n");
      for (const range of ranges.split(",")) {
        const [start, end = start] = range.split("-").map(Number);
        assert(start > 0, citation);
        assert(end >= start, citation);
        assert(end <= lines.length, citation);
        assert(lines.slice(start - 1, end).join("\n").trim().length > 0, citation);
      }
    }
  }
});

const SOURCE_ANCHORS = [
  ["packages/security-audit-sdk-core/src/validation/semantic.ts", 374, 'event.actor.type !== "anonymous"'],
  ["packages/security-audit-sdk-core/src/validation/semantic.ts", 377, 'event.actor.type === "anonymous"'],
  ["packages/security-audit-sdk-core/src/events.ts", 391, 'case "register":'],
  ["contracts/security-audit/catalog/catalog.json", 148, "credential/session references only"],
  ["contracts/security-audit/catalog/catalog.json", 202, "credential type only when safe"],
];
test("module evaluation performs zero filesystem I/O; the policy is read lazily on first call", () => {
  const service = mkdtempSync(join(realpathSync(tmpdir()), "p-attr-policy-import-"));
  try {
    writeFileSync(join(service, "policy.mjs"), readFileSync(new URL("../p-attr/policy.mjs", import.meta.url)));
    // No --allow-fs-read: the main module may load, and any read at module
    // evaluation would fail closed with ERR_ACCESS_DENIED.
    execFileSync(process.execPath, ["--permission", "policy.mjs"], { cwd: service, encoding: "utf8" });
  } finally { rmSync(service, { recursive: true, force: true }); }
});

test("fieldPolicy resolves the pinned policy by absolute path regardless of process.cwd()", () => {
  const service = mkdtempSync(join(realpathSync(tmpdir()), "p-attr-policy-cwd-"));
  try {
    const script = join(service, "cwd-child.mjs");
    writeFileSync(script, `import { fieldPolicy, publishedPolicies } from ${JSON.stringify(new URL("../p-attr/policy.mjs", import.meta.url).href)};
process.stdout.write(JSON.stringify({
  actor: fieldPolicy("actor.id"),
  cached: publishedPolicies() === publishedPolicies(),
  unknown: fieldPolicy("not.a.published.path") ?? null,
}));\n`);
    const canonical = FIELDS.find((field) => field.path === "actor.id");
    const output = JSON.parse(execFileSync(process.execPath, [script], { cwd: service, encoding: "utf8" }));
    assert.deepEqual(output, { actor: { authority: canonical.authority, trust: canonical.trust }, cached: true, unknown: null });
  } finally { rmSync(service, { recursive: true, force: true }); }
});

for (const [path, line, anchor] of SOURCE_ANCHORS) {
  test(`re-derived source anchor ${path}:${line}`, () => {
    assert(baseText(path).split("\n")[line - 1].includes(anchor));
  });
}
