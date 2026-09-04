# Design: Skip unowned CRA triggers for active changes

## Context

See `proposal.md` for motivation.
Currently, `run(opts, sink)` in `openspec/scripts/contract-reuse/check.mjs` filters range paths using `isTriggerPath(path, selectedChange)` to produce `triggeringPaths`.
`isTriggerPath` checks global trigger prefixes (`contracts/`, `packages/security-audit-sdk-core/src/generated/`, `openspec/specs/security-audit-event-contract/`) unconditionally.
`attributedToSelectedChange(context)` then invokes `attributesEveryTrigger(triggeringPaths, changes, selectedChange, sink)`.
If a trigger path is in the range (e.g. `contracts/...` modified by change A), and `check.mjs` evaluates change B, `attributesEveryTrigger` fails closed because change B does not own the path (`matches[0].id !== selectedChange`), reporting `cra-trigger-unattributable` with message `"a CRA trigger path is uniquely owned by a different active change; attribution fails closed"`.
Because CI runs `check.mjs` across every active change directory, active change B fails despite change A having valid ownership and CRA records.

## Goals / Non-Goals

**Goals:**
- Allow an evaluated change that owns none of the range's trigger paths to report an approved skip (`approved-skip`) when all trigger paths in the range are uniquely owned by other active changes.
- Ensure that unowned trigger paths (`matches.length === 0`) and ambiguously owned trigger paths (`matches.length > 1`) continue to fail closed with stable `cra-trigger-unattributable` diagnostics.
- Ensure that an evaluated change that owns trigger paths continues to require and validate a CRA record for those triggers.
- Preserve deterministic diagnostic messages and exit statuses.

**Non-Goals:**
- Changing the trigger path prefixes or supported contract definitions.
- Modifying `collectOpenSpecChanges` or perimeter resolution.
- Modifying how CI enumerates active changes in `.github/workflows/ci.yml`.

## Decisions

### Decision: Partition triggers into selected ownership and foreign ownership

In `check.mjs`:
1. Collect active changes and determine ownership for each path in `triggeringPaths`.
2. A trigger path is:
   - `selected`: `matches.length === 1 && matches[0].id === selectedChange`
   - `foreign`: `matches.length === 1 && matches[0].id !== selectedChange`
   - `unattributable`: `matches.length === 0 || matches.length > 1`
3. If any path is `unattributable`:
   - Fail closed with `cra-trigger-unattributable` using the established attribution diagnostics (`"a CRA trigger path matches no active change owned-path set..."` or `"matches more than one..."`).
4. If no path is `unattributable`:
   - If the selected change owns NO trigger paths (`selected.length === 0`) and all trigger paths are `foreign`:
     - Return `skipSummary(context)` (`approved-skip`).
   - If the selected change owns trigger paths (`selected.length > 0`):
     - Proceed to `evaluateRecord(context)` for the selected change.

**Alternatives considered:**
- *Filter `triggeringPaths` in `run()` to only paths owned by `selectedChange`:* Rejected because an unowned path in the range would be ignored and pass silently. Checking unattributable paths first guarantees fail-closed posture.
- *Modify CI to only invoke `check.mjs` for changes that touch triggers:* Rejected because CI relies on `check.mjs` being self-contained and validating the whole range per active change.

## Risks / Trade-offs

- **Risk:** An unowned trigger path is accidentally skipped if not verified first.
  - **Mitigation:** Unattributable paths (`matches.length === 0` or `matches.length > 1`) are explicitly checked and fail closed before any skip determination is made.
- **Risk:** Regression in existing tests expecting `cra-trigger-unattributable` when a different change owns the trigger.
  - **Mitigation:** Update `openspec/tests/contract-reuse/checker.test.mjs` to test the new behavior (skip when uniquely owned by another active change) while adding tests verifying that unowned and ambiguous triggers continue to fail closed.
