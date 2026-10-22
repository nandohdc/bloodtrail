import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

// Text-only analytical policy; never import canonical code or an SDK package.
export const POLICY_BASE = "cc4fdf5a3309db5077b85c4954c916b9ba902b8e";
export const POLICY_FILE = "contracts/security-audit/policies/field-policy.json";
const ACTIVE = new AsyncLocalStorage();
// Compatibility for existing standalone offline fixtures only. The runner
// ALWAYS supplies its resolved --repo and approved head; it never uses this.
const OFFLINE_SOURCE = { repo: fileURLToPath(new URL("../../../../../", import.meta.url)), approvedHead: POLICY_BASE };
let offlinePolicies;

export function verifiedPolicies({ repo, approvedHead }) {
  assert(typeof repo === "string" && isAbsolute(repo), "policy requires an absolute approved repository root");
  assert(/^[a-f0-9]{40}$/.test(approvedHead), "policy requires an exact approved head");
  const bytes = readFileSync(join(repo, POLICY_FILE));
  const committed = execFileSync("git", ["show", `${approvedHead}:${POLICY_FILE}`], { cwd: repo, maxBuffer: 1024 * 1024 });
  assert(bytes.equals(committed), "field policy bytes differ from approved head");
  return new Map(JSON.parse(bytes.toString("utf8"))
    .map((entry) => [entry.path, { authority: entry.authority, trust: entry.trust }]));
}

// Implementer default: evaluation-local scope, not a global root/head cache.
// A second evaluation rechecks bytes, including after a dirty-file change.
// The sandbox child performs no analysis and therefore no policy I/O.
export function withPolicySource(source, evaluate) {
  if (source === undefined) return evaluate();
  return withPolicies(verifiedPolicies(source), evaluate);
}

// Offline callers may inject a verified fixture without filesystem access.
export function withPolicies(policies, evaluate) {
  return ACTIVE.run(policies, evaluate);
}

export function publishedPolicies() {
  const active = ACTIVE.getStore();
  if (active !== undefined) return active;
  if (offlinePolicies === undefined) offlinePolicies = verifiedPolicies(OFFLINE_SOURCE);
  return offlinePolicies;
}

// The published policy defines trust and authority only. The intended meaning
// classes and the resource-rule reading stay a small, cited local table:
// spec.md:90-92 (credential reference used; usernames/emails/claims never
// substitute for authoritative identifiers), catalog.json resource_rule.
const MEANINGS = new Map([
  ["actor.id", "performer"], ["authenticated_principal.id", "authenticated_principal"],
  ["subject.id", "resolved_account"], ["resource.id", "resolved_account"],
  ["credential.reference", "credential_reference"], ["session.id", "session_fingerprint"],
]);

export function fieldPolicy(path) {
  return publishedPolicies().get(path);
}

export function intendedMeaning(path) {
  return MEANINGS.get(path);
}

// Implementer default following the skeptic: AS subject/resource identity violates
// the literal credential/session-only rule, even when redundant and low harm.
export function resourceContribution({ family, path, content, origin }) {
  if (path.startsWith("subject.")) return resolvedRule({ family, content, origin });
  if (path === "resource.id") return resolvedRule({ family, content, origin });
  if (path === "credential.reference") return family === "AS" ? "conforms" : "violates";
  if (path === "session.id") return family === "AS" ? "conforms" : "violates";
  if (content.kind === "presented_identifier") return "circumvents";
  if (content.source === "lookup") return "circumvents";
  return "conforms";
}

function resolvedRule({ family, content, origin }) {
  if (!["PR", "RA"].includes(family)) return "violates";
  if (origin !== "SR") return "violates";
  if (content.kind !== "resolved_account") return "violates";
  return content.source === "safe_resolution" ? "conforms" : "violates";
}
