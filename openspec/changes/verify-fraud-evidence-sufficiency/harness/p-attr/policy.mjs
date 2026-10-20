import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Analytical model backed by the published field policy, read as text only.
// All citations are at cc4fdf5a3309db5077b85c4954c916b9ba902b8e. No canonical
// code is loaded and no package is imported. The parent reads the approved
// checkout's copy; offline tests read the repository file.
export const POLICY_BASE = "cc4fdf5a3309db5077b85c4954c916b9ba902b8e";
// Absolute repository path: the sandboxed child (cwd=<service>) can import
// this module without any filesystem I/O, and parent/test callers resolve the
// policy regardless of process.cwd().
const POLICY_PATH = fileURLToPath(new URL("../../../../../contracts/security-audit/policies/field-policy.json", import.meta.url));

let PUBLISHED = null;

export function publishedPolicies() {
  if (PUBLISHED === null) {
    PUBLISHED = new Map(JSON.parse(readFileSync(POLICY_PATH, "utf8"))
      .map((entry) => [entry.path, { authority: entry.authority, trust: entry.trust }]));
  }
  return PUBLISHED;
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
