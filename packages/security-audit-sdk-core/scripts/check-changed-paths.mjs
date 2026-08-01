import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assert,
  changedPathsSince,
  git,
  packageRoot,
  readJson,
  repositoryRoot,
} from "./verification-helpers.mjs";

const provenance = await readJson(resolve(packageRoot, "contract-provenance.json"));
const base = provenance.proposalBaseline;
assert(typeof base === "string" && /^[0-9a-f]{40}$/.test(base), "proposal baseline must be a full Git commit");
git(["rev-parse", "--verify", `${base}^{commit}`]);
git(["merge-base", "--is-ancestor", base, "HEAD"]);

const packagePrefix = "packages/security-audit-sdk-core/";
const activePrefix = "openspec/changes/implement-security-audit-sdk-core/";
const archivePattern = /^openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-implement-security-audit-sdk-core\//;
const sdkCapabilityPrefix = "openspec/specs/security-audit-sdk-core/";
const activeExists = existsSync(resolve(repositoryRoot, activePrefix));
const paths = changedPathsSince(base);
const archivePrefixes = [...new Set(paths.flatMap((path) => {
  const match = path.match(/^(openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-implement-security-audit-sdk-core\/)/);
  return match?.[1] ? [match[1]] : [];
}))];

// Active apply allows only the isolated package and its active change. After archive,
// Git naturally reports deletion of the active path plus addition of one dated archive
// path and the canonical SDK capability. This inference keeps the check useful after
// archival without ever allowing the canonical security-audit contract capability.
const archivedMode = !activeExists && archivePrefixes.length === 1;
assert(activeExists || archivedMode, "cannot infer active or archived SDK-core change lifecycle");
assert(archivePrefixes.length <= 1, "more than one SDK-core archive path changed");

const protectedPrefixes = [
  "contracts/security-audit/",
  "openspec/specs/security-audit-event-contract/",
  `${provenance.archivedChange}/`,
];
const forbiddenPackageImplementationPath = /^packages\/security-audit-sdk-core\/(?:src|lib)\/(?:.*\/)?(?:adapter|instrumentation?|transport|exporter|collector|broker|queue|outbox|storage|siem|analytics|detection|browser|telemetry|framework|middleware|opentelemetry|otlp|cryptographic-chain)(?:[._/-]|$)/i;
const violations = [];
for (const path of paths) {
  if (protectedPrefixes.some((prefix) => path.startsWith(prefix))) {
    violations.push(`${path} (approved contract or archived contract governance is protected)`);
    continue;
  }
  if (forbiddenPackageImplementationPath.test(path)) {
    violations.push(`${path} (forbidden production integration path inside the SDK package)`);
    continue;
  }
  const activeAllowed = path.startsWith(packagePrefix) || path.startsWith(activePrefix);
  const archiveAllowed = archivedMode && (
    archivePattern.test(path)
    || path.startsWith(sdkCapabilityPrefix)
  );
  if (!activeAllowed && !archiveAllowed) {
    violations.push(`${path} (outside isolated SDK package/change scope)`);
  }
}

if (violations.length > 0) {
  throw new Error(`unauthorized changed paths since ${base}:\n${violations.join("\n")}`);
}

process.stdout.write(
  `exact changed-path scope passed in ${archivedMode ? "archived" : "active"} mode: ${paths.length} paths since ${base}\n`,
);
