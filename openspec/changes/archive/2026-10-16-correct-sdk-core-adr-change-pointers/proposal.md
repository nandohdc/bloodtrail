## Why

ADR-SDK-013 through ADR-SDK-017 still name their owning changes by former active directories. All five changes are now archived, so those directories no longer exist and the pointers do not resolve.

`packages/` is classified as `governed_implementation` in `openspec/governance/design-pattern-policy.json`. The final-phase `checkOpenSpecAssociation` in `openspec/scripts/design-pattern-governance/perimeter.mjs` requires an active change touched in the same range to declare a capability and own every edited path. The archived owning changes cannot cover this correction; this active change declares `security-audit-sdk-core` and owns the five ADR edits.

Decision source: owner request, 2026-10-16: "fix the stale \"Owning change\" pointers in ADR-013 to ADR-017" (via /plan in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E).

This is a request, not a review or an approval. AI review is not approval.

## What Changes

Repoint only line 6 of each ADR, retaining the `- Owning change:` label and backticks:

| ADR | Archived owning change directory |
| --- | --- |
| ADR-SDK-013 | `openspec/changes/archive/2026-10-13-fix-core-default-identifiers-uniqueness/` |
| ADR-SDK-014 | `openspec/changes/archive/2026-10-13-fix-core-transaction-bound-commit-state/` |
| ADR-SDK-015 | `openspec/changes/archive/2026-10-15-fix-core-provider-fault-containment/` |
| ADR-SDK-016 | `openspec/changes/archive/2026-10-15-fix-core-outcome-commit-consistency/` |
| ADR-SDK-017 | `openspec/changes/archive/2026-10-15-fix-core-configured-schema-runtime/` |

No other ADR byte changes. This pull request proposes and implements the correction; it archives nothing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This bounded documentation correction changes no requirement, API, runtime behaviour, contract or gate. `skip_specs: true` therefore opts out of spec deltas; the capability declaration in the assessment supplies path association only.

## Impact

The only files outside this change directory are:

- `packages/security-audit-sdk-core/adr/013-default-identifier-cryptographic-uniqueness.md`
- `packages/security-audit-sdk-core/adr/014-transaction-bound-commit-state-requires-operation-evidence.md`
- `packages/security-audit-sdk-core/adr/015-injected-provider-failures-are-contained.md`
- `packages/security-audit-sdk-core/adr/016-outcome-and-commit-state-agree.md`
- `packages/security-audit-sdk-core/adr/017-configured-schema-runtime-is-authoritative.md`
