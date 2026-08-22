## Why

Nine tracked repository paths match no pattern in `path_classes` in `openspec/governance/design-pattern-policy.json`. An unclassified path fails closed, so any commit touching one of them is rejected with `[path-unclassified]` regardless of what it does. This is not hypothetical: release PR #182 (`chore: release v0.4.0`) is blocked right now on `version.txt` and `.release-please-manifest.json`, which Release Please rewrites on every release. The release mechanism described in `RELEASING.md` cannot produce a landable pull request until those paths are classified, and the remaining seven are latent — each one blocks the first pull request that touches it.

The policy already anticipated unclassified paths and answered them with R21's exact-change emergency record. That mechanism is correct for a genuinely novel path arriving mid-change, and wrong for permanent repository files that a release automation rewrites on a schedule: it would demand a fresh owner-governance commit and a follow-up issue for every release. These nine paths need a permanent classification, and the policy needs a control that prevents the same gap from reopening silently.

## What Changes

- Classify all nine currently unclassified tracked paths in `path_classes`:
  - `version.txt` and `.release-please-manifest.json` as `documentation_only`, joining `CHANGELOG.md`. All three are machine-written release metadata generated from Conventional Commits, carry no behaviour, and remain subject to the `hidden-implementation` scan that overrides a benign class when exported behaviour appears.
  - `release-please-config.json`, `.github/scripts/check-conventional-commits.mjs`, `codecov.yml`, `sonar-project.properties`, `.codescene/custom-quality-gates.json`, `openspec/config.yaml`, and `.gitignore` as `governance_core`. Each one configures or implements a required check, or determines which paths the gates can observe at all.
- Add a completeness control: verification fails when any tracked repository path matches no declared classification. Today the gap is invisible until a pull request happens to touch an unclassified path; the control turns a latent landmine into a deterministic failure at the point the path is introduced.
- Record the benign-class widening explicitly. R14's "Path classification is silently widened" scenario rejects broadening an exempt or benign path class without acknowledgement, and moving two paths into `documentation_only` is exactly that widening. It is acknowledged here and in the signed governance record, not slipped in.

This change does **not** alter any classification that already exists, does not touch `governance_core_artifacts`, `normative_paths`, or `governance_record_only_paths`, and does not change what any already-classified path requires.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `software-design-pattern-governance`: adds a requirement that the declared path classification is complete over the tracked repository, and that verification fails closed when it is not. The existing fail-closed treatment of an individual unclassified path (R13) stays as it is; what is new is the obligation that no such path exists in the first place, so the failure surfaces when a path is added rather than when someone eventually touches it.

## Impact

- **Policy data**: `openspec/governance/design-pattern-policy.json` gains nine patterns across two existing classes. The file is itself a `governance_core` artifact, so this change requires full assessment, security-sensitive analysis, explicit reviewer acknowledgement, trusted baseline-checker validation, and candidate-checker validation under R14. The candidate checker is not its own judge.
- **Checker**: a new completeness rule, its diagnostic, and its negative controls.
- **Releases**: PR #182 becomes mergeable on required checks once this lands. No release is performed by this change, and classifying a release path grants no publication authorization — the authorization boundary is untouched.
- **Cost, stated plainly**: classifying `.gitignore` and the CI configuration as `governance_core` means an ordinary edit to `codecov.yml` or `.gitignore` will require the full governance-core cycle. That is a deliberate trade — these files decide what the required checks measure and what the gates can see — but it is a real ongoing cost and is recorded in `design.md` rather than discovered later.
