import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assert,
  git,
  repositoryRoot,
  splitNull,
} from "./verification-helpers.mjs";
import {
  lifecycleMetadata,
  resolveVerificationLifecycle,
} from "./lifecycle-policy.mjs";

const lifecycle = await resolveVerificationLifecycle();
const metadata = lifecycleMetadata;
const remediation = metadata.remediationChange;
const ownership = metadata.ownership;
const base = remediation.proposalBaseline;
assert(typeof base === "string" && /^[0-9a-f]{40}$/.test(base), "remediation proposal baseline must be a full Git commit");
git(["rev-parse", "--verify", `${base}^{commit}`]);
git(["merge-base", "--is-ancestor", base, "HEAD"]);

const tracked = trackedChanges(base);
const untracked = splitNull(git(["ls-files", "--others", "--exclude-standard", "-z"]));
const records = [...tracked, ...untracked.map((path) => ({ status: "?", path }))];
const violations = [];
const classified = new Map();
const forbiddenPackageImplementationPath = /^packages\/security-audit-sdk-core\/(?:src|lib)\/(?:.*\/)?(?:adapter|instrumentation?|transport|exporter|collector|broker|queue|outbox|storage|siem|analytics|detection|browser|telemetry|framework|middleware|opentelemetry|otlp|cryptographic-chain)(?:[._/-]|$)/i;
const originalArchivePrefix = `${metadata.originalSdkChange.archive}/`;
const activeRemediationPrefix = `${remediation.active}/`;
const remediationArchivePattern = new RegExp(`${remediation.archivePattern.slice(0, -1)}/`);

for (const record of records) {
  const paths = [record.path, record.source].filter(Boolean);
  for (const path of paths) {
    const classification = classify(path);
    classified.set(path, classification);
    if (metadata.contract.protectedPrefixes.some((prefix) => path.startsWith(prefix))) {
      violations.push(`${record.status} ${path} (canonical event contract or contract governance drift)`);
      continue;
    }
    if (path.startsWith(originalArchivePrefix)) {
      violations.push(`${record.status} ${path} (archived original SDK governance is immutable)`);
      continue;
    }
    if (forbiddenPackageImplementationPath.test(path)) {
      violations.push(`${record.status} ${path} (forbidden production integration path inside the SDK package)`);
      continue;
    }
    if (record.status === "?" && metadata.ownership.sdkSourcePrefixes.some((prefix) => path.startsWith(prefix))) {
      violations.push(`? ${path} (untracked SDK source is not an expected reviewed target)`);
      continue;
    }
    if (path.startsWith(ownership.canonicalSdkCapabilityPrefix) && lifecycle.mode !== "archived") {
      violations.push(`${record.status} ${path} (canonical SDK capability may change only through archived OpenSpec application)`);
      continue;
    }
    if (remediationArchivePattern.test(path) && lifecycle.mode !== "archived") {
      violations.push(`${record.status} ${path} (remediation archive is not allowed before archived mode)`);
      continue;
    }
    if (path.startsWith(activeRemediationPrefix) && lifecycle.change === remediation.name && lifecycle.mode === "archived") {
      violations.push(`${record.status} ${path} (active remediation evidence is forbidden in archived mode)`);
    }
  }
}

const reviewTarget = process.env.SDK_VERIFICATION_REVIEW_TARGET;
if (reviewTarget) {
  assert(/^[0-9a-f]{40}$/.test(reviewTarget), "SDK_VERIFICATION_REVIEW_TARGET must be a full Git commit");
  git(["rev-parse", "--verify", `${reviewTarget}^{commit}`]);
  const packageDrift = splitNull(git([
    "diff", "--no-renames", "--name-only", "-z", "--diff-filter=ACDMRTUXB",
    reviewTarget, "--", ownership.packagePrefix,
  ]));
  for (const path of packageDrift) violations.push(`M ${path} (SDK package differs from expected reviewed target ${reviewTarget})`);
}

if (violations.length > 0) {
  throw new Error(`lifecycle-aware changed-path enforcement failed:\n${[...new Set(violations)].sort().join("\n")}`);
}

const counts = [...classified.values()].reduce((result, value) => {
  result[value] = (result[value] ?? 0) + 1;
  return result;
}, {});
process.stdout.write(
  `changed-path policy passed in ${lifecycle.mode} mode for ${lifecycle.change}: ${records.length} visible records; ${JSON.stringify(counts)}; ignored files excluded by standard Git semantics\n`,
);

function trackedChanges(commit) {
  const fields = splitNull(git([
    "diff", "--find-renames", "--name-status", "-z", "--diff-filter=ACDMRTUXB",
    commit, "--",
  ]));
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (/^[RC]/.test(status)) {
      const source = fields[index++];
      const path = fields[index++];
      changes.push({ status, source, path });
    } else {
      changes.push({ status, path: fields[index++] });
    }
  }
  return changes;
}

function classify(path) {
  if (path.startsWith(ownership.packagePrefix)) return "sdk-package";
  if (path.startsWith(activeRemediationPrefix)) return "active-remediation";
  if (remediationArchivePattern.test(path)) return "archived-remediation";
  if (path.startsWith(ownership.canonicalSdkCapabilityPrefix)) return "sdk-capability";
  if (metadata.contract.protectedPrefixes.some((prefix) => path.startsWith(prefix))) return "event-contract";
  if (path.startsWith(originalArchivePrefix)) return "original-sdk-archive";
  if (path === "CLAUDE.md" || /(?:^|\/)CLAUDE\.md$/.test(path)) return "local-instruction-unrelated";
  return existsSync(resolve(repositoryRoot, path)) ? "unrelated-history-or-worktree" : "unrelated-deletion";
}
