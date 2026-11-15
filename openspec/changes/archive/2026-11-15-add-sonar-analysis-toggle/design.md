## Context

See `proposal.md`. The `sonar` job's `if:` already gates on trust: it skips for fork PRs, for
Dependabot as actor, and for Dependabot as author. `.github/scripts/sonar-trust-boundary.test.mjs`
extracts that expression from `ci.yml` and evaluates it in a `vm` context that holds only `github`.
`sonar` is no longer in branch protection's required set (#963).

## Goals / Non-Goals

**Goals:**

- Let the owner turn Sonar analysis off for a migration window without editing the workflow again.
- Make the off state render as a skip, not as red and not as green.
- Run the analysis when the variable is absent, so a lost or mistyped setting cannot silently
  disable it.

**Non-Goals:**

- Wiring SonarQube Cloud (host, token, organization or project key).
- Changing the required status checks, the merge gate or the `ci-topology` spec.
- Replacing Sonar with another analyser.

## Decisions

### A job-level skip driven by a repository variable

The condition becomes `vars.SONAR_ANALYSIS != 'disabled' && (<existing trust expression>)`. An
unset variable evaluates to an empty string, so the comparison holds and the job runs. Only the
exact value `disabled` turns analysis off.

Rejected:

- **A step that prints a notice and exits 0.** The job would go green having analysed nothing,
  which is the pass-shaped green the spec forbids.
- **`continue-on-error` on the job.** It still reports success while failing, which is the same
  defect.
- **Deleting the job for the window.** That needs two workflow changes, one out and one back, each
  governed, and it loses the history of the trust guard in between.
- **A positive opt-in (`== 'enabled'`).** An unset variable would disable analysis, so a fresh
  fork of the settings, or a deleted variable, would fail open.

### Keep the trust predicates byte-identical

The existing expression moves inside parentheses, unchanged. The trust-boundary test still finds
each predicate by exact string, and its "removing the job guard" mutation still applies.

### Test the switch through the real condition

`context()` gains a `vars` object, `{}` by default. New cases pin both directions: `disabled`
skips a `main` push and a trusted PR, and the default and other values run them. A mutation
replaces the switch predicate with `true` and shows that a disabled event then runs.

## Risks / Trade-offs

- **Re-requiring `sonar` while the variable is still `disabled`.** GitHub treats a skipped
  required check as satisfied, and so does `.github/scripts/merge-gate.mjs`
  (`PASSING_BUCKETS = ["pass", "skipping"]`). That combination would be the pass-shaped green.
  The restore order recorded on #963 is: delete the variable, see one green `sonar` run on `main`,
  and only then re-add the required context.
- **Analysis gap.** Merges that land while the variable is `disabled` get no Sonar analysis.
  #963's re-enable criteria require a retroactive analysis and triage of new findings.
- **A string-anchored test.** The test locates predicates by exact text, so a reformatted
  condition fails the test loudly rather than silently passing.

## Migration Plan

Merge the switch with the variable unset, which changes nothing. Under #963 the owner sets
`SONAR_ANALYSIS=disabled`, and later deletes it before restoring the required context. Rolling the
change back is a revert of the two owned files.
