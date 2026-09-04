## Context

See proposal.md for motivation. `mutations.test.mjs` invokes `git config --local --null --list` to capture repository configuration before running tests and verifies identical state in `test.after()`.

## Goals / Non-Goals

**Goals:**
- Ignore concurrent `branch.*` writes caused by `git push -u` or branch management in sibling worktrees.
- Retain strict detection of test-induced configuration mutations (e.g. `commit.gpgsign`).
- Sort parsed configuration entries deterministically.
- Document in `CLAUDE.md` the workflow guideline for pushing branches without writing upstream config.

**Non-Goals:**
- Weakening configuration assertions for any key within the test blast radius.
- Altering disposable repository fixtures or git cleanliness checks.

## Decisions

### Decision 1: Scoped exclusion of `branch.*` keys over explicit allowlist
- **Rationale**: The intent is to detect any unexpected configuration mutation leaked by the SDK test suite. An allowlist would be brittle across Git versions and user environments. Excluding only `branch.*` keys targets the exact concurrency hazard (`branch.<name>.remote` / `branch.<name>.merge`) without masking test-induced writes.
- **Alternatives considered**:
  - *Full allowlist*: Fragile; requires maintaining an exhaustive list of valid local keys.
  - *Removing `governedLocalConfig()` check*: Weakens regression protection against leaked mutations like `commit.gpgsign`.

### Decision 2: Deterministic sorting of parsed entries
- **Rationale**: `git config --null --list` output ordering can vary if keys are rewritten or added. Sorting the retained entries prior to joining ensures deterministic comparison.

## Risks / Trade-offs

- [Risk: CodeScene hotspot degradation on `mutations.test.mjs`] → Mitigation: Keep changes to `governedLocalConfig()` concise and purely functional using idiomatic array methods, adding minimal cognitive complexity.
