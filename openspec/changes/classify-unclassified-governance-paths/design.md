## Context

See `proposal.md` — Why. The mechanics that shape the approach:

`classifyPath` in `openspec/scripts/design-pattern-governance/perimeter.mjs` resolves a path against `path_classes` by longest matching pattern and returns `UNCLASSIFIED` when nothing matches; the caller fails closed. Matching is prefix-based via `matchesPattern`: a pattern ending in `/` matches a subtree, anything else matches the exact path or that path plus `/`. There are no globs — `pathProblem` rejects `*?[]{}` in a path outright, and the policy validator rejects a malformed pattern.

Classification is evaluated over the *range* paths (`collectRangePaths`), which unions every path touched across the commits between base and head, plus uncommitted and untracked work. So an unclassified path is invisible until some change touches it, and then it fails that change rather than the change that introduced it.

Measured against `main@b8a54e8fe8dbdb0902f94f9f7d7d7b2addd9809d`, replicating the policy's own `longestMatch` over `git ls-files`: 485 tracked files, of which **9** match no declared pattern.

Two facts bound the design:

- `openspec/governance/design-pattern-policy.json` is listed in `governance_core_artifacts`, so R14 applies to this change: full assessment, security-sensitive analysis, explicit reviewer acknowledgement, trusted baseline-checker validation from the merge-base baseline, and candidate-checker validation, with the candidate checker never its own judge.
- R21 already provides an exact-change emergency classification for an otherwise unclassified path. It is deliberately bounded to one change and ends when that change merges or is abandoned.

## Goals / Non-Goals

**Goals:**

- Every tracked path resolves to a declared class at the merge commit.
- The gap cannot silently reopen: a newly added unclassified path fails the change that adds it.
- The classification each path receives is defensible from what the file does, not from what is convenient for the blocked pull request.

**Non-Goals:**

- Changing any classification that already exists, or touching `governance_core_artifacts`, `normative_paths`, or `governance_record_only_paths`.
- Changing what any class *requires*. This change assigns paths to existing classes; it does not redefine the classes.
- Implementing mechanical enforcement of R14's benign-widening scenario (see Decisions, D5).
- Performing a release. Classifying a release path grants no publication authorization.

## Decisions

### D1 — Permanent patterns in `path_classes`, not an emergency record

R21's emergency record binds an exact change ID and ends when that change merges. `version.txt` and `.release-please-manifest.json` are rewritten by Release Please on *every* release, so an emergency record would have to be re-issued — with a fresh owner-governance commit and a mandatory follow-up issue — for each one. That converts a bounded exception mechanism into routine process and drains its distinct warning of meaning. Permanent classification is what a permanent file needs.

*Alternative considered:* one emergency record for PR #182 now, permanent classification later. Rejected — it pays the full governance cost twice and leaves the other seven paths latent.

### D2 — Class assignment per path

| Path | Class | Rationale |
|---|---|---|
| `version.txt` | `documentation_only` | Machine-written release metadata; the `simple` release type's version file. Carries no behaviour. |
| `.release-please-manifest.json` | `documentation_only` | Machine-written release state, `{".": "<version>"}`. Same character as `CHANGELOG.md`, already `documentation_only`. |
| `release-please-config.json` | `governance_core` | Decides how versions are computed and which commit types are released. `.github/workflows/release-please.yml` is already `governance_core` via `.github/workflows/`; its configuration should not sit below the workflow that consumes it. |
| `.github/scripts/check-conventional-commits.mjs` | `governance_core` | Implements a required check. `.github/workflows/` is `governance_core` but `.github/scripts/` is not, so the checker is currently less protected than the workflow invoking it. |
| `codecov.yml` | `governance_core` | Configures coverage reporting and its thresholds. |
| `sonar-project.properties` | `governance_core` | Configures the required `sonar` check, including which paths are analysed. |
| `.codescene/custom-quality-gates.json` | `governance_core` | Configures the required `codescene delta` gate's thresholds. |
| `openspec/config.yaml` | `governance_core` | OpenSpec's own configuration. Every sibling under `openspec/` that carries governance meaning is already `governance_core`. |
| `.gitignore` | `governance_core` | Determines which paths are tracked, and therefore which paths every path-based gate — including the completeness control added here — can observe at all. |

The policy's own `normative_path` definition already names "policy configuration … workflow, and CI" as normative, so the `governance_core` assignments follow the definition rather than extending it.

*Alternative considered:* `documentation_only` for the CI configuration, to keep routine edits cheap. Rejected — these files decide what the required checks measure. A gate whose threshold can be lowered under a benign class is a gate with a benign-class bypass.

### D3 — Completeness is checked over `git ls-files`, not the range

The existing range-based evaluation is what makes the gap latent. The completeness control asks a different question — "does the declared classification cover the repository?" — and so must read the tracked set directly rather than the change's paths. `git.mjs` already owns the repository queries, so the tracked-file enumeration belongs beside them and inherits their failure handling: an enumeration that cannot be performed fails closed, exactly as `collectRangePaths` does when `commitsBetween` returns null.

*Alternative considered:* evaluate completeness only in the final phase. Rejected — the cost is one `git ls-files` over 485 paths, and a control that runs in fewer phases is a control with more places to land an unclassified path.

### D4 — No catch-all pattern

A trailing `""` or `/` pattern would classify everything and make `UNCLASSIFIED` unreachable, converting a fail-closed default into a fail-open one. The nine paths are enumerated individually — `.github/scripts/` as a subtree pattern, since it is a directory of check scripts, and the rest as exact paths.

### D5 — The benign-class widening is acknowledged procedurally, and that is a known gap

R14's scenario says baseline verification SHALL reject broadening an exempt or benign path class without acknowledgement. Moving `version.txt` and `.release-please-manifest.json` into `documentation_only` is such a broadening.

Searching `openspec/scripts/` and `openspec/governance/schemas/` for the enforcement of that scenario returns nothing: no rule implements it, and there is no dedicated acknowledgement field. The acknowledgement is therefore carried procedurally by the signed governance record and the reviewer, not mechanically by a gate. This change acknowledges the widening explicitly in its proposal, its assessment, and the signed record — and does **not** claim a gate verified it. Closing that gap is separate work and is recorded as a follow-up rather than folded in here, because implementing an R14 rule changes what governance rejects for every future change.

## Risks / Trade-offs

- **Routine edits to CI configuration and `.gitignore` now cost a governance-core cycle.** → Accepted deliberately (D2), and stated in the proposal's Impact so it is not discovered later. R21's emergency record remains available for a genuinely urgent case. If the friction proves disproportionate in practice, the remedy is a follow-up change that revisits the assignment with evidence, not an ad-hoc downgrade.
- **The completeness control could block unrelated pull requests the moment it lands.** → The nine classifications and the control land in the same change, so completeness holds at the merge commit. A positive control asserts zero unclassified paths on the real tree.
- **The control's failure mode is a repository-wide check inside a change-scoped gate**, so a pull request can fail for a path it never touched. → That is the intended behaviour and the reason the diagnostic must name every uncovered path rather than the first one, so the fix is one edit rather than a sequence of rediscoveries.
- **`git ls-files` behaviour in CI checkouts.** → Tracked-file enumeration does not depend on history depth, so a shallow clone is unaffected; an enumeration failure fails closed rather than reporting zero paths, which would otherwise read as trivially complete.
- **Classifying a release path could be read as authorizing a release.** → It is not, and the proposal says so. A tag lifts no authorization boundary; `RELEASING.md` already states no package is ever published.

## Migration Plan

The policy patterns and the completeness control must land in the same commit — the control fails on a tree that has not yet been classified, and the classifications without the control leave the gap able to reopen.

After merge, PR #182 needs `design-pattern-governance` re-run against the updated base. No rollback beyond reverting the change is required: the control adds a check and the patterns add coverage, so reverting restores exactly the prior behaviour, including the prior blockage.

## Open Questions

- Whether `.github/scripts/` should be added to `governance_core_artifacts` and `normative_paths` as well as to `path_classes`. Those are three separate lists and this change deliberately touches only `path_classes`; widening the artifact list changes what R14 demands of future changes and deserves its own evidence. Deferrable without affecting these specs, this approach, or the task breakdown.
