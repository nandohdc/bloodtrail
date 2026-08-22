# ADR 0005: Classify every tracked repository path

- Status: Accepted
- Date: 2026-08-22
- Decision owners: Project owner

## Context

`classifyPath` resolves a repository path against `path_classes` in `openspec/governance/design-pattern-policy.json` by longest matching pattern; a path matching nothing is `unclassified` and fails closed. Classification is evaluated over the commit range a change touches, so a path matching no pattern is invisible until some unrelated change happens to touch it — and then fails that change for a gap it did not create.

Measured at `main@b8a54e8fe8dbdb0902f94f9f7d7d7b2addd9809d`, nine of 485 tracked paths matched no declared pattern: `.codescene/custom-quality-gates.json`, `.github/scripts/check-conventional-commits.mjs`, `.gitignore`, `.release-please-manifest.json`, `codecov.yml`, `openspec/config.yaml`, `release-please-config.json`, `sonar-project.properties`, and `version.txt`.

Only two had surfaced. Release Please rewrites `version.txt` and `.release-please-manifest.json` on every release, so release pull request #182 failed `design-pattern-governance` with `[path-unclassified]` on both, and no release could produce a landable pull request. The remaining seven were latent.

`.github/workflows/` is `governance_core` while `.github/scripts/` was unclassified, so the script implementing a required check was less protected than the workflow invoking it.

## Decision

Every tracked repository path SHALL carry a declared classification, and governance verification SHALL fail closed, naming every tracked path that matches no declared classification, independently of whether the change under verification touches it.

The nine paths are classified as follows:

| Path | Class | Rationale |
|---|---|---|
| `version.txt` | `documentation_only` | Machine-written release metadata; the `simple` release type's version file. |
| `.release-please-manifest.json` | `documentation_only` | Machine-written release state, alongside `CHANGELOG.md`. |
| `release-please-config.json` | `governance_core` | Decides how versions are computed and which commit types are released. |
| `.github/scripts/` | `governance_core` | Implements a required check. |
| `codecov.yml` | `governance_core` | Configures coverage reporting and its thresholds. |
| `sonar-project.properties` | `governance_core` | Configures the required `sonar` check, including which paths are analysed. |
| `.codescene/custom-quality-gates.json` | `governance_core` | Configures the required `codescene delta` gate's thresholds. |
| `openspec/config.yaml` | `governance_core` | OpenSpec's own configuration. |
| `.gitignore` | `governance_core` | Determines which paths are tracked, and therefore which paths any path-based gate can observe. |

Completeness SHALL be evaluated over tracked paths only, so untracked and ignored files impose no obligation. An R21 exact-change emergency classification record SHALL NOT satisfy completeness.

## Consequences

- A release pull request now passes `design-pattern-governance`. Classifying a release path grants no publication authorization; `RELEASING.md` continues to state that no package is ever published.
- **An ordinary edit to `codecov.yml`, `sonar-project.properties`, `.codescene/custom-quality-gates.json`, `openspec/config.yaml`, `release-please-config.json`, or `.gitignore` now requires the full governance-core cycle.** This is a deliberate floor: these files decide what the required checks measure and what the gates can see. It is a real ongoing cost, accepted rather than discovered later.
- Adding a new tracked path now requires classifying it in the same change. The failure is deterministic and names every uncovered path at once, so one edit resolves the whole gap.
- The checker reports `classifiedPaths` on the passing path, so a completeness run that inspected nothing is distinguishable from one that inspected the repository.
- The checker gains a `git ls-files` call in every phase, including phases that inspect no commit range.

## Alternatives considered

**An R21 emergency classification record per release.** Rejected. An emergency record binds one exact change and terminates when that change merges or is abandoned, so a file rewritten on every release would need a fresh owner-governance commit and a mandatory follow-up issue each time. That converts a bounded exception mechanism into routine process and drains its distinct warning of meaning, while leaving the other seven paths latent.

**A catch-all pattern assigning every unmatched path to a default class.** Rejected. It makes the unclassified state unreachable, converting a fail-closed default into a fail-open one: a genuinely novel path would silently inherit a default instead of demanding a decision.

**`documentation_only` for the CI configuration, to keep routine edits cheap.** Rejected. These files decide what the required checks measure; a gate whose threshold can be lowered under a benign class is a gate with a benign-class bypass.

## Assurance limitations

Completeness proves every tracked path carries a declared class. It does not prove the class assigned to each path is the correct one.

R14's scenario "Path classification is silently widened" states that baseline verification SHALL reject broadening an exempt or benign path class without acknowledgement. Moving `version.txt` and `.release-please-manifest.json` into `documentation_only` is such a broadening. Searching `openspec/scripts/` and `openspec/governance/schemas/` finds no rule implementing that scenario and no acknowledgement field, so the acknowledgement is carried procedurally by this ADR, the change's proposal, and the signed governance record — **not** mechanically by a gate. Closing that gap is tracked by [issue #203](https://github.com/nandohdc/bloodtrail/issues/203) and is not claimed here.
