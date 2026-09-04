## Why

A one-line documentation edit currently upgrades an otherwise bounded change to the **full** assessment path, forcing roughly 130 lines of hand-written `assessment.json` and 15 security-dimension justifications for each occurrence (#301).

`governance_core_path` is one of the eight `full_assessment_triggers` in `openspec/governance/design-pattern-policy.json`. `CLAUDE.md`, `AGENTS.md`, and `.hermes.md` are classified as `governance_core`. When a bounded change touches one of these files — even to add a single clarifying instruction or workflow hint — it matches `governance_core_path`, forfeits the abbreviated assessment path, and pays the full governance cost. Across recent changes (#290, #297), minor documentation tweaks triggered hundreds of lines of governance overhead on sub-20-line changes.

Establishing and ratifying an explicit convention to decouple and batch routine documentation edits into periodic changes prevents bounded changes from being unnecessarily upgraded to full assessments.

## What Changes

- Amend the `change-governance` capability: require routine documentation edits to `governance_core` paths (such as `CLAUDE.md`, `AGENTS.md`, and `.hermes.md`) to be decoupled and batched into periodic documentation-only changes, rather than riding along on unrelated bounded changes.
- Record the convention prominently in `AGENTS.md`, `CLAUDE.md`, and `docs/agents/orchestration.md` so that autonomous agents and human contributors read the rule before initiating or scoping changes.
- Ensure that bounded changes do not touch `governance_core` documentation paths incidentally, preserving their eligibility for the lightweight/abbreviated assessment path under R1.
- Preserve full assessment triggers when `governance_core` paths are the substance of the change (such as policy, checker, workflow, or architectural governance updates).

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `change-governance`: Adds requirement that routine `governance_core` documentation updates are decoupled from bounded changes and batched into periodic documentation changes.

## Impact

- `AGENTS.md`: Adds the documentation batching convention to Repository Guidelines and Pull Request Guidelines.
- `CLAUDE.md`: Adds instruction under Workflow warning against touching `governance_core` documentation during bounded changes and directing routine updates to batched changes.
- `docs/agents/orchestration.md`: Updates Path Classification and Pull Request Rules with explicit batching requirements.
- `.hermes.md`: Harmonizes agent instructions with the new convention.
- Governance assessment: This change touches `governance_core` paths (`AGENTS.md`, `CLAUDE.md`, `.hermes.md`) and therefore undergoes a full assessment, serving as a one-time governance cost to establish the rule.
