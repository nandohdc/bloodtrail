## Context

See proposal.md for motivation. Currently, `openspec/governance/design-pattern-policy.json` classifies `CLAUDE.md`, `AGENTS.md`, and `.hermes.md` as `governance_core`. Any touch to these files triggers the `governance_core_path` full-assessment trigger, requiring 15-dimension security justifications and candidate approach comparisons even for minor documentation edits.

## Goals / Non-Goals

**Goals:**
- Record an explicit convention in author-facing documentation (`AGENTS.md`, `CLAUDE.md`, `docs/agents/orchestration.md`, `.hermes.md`) requiring routine documentation updates to be decoupled and batched.
- Protect bounded implementation/bugfix changes from paying the ~130-line assessment penalty caused by incidental documentation edits.
- Ensure that `governance_core` paths remain strictly defended by full assessment when they are the primary subject of a change.

**Non-Goals:**
- Reclassifying `CLAUDE.md`, `AGENTS.md`, or `.hermes.md` as `documentation_only`. These files define core agent constraints and must remain `governance_core`.
- Weakening any existing governance check or reducing the required CI contexts.

## Decisions

### Decision 1: Process and convention enforcement over path reclassification
- **Decision:** Establish a strict convention that routine documentation updates to `governance_core` paths must not ride along on unrelated bounded changes, but must be batched into dedicated documentation updates.
- **Rationale:** `CLAUDE.md` and `AGENTS.md` contain critical normative guidelines for agents and humans. Downgrading them to `documentation_only` would weaken governance by allowing arbitrary changes to agent rules without full assessment. Keeping them in `governance_core` and adopting a batching discipline preserves governance rigor while unblocking velocity for bounded changes.
- **Alternatives considered:**
  - *Reclassifying `CLAUDE.md` as `documentation_only`*: Rejected because `CLAUDE.md` defines agent boundaries and required check counts; removing its governance protection is an unacceptable assurance regression.
  - *Introducing a relaxed "docs-only line exception" in the checker*: Rejected because semantic parsing of documentation diffs introduces heuristic complexity and potential evasion.

### Decision 2: Complete full assessment for this establishing change
- **Decision:** Author a full `assessment.json` for this change, matching `governance_core_path` and `canonical_capability_requirement`.
- **Rationale:** This change directly modifies `AGENTS.md`, `CLAUDE.md`, `.hermes.md`, and the `change-governance` capability. Paying the full assessment here is appropriate and acts as a one-time cost to establish the batching convention permanently.

## Risks / Trade-offs

- **[Risk]** Agents might still inadvertently touch `CLAUDE.md` during feature or bugfix tasks.
  - **Mitigation:** Document the restriction explicitly in `AGENTS.md`, `CLAUDE.md`, and `docs/agents/orchestration.md` under preflight and workflow sections that are parsed before starting work.
- **[Risk]** Documentation drift if batched updates are deferred indefinitely.
  - **Mitigation:** Dedicated periodic doc updates can be opened as small, fast-moving pull requests without coupling to large implementation efforts.
