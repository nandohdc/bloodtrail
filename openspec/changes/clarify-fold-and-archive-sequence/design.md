## Context

See proposal.md for motivation. `ownedPathsFor` in `openspec/scripts/design-pattern-governance/perimeter.mjs` deliberately narrows a relocated change to its own archive directories once relocated:

```js
if (archivedDirs) return paths;
paths.push(...(assessment?.owned_paths ?? []));
paths.push(...capabilities.map((c) => `openspec/specs/${c}/`));
```

Because pull request governance evaluates the union of paths changed across the entire commit range, combining a delta fold with an archive relocation fails closed with `[openspec-association-unrelated]`.

## Goals / Non-Goals

**Goals:**
- Clarify `CONTRIBUTING.md` line 26 so folding deltas and archiving the change are described as two distinct steps across two separate PRs.
- Add an explanatory subsection under "Archive PRs: prefer a merge commit" detailing:
  1. The two-PR sequence: fold first, archive second.
  2. The `owned_paths` rule in `assessment.json`.
  3. The idempotence verification check.

**Non-Goals:**
- Modifying `perimeter.mjs` or weakening perimeter governance rules.
- Changing OpenSpec CLI tooling.

## Decisions

### Decision 1: Codify the two-PR sequence in documentation rather than relaxing `perimeter.mjs`
- **Rationale**: The perimeter rule prevents a finished change from being reused to wave through further capability modifications. Loosening `ownedPathsFor` to permit simultaneous folds and relocations would open a loophole where canonical spec changes could slip past capability checks.
- **Alternatives considered**:
  - *Relaxing `perimeter.mjs`*: Rejected because it reduces assurance and allows a change in the process of being archived to cover arbitrary spec modifications.

### Decision 2: Update both the quick workflow list and provide deep operational guidance
- **Rationale**: Contributor guidance needs both a clear summary in the primary workflow list (line 26) and a detailed operational guide explaining why two commits in one PR fail and how to verify idempotence.

## Risks / Trade-offs

- [Risk: Contributor confusion about two separate PRs] → Mitigation: Provide clear rationale explaining the perimeter rule and why two commits within a single PR union together and fail the governance check.
