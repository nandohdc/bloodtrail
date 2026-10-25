## Context

See `proposal.md`. The contract workspace uses fast-uri through AJV as development tooling. Its lockfile is the existing frozen-contract toolchain exemption; declared contract content is still bound by SDK provenance checks. The canonical CI topology denies restricted secrets to Dependabot. The previous `upgrade-contract-fast-uri-3-1-8` change delivered the same kind of bot proposal through an assessed maintainer PR.

## Goals / Non-Goals

**Goals:** Install the exact 3.1.9 artifact proposed by #888, establish path ownership before implementation, and execute the normal required CI in a maintainer-authored PR.

**Non-Goals:** Contract semantics, generated artifacts, direct dependency declarations, workflow or secret permissions, audit thresholds, package publication and release activation.

## Decisions

### Author the assessment before the lockfile commit

Create a new full assessment and contract reuse record, then apply the exact lockfile bytes from #888. This preserves dependency intent while making the governed path attributable to this change. Adding an assessment after the bot's existing implementation commit would not satisfy ordering, and rewriting an automation-owned branch introduces concurrency with Dependabot.

### Use the existing maintainer CI context

Use a maintainer-authored replacement with the same required jobs. Retrying the bot run cannot supply missing path ownership or its unavailable Sonar credentials. Forwarding restricted secrets to Dependabot contradicts `ci-topology`; skipping or weakening required analysis would leave the merge gate unsatisfied. No workflow or secret configuration changes are needed.

### Reuse the frozen contract

The contract reuse record declares `reuse` of security-audit@2.1.0. A transitive development-tool pin introduces no event field, validation requirement, schema, registry or compatibility change. Compare declared contract content and generated artifacts against the baseline after installation.

## Risks / Trade-offs

- URI handling can affect AJV's contract tests → install with `npm ci`, run contract validation and generated-artifact checks, and prove the manifest and unrelated lockfile entries remain unchanged.
- A replacement creates another PR → link #888 and #893, preserve identical lockfile bytes, and supersede the bot proposal through the replacement's delivery record.
- Ordinary CI may still encounter infrastructure errors → report actual statuses; no skipped or absent check counts as a pass.

## Migration Plan

Land the reviewed, all-green replacement, then supersede #888. Archive this skip-specs change in a separate later PR. A rollback restores only the prior lockfile entry and does not alter frozen contract content.
