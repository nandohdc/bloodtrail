# ADR 0006: Report the inspected range on every passing perimeter run

- Status: Accepted
- Date: 2026-08-23
- Decision owners: Project owner

## Context

The design-pattern governance checker accepts an empty material range when an explicit full-SHA baseline is identical to `HEAD`. Before this decision, that branch returned with `rangeBase`, `rangeHead`, `rangeCommitCount`, and `rangePathCount` unset. The text emitter suppresses its inspected-range clause while `rangePaths` is `null`, so the success line did not reveal that no commit or path had been inspected.

An empty committed range is valid. It must not be converted into an error merely to make its state visible: branches can correctly have no committed delta at verification time. The separate working-tree fold is intentionally not changed here. A non-identical ref spelling such as `HEAD` continues through range collection and can still reject an untracked unclassified path.

## Decision

For an explicit full-SHA baseline that exactly matches resolved `HEAD` in a perimeter-bearing phase, the checker SHALL retain the successful short-circuit and set:

- `rangeBase` to the resolved `HEAD`;
- `rangeHead` to the resolved `HEAD`;
- `rangeCommitCount` to `0`; and
- `rangePathCount` to `0`.

The existing emitter then reports `inspected 0 commit(s) and 0 path(s) from <baseline>` in both text and JSON summaries. No diagnostic is added, no exit status changes, and no path is newly inspected by this decision.

## Consequences

- Passing `implementation` and `final` runs distinguish an empty range from an omitted range summary without treating a valid empty range as a failure.
- The normal non-empty and untracked-path branches retain their existing diagnostics and counts.
- The change does not authorize or introduce an SDK transport, collector, storage, telemetry, browser integration, production deployment, or real-user processing surface.

## Alternatives considered

**Drop the empty-range short-circuit and always call `collectRangePaths`.** Rejected. That would make previously successful pre-commit invocations inspect working-tree content and begin rejecting paths. It changes what the perimeter checks, outside #191's bounded objective.

**Emit a warning diagnostic for an empty range.** Rejected. A warning adds a second observable control without addressing the missing summary directly. The zero counts and named baseline provide the necessary information with a smaller, deterministic surface.

## Assurance limitations

This decision makes the uninspected range visible; it does not make a working-tree probe part of an exact-SHA empty range. The working-tree-fold behavior remains an explicit residual rather than an implied fix.
