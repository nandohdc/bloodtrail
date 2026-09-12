## Why

The client-evidence wave (#117–#131) was deferred behind a recorded 2026-07-31 project-owner outcome
of **no adoption** for browser telemetry. On 2026-09-10 the owner instructed that #96–#132 be
implemented with full authorization and delegated the decisions to Claude. Under that delegation
three records now exist, each with the provenance stated at its head:

- `decisions/117-client-evidence-purpose.md` — **GO for one purpose only, P1: interaction-scoped
  audit correlation.** A reviewer answering an audit inquiry decides which server-side events one
  client interaction caused. The record supersedes the 2026-07-31 detection-domain criteria for P1
  only, and leaves the no-adoption decision standing for detection.
- `decisions/118-success-and-stop-criteria.md` — falsifiable utility, coverage, validation, cost,
  and privacy metrics with thresholds, owners, and a baseline. It includes a utility stop that ends
  the wave if trace context alone groups interactions as well.
- `decisions/119-privacy-and-threat-review.md` — **APPROVE FOR PROPOSAL**, synthetic and non-production
  only. It is a technical review, not the qualified privacy/legal review the 2026-07-31 outcome still
  requires before any real-user use.

This change is #120: the governed capability those records permit. It is a proposal. It implements
nothing, and #121's authorization record must precede any implementation task.

## Authorization

`decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`. The
owner has not personally reviewed these records; none is an exact-commit authorization. Nothing here
authorizes production, publication, deployment, or real-user collection, and the qualified
privacy/legal review remains mandatory before any real-user use.

## What Changes

- **New capability `client-evidence`**, bounded to P1. It covers the purpose and its prohibited
  uses; the closed minimum inventory; a separate, versioned `ClientEvidenceEnvelope` v1; a browser
  package that uses Web APIs only, has no Core dependency, and neither transmits nor persists; a
  bounded `client_evidence` reference in audit contract `2.1.0` at `client_claim` trust; fail-closed
  backend ingress validation; mapping that never fabricates server evidence; a Mode A proof of
  concept judged by #118; a separate Mode B device-trust decision; and a React Native adapter.
- **One capability, separately sequenced.** Browser and React Native share the envelope and the
  purpose. React Native is sequenced after the Mode B decision (#129), because its attestation path
  depends on it, and is a Core binding where the browser package is not.
- **Task groups mirror the wave's strict order.** Planning records; owner authorization (#121); the
  correlation-field decision (#122); the envelope (#123); the browser package (#124); the audit
  contract extension (#125); ingress (#126); mapping (#127); the Mode A proof of concept (#128); the
  Mode B decision (#129) and, only if it is GO, its implementation (#130); the React Native adapter
  (#131). Fold and archive come last. Each group's implementation is its own PR against this active
  change.

## Capabilities

### New Capabilities

- `client-evidence`: bounded, low-assurance client claims for interaction-scoped audit correlation,
  with the purpose, inventory, envelope, trust, validation, mapping, and evaluation rules above.

### Modified Capabilities

- `security-audit-event-contract`: #125 adds an optional, closed `client_evidence` reference at
  `client_claim` trust in the additive contract move `2.0.0` → `2.1.0`. It carries only the v1
  interaction reference and fixed client provenance; it does not carry a raw envelope, claims,
  nonce, timestamp, transform history, or a server-owned field.

## Impact

- This proposal adds only `openspec/changes/add-client-evidence-capability/`.
- Later task groups add the new workspace `packages/client-evidence-browser/` (with its CI, `make`,
  package-discovery, coverage, and Sonar wiring), the #125 contract minor move and exact-version
  consumer projections, a collector ingress stage, and a React Native adapter workspace.

## Assurance limitations

Client evidence cannot prove that a real browser existed, that the host page told the truth, or that
the backend did not fabricate it. A valid envelope proves syntax and declared provenance only. Every
claim stays `client_claim`, and Mode A's server-issued nonce binds a claim to an interaction the
server started without making the claim true.
