## ADDED Requirements

### Requirement: Routine governance-core documentation edits are decoupled and batched

Routine documentation updates to governance_core paths (including `CLAUDE.md`, `AGENTS.md`, `.hermes.md`, and `CONTRIBUTING.md`) SHALL NOT ride along with unrelated bounded implementation, verification, or bugfix changes. A bounded change that does not intend to alter governance rules, policy, or architecture SHALL NOT modify `governance_core` files merely to record incidental notes, instructions, or progress. Such documentation updates SHALL be deferred and batched into periodic documentation-only governance changes, preserving the abbreviated assessment eligibility of bounded changes.

#### Scenario: Bounded change needs documentation note
- **WHEN** a bounded change satisfies the criteria for an abbreviated assessment and an incidental documentation note is identified for a `governance_core` file
- **THEN** the documentation edit is deferred to a separate batched documentation change rather than touching the `governance_core` path, allowing the bounded change to proceed without triggering `governance_core_path`

#### Scenario: Dedicated batched documentation change lands
- **WHEN** deferred routine documentation notes are consolidated into a dedicated documentation update touching `governance_core` paths
- **THEN** the batched change completes a full assessment as a planned governance update, without bundling unrelated implementation changes

#### Scenario: Governance core path is the substance of the change
- **WHEN** a change modifies governance policies, checker scripts, or core repository workflows intentionally
- **THEN** the full assessment trigger `governance_core_path` is enforced and full assessment requirements are satisfied
