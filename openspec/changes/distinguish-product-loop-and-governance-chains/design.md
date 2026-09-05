## Context

See proposal.md for motivation.

Developers and autonomous agents interacting with `bloodtrail` need clear, actionable guidance on which verification commands to run during iterative coding versus prior to landing pull requests. Currently, `CLAUDE.md` and `AGENTS.md` only emphasize the full gate chains (`npm run validate --prefix packages/security-audit-sdk-core` and `npm run validate --prefix contracts/security-audit`). Because SDK `validate` takes nearly 5 minutes (~291s), contributors incur excessive wait times for routine test cycles.

In addition, ADR 0011 (`docs/adr/0011-ci-topology.md`) contains contradictory counts of required branch protection contexts: line 20 correctly cites ten contexts (including `coverage` added under #271), but downstream sections (lines 71, 77, 93, 101, 127) and the mapping table still state nine.

## Goals / Non-Goals

**Goals:**
- Present the fast product development loop (~18s across workspaces) prominently in `CLAUDE.md` and `AGENTS.md`.
- Explain that SDK `validate` is a governance-gate chain whose dominant runtime (~254s out of ~291s) is `test:verification` (mutation testing of governance mechanisms), not product test assertions.
- Retain `test:matrix`'s documented role as the matrix-safe check across Node majors.
- Provide reproducible measurements for each command.
- Make the required-context count in ADR 0011 strictly consistent (ten contexts) across all prose and mapping tables.

**Non-Goals:**
- Modifying SDK, contract, or research package code.
- Modifying GitHub Actions workflow definitions or branch protection settings.
- Removing or altering any gate in SDK `validate`.

## Decisions

### Decision 1: Two-Tier Development Verification in Developer Instructions

Rather than presenting `validate` as the default test command, instructions will structure checks into two distinct tiers:
1. **Fast product loop (~18s total)**:
   - SDK: `npm run test:matrix --prefix packages/security-audit-sdk-core` (~14.6s cold, ~9.2s warm runtime tests)
   - Contract: `npm run validate --prefix contracts/security-audit` (~1.5s)
   - Research: `npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry` (~15s)
2. **Full governance-gate chains (~291s)**:
   - SDK: `npm run validate --prefix packages/security-audit-sdk-core`
   - Contract: `npm run validate --prefix contracts/security-audit`

*Rationale*: Developers running local inner loops need fast feedback (<20s). Full mutation testing is only necessary before push or when verifying governance gates.

*Alternatives considered*:
- Creating a new script `test:fast` in SDK package.json: Rejected because `test:matrix` already executes the complete product test suite (types, runtime, examples, exports, compatibility, scope, dependencies) without repository-level mutation suites, and adding a script requires a package release/manifest edit.

### Decision 2: Disclosing the Mutation Cost of `validate`

In `CLAUDE.md` and `AGENTS.md`, annotate `validate` with measured timings explaining that ~254s of its 291s runtime is `test:verification` (mutating governance gates to ensure they fail closed).

*Rationale*: Contributors must understand that running `validate` does not test SDK features beyond what `test:matrix` tests; it tests whether the governance gates themselves resist tampering.

### Decision 3: Reconciling ADR 0011 Context Counts

Update ADR 0011 lines 71, 77, 93, 101, and 127 from "nine" to "ten", add `coverage` to the required-context mapping table, and update line 111 to record that #271 resolved the coverage question.

*Rationale*: Consistency between ADR 0011, `CLAUDE.md`, and `openspec/specs/ci-topology/spec.md` prevents miscounts and confusion during change triage and review.

## Risks / Trade-offs

- [Developers skip `validate` before pushing] → Instructions will explicitly state that `validate` should be run before pushing, and CI enforces all ten required checks on every pull request regardless.
- [Touching `governance_core` paths upgrades assessment] → Batching this clarification with the ADR 0011 fix into a single documentation change fulfills the batching rule established in #301.
