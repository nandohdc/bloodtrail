# Proposal: Exchange-outcome classification

## Why / Problem

The requirement "The HTTP audit sink and the delivery handoff share one response classification" mixes a native transport condition ("a connection failure") with outcome-level rules. A second binding implemented from the "defined once" requirement alone could classify an incomplete-body read as a malformed acknowledgment rather than a transport failure, incorrectly preventing delivery retry.

## What Changes

- Introduce a MODIFIED delta of "The HTTP audit sink and the delivery handoff share one response classification" in the `security-audit-sdk-node` capability. Replace the mixed-level list lines rather than append contradicting SHALLs; retain every existing scenario name and body.
- State classification over exchange outcomes: a response outcome is acknowledged only when its fully read body carries exactly one acknowledgment for the event with an accepted outcome; every other 2xx response outcome is a malformed acknowledgment. Keep the status rules unchanged. A timeout outcome is a timeout, and a transport-failure outcome is a transport failure. The list names no native transport condition.
- Add Exchange, Exchange outcome, and Response classification beside the sink and handoff in the Node binding glossary, with domain-only definitions and an Avoid line for each.

## What Stays

The fetch delivery adapter's requirement remains the sole owner of which native conditions become which outcome, including body-read failures. That requirement is not modified. The sink and handoff keep one shared classification, and the sink keeps its accepted/rejected/unknown mapping. No runtime source, tests, public API, version, dependencies, or observable behavior changes. The existing fetch-exchange and HTTP handoff tests remain the behavioral proof.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: restate the existing shared-response-classification requirement over exchange outcomes without changing its behavior.

## Impact

- `openspec/changes/exchange-outcome-classification/specs/security-audit-sdk-node/spec.md`: active MODIFIED delta, introduced in the implementation commit after this proposal and assessment.
- `packages/security-audit-sdk-node/CONTEXT.md`: three glossary additions.
- `openspec/specs/security-audit-sdk-node/spec.md`: eventual canonical delta target; folding is deferred to #753 and is not a write in this change.

This change addresses #750 under #747. It remains active and unfurled; no archive, package publication, deployment, or authorization decision is part of this work. Assessment and passing gates are technical evidence, not human approval.
