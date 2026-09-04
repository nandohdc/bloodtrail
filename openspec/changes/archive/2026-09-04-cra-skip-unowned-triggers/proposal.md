# Proposal: Skip unowned CRA triggers for active changes

## Why

In pull request CI, the `design-pattern-governance` job executes `openspec/scripts/contract-reuse/check.mjs --change <c> --base <base>` for every active OpenSpec change directory in `openspec/changes/`.
When an active change modifies `contracts/` or other shared CRA trigger paths, `check.mjs` evaluates that path against every active change. Because `isTriggerPath()` identifies trigger paths by path prefix alone, each non-owning active change encounters the trigger path and fails closed with `cra-trigger-unattributable` (`"a CRA trigger path is uniquely owned by a different active change; attribution fails closed"`).
This silently assumes only one active change exists at a time and creates mutual blocking between independent active changes (as occurred between #257 and #259, and documented in issue #260). An active change that owns none of the range's trigger paths should report an approved skip when all triggering paths are uniquely owned by other active changes.

## What Changes

- Update `openspec/scripts/contract-reuse/check.mjs` trigger attribution logic:
  - If an evaluated active change owns none of the range's trigger paths, and every trigger path in the range is uniquely owned by another active change, the checker reports an approved skip (`skipSummary`) instead of failing closed.
  - Retain fail-closed attribution when any trigger path in the range is unowned (`matches.length === 0`) or ambiguous (`matches.length > 1`).
- Update `openspec/specs/contract-reuse-assessment/spec.md` requirements and scenarios to specify that an active change owning none of the range's trigger paths reports an approved skip when all triggers are uniquely owned by other active changes.
- Update `openspec/tests/contract-reuse/checker.test.mjs` to verify that an active change owning none of the range's trigger paths reports an approved skip when another active change uniquely owns the trigger, and verify unowned/ambiguous triggers continue to fail closed.

## Capabilities

### Modified Capabilities
- `contract-reuse-assessment`: Update trigger attribution requirement so an evaluated change that owns none of the range's trigger paths reports an approved skip when all modified trigger paths are uniquely owned by other active changes.

## Impact

- Affected code: `openspec/scripts/contract-reuse/check.mjs`
- Affected tests: `openspec/tests/contract-reuse/checker.test.mjs`
- Affected specifications: `openspec/specs/contract-reuse-assessment/spec.md`
- Governance classification: `governance_core` change requiring complete governance lifecycle and review.
