## Why

This change originally prepared a maintainer-authored replacement for Dependabot PR #888 under #893. Before this replacement landed, the owner merged #888 as `2ae8c925a1c2ec893ba174e2cf78678deac125d0`, including its own `fix-contract-dependabot-ci` assessment and the exact fast-uri 3.1.9 lockfile.

Rebasing this PR on current main drops the already-applied dependency commit. The remaining integration preserves the alternative proposal, assessment and verification history; it changes no dependency or runtime behavior. These records do not retroactively assess, approve or take ownership of #888's implementation.

## What Changes

- Retain this change's authored assessment and contract-reuse record for the original replacement candidate `7dc8aed1bfda8324fbf8d691fe3e4340ad3ff1ca`.
- Explain the existing owner-merged delivery and the documentation-only remainder.
- Revalidate the unchanged installed dependency and frozen contract, and require fresh exact-head review and CI for these records.

## Capabilities

### New Capabilities

None. `skip_specs: true`; no new capability or contract meaning is introduced.

### Modified Capabilities

None. No contract requirement, source, generated artifact, fixture, version or product API changes.

## Impact

- Only this OpenSpec change directory differs from current main.
- The existing contract lockfile remains byte-identical to #888 and to main, with fast-uri 3.1.9 inside AJV's existing range.
- The original assessment's lockfile ownership inventory describes the historical replacement candidate; the landed implementation retains its separate owning change from #888.
- No workflow, audit threshold, branch-protection setting, secret-access policy or frozen contract content changes.

Refs #893, #888, #894.
