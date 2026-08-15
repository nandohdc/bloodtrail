/**
 * Actor-neutral documentation checks.
 *
 * The policy is only actor-neutral if the documents that carry it to people are
 * present and say so. Removing one is a governance-core weakening, not a tidy-up,
 * so each is checked for existence and for the specific claims it must keep
 * making.
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_CLAIMS = Object.freeze({
  "docs/design-pattern-governance.md": [
    { id: "actor-neutral-claim-absent", pattern: /applies identically to/i, description: "must state that it applies identically to every actor" },
    { id: "non-authoritative-claim-absent", pattern: /not\s+authoritative|SHALL NOT be sole policy|are \*\*not\*\* policy sources/i, description: "must name the non-authoritative sources" },
    { id: "direct-implementation-claim-absent", pattern: /first-class/i, description: "must state that direct implementation is a first-class decision" },
    { id: "catalog-claims-exhaustive", pattern: /never required|not\s+exhaustive/i, description: "must state that naming a catalog pattern is never required" },
    { id: "required-ci-claim-absent", pattern: /required\s+`?design-pattern-governance`?\s+CI check|required CI check/i, description: "must state that the required CI check is authoritative" },
  ],
  "CONTRIBUTING.md": [
    { id: "contributing-governance-section-absent", pattern: /##\s+Design-pattern governance applies to everyone/, description: "must carry the design-pattern governance section" },
    { id: "contributing-link-absent", pattern: /docs\/design-pattern-governance\.md/, description: "must link the full policy document" },
  ],
  ".github/PULL_REQUEST_TEMPLATE.md": [
    { id: "pull-request-template-incomplete", pattern: /Design-pattern governance/i, description: "must ask for the design-pattern governance evidence" },
    { id: "pull-request-template-incomplete", pattern: /security_sensitive/i, description: "must ask for the security classification" },
    { id: "pull-request-template-incomplete", pattern: /baseline/i, description: "must ask for the baseline checker result on governance-core changes" },
  ],
});

export function checkActorNeutralDocuments(repositoryRoot, policy, sink) {
  const documents = policy.actor_neutral_documents ?? [];
  if (documents.length === 0) {
    sink.fail("actor-neutral-document-absent", "openspec/governance/design-pattern-policy.json",
      "policy declares no actor-neutral documents");
    return;
  }

  for (const relativePath of documents) {
    const absolute = resolve(repositoryRoot, relativePath);
    let text;
    try {
      statSync(absolute);
      text = readFileSync(absolute, "utf8");
    } catch {
      sink.fail("actor-neutral-document-absent", relativePath,
        "actor-neutral document is absent; removing one weakens the perimeter for every contributor who never reads the checker");
      continue;
    }
    for (const claim of REQUIRED_CLAIMS[relativePath] ?? []) {
      if (!claim.pattern.test(text)) {
        sink.fail(claim.id, relativePath, `document ${claim.description}`);
      }
    }
  }

  checkNonAuthoritativeSources(repositoryRoot, policy, sink);
}

/**
 * A non-authoritative source must not present itself as the policy. This looks
 * for the specific inversion — an agent instruction file claiming to be the
 * governing document — rather than policing their content generally.
 */
function checkNonAuthoritativeSources(repositoryRoot, policy, sink) {
  for (const relativePath of policy.non_authoritative_sources ?? []) {
    if (relativePath.endsWith("/")) continue;
    const absolute = resolve(repositoryRoot, relativePath);
    let text;
    try {
      text = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    if (/this (?:file|document) is the (?:authoritative|canonical) (?:design[- ]pattern )?(?:governance )?policy/i.test(text)) {
      sink.fail("non-authoritative-source-claims-authority", relativePath,
        "a non-authoritative source claims to be the governing policy; the canonical capability and required CI control");
    }
  }
}

export function checkTemplates(repositoryRoot, sink) {
  const templates = [
    ["openspec/governance/templates/assessment-template.md", ["## Governance metadata", "## Architectural forces", "## Candidate approaches", "## Rejected alternatives", "## Pattern invariants"]],
    ["openspec/governance/templates/adr-template.md", ["## Context", "## Decision", "## Candidate approaches considered", "## Invariants bound"]],
    ["openspec/governance/templates/signed-governance-record-template.md", ["## Binding rules", "## Record", "## What this record does not do"]],
  ];
  for (const [relativePath, headings] of templates) {
    let text;
    try {
      text = readFileSync(resolve(repositoryRoot, relativePath), "utf8");
    } catch {
      sink.fail("template-absent", relativePath, "governance template is absent");
      continue;
    }
    for (const heading of headings) {
      if (!text.includes(heading)) {
        sink.fail("template-incomplete", relativePath, `template lacks the "${heading}" section`);
      }
    }
    // The templates must speak the candidate-approach vocabulary consistently;
    // reintroducing "correspondence review" here would put the reconciled
    // single-record lifecycle back into two.
    if (/correspondence (?:review|packet|commit)/i.test(text)) {
      sink.fail("template-stale-vocabulary", relativePath,
        "template uses the superseded separate-correspondence vocabulary instead of the single signed governance record");
    }
  }
}

export function checkCiJob(repositoryRoot, policy, sink) {
  const relativePath = ".github/workflows/ci.yml";
  let text;
  try {
    text = readFileSync(resolve(repositoryRoot, relativePath), "utf8");
  } catch {
    sink.fail("governance-ci-absent", relativePath, "the CI workflow is absent");
    return;
  }
  const context = policy.protected_mainline?.required_check?.context;
  if (typeof context !== "string") return;

  if (!new RegExp(String.raw`^\s{2}${escapeRegExp(context)}:`, "m").test(text)) {
    sink.fail("governance-ci-absent", relativePath,
      `the CI workflow declares no ${context} job; removing or disabling it fails baseline verification`);
    return;
  }
  if (!text.includes("check-design-pattern-governance.mjs")) {
    sink.fail("governance-ci-does-not-run-checker", relativePath,
      `the ${context} job does not run the governance checker`);
  }
  if (!/fetch-depth:\s*0/.test(text)) {
    sink.fail("governance-ci-shallow-checkout", relativePath,
      "the governance job needs complete history; a shallow checkout cannot prove ancestry");
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
