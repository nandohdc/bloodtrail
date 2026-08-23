# Issue #84 — Configure Release Please for the Approved Package Model — Plan

> **For Hermes:** Blocked on #81 (release model, itself blocked on #80) and #83 (materialization). Two
> hard constraints that are easy to trip: `release-please-config.json` is **`governance_core`** since
> #202, so editing it is a full-assessment change with dual-checker validation; and **PR #182 is a live
> release PR** on `release-please--branches--main`, a branch under bot automation that must not be rebased
> or force-pushed beneath the writer. Sequence around it. The issue's fourth acceptance criterion is the
> one that matters most: the docs must state the configuration is **non-authorizing**.

**Goal:** Release Please's configuration implements the model selected in #81, validates, dry-runs without
tag collision, and preserves every package's private/unpublished status.

**Status at this baseline:** BLOCKED ON #81 → #80, and on #83.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #84, OPEN, labels `enhancement` `openspec-change-needed` `area:core` `needs-triage` |
| Declared dependencies | #81, #83 — both blocked |
| Native GitHub blockers | `blocked_by` is `0` |
| Config | `release-please-config.json` — **`governance_core`** since #202 |
| Manifest | `.release-please-manifest.json` — `documentation_only` since #202 |
| Live release PR | **#182** `chore: release v0.4.0`, branch `release-please--branches--main`, files `.release-please-manifest.json` `CHANGELOG.md` `version.txt` |
| What a release does | versions `version.txt` and creates a `vX.Y.Z` tag; **no package is published, no `package.json` version moves** |
| Packages today | all `private: true`, `UNLICENSED` |
| Publication gate | `check-publication-path.mjs` — an SDK gate whose job is to keep publication impossible |
| `release-please` check | **not required** on `main` |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — The config file's class changed under this issue's feet

Before #202, `release-please-config.json` was unclassified and any commit touching it failed
`[path-unclassified]`. Since #202 it is `governance_core` — the strictest class. So #84 went from
"impossible to commit" to "expensive to commit" without anyone editing the issue. **Re-read #84's cost
estimate with that in mind**: full assessment, security-sensitive analysis, explicit reviewer
acknowledgement, trusted-baseline validation and candidate validation.

### F2 — `.release-please-manifest.json` and the config are in different classes, and a single commit spans both

Config is `governance_core`; manifest is `documentation_only`. A commit touching both is governance-core by
the policy's own "floors not ceilings" rule. Do not expect the manifest's leniency to soften the commit.

### F3 — #182 is the sequencing constraint

Any config change while #182 is open risks a conflict on a bot-owned branch. The rule from CONTRIBUTING.md
applies: for a branch under concurrent automation, **pause the automation and rebase once idle** rather
than rewriting history beneath the other writer. Practically: land or close #182 first.

### F4 — Component tags for unpublished packages create metadata without meaning

If #81 selects per-package tags, `sdk-core-v0.1.0` would exist as a Git tag pointing at a package that
cannot be distributed. That is not harmful, but #84's own security note — "Automation cannot publish
private/unlicensed packages" — must be demonstrable, not asserted. The demonstration is
`check-publication-path.mjs` plus `private: true` plus the absence of any publish step in CI.

### F5 — The dry-run is the acceptance evidence and it must be disposable

#84's verification step is a Release Please config validation and dry-run. Run it against a **disposable
copy** of the configuration, not the live one, and never let a dry-run create a tag. Record the output.

### F6 — The most likely outcome is a no-op, and it should be checked first

If #81 ratifies repo-scoped (the recommendation in that plan), the existing configuration already
implements it and #84 closes as already-satisfied with a validation run as evidence. Check that before
designing anything.

---

## Task 0: The gate

- [ ] 0.1 **Confirm #81 is answered and #83 is complete.** If either is open, stop.
- [ ] 0.2 **Confirm #182 has landed or closed** (F3). If open, stop and say so on #84.
- [ ] 0.3 If #81 ratified repo-scoped: validate the existing config, record the dry-run, and close #84 as
      already-satisfied (F6). **Check this first.**

## Task 1: Propose

- [ ] 1.1 OpenSpec change `configure-release-please-package-model`.
- [ ] 1.2 **Full assessment** — `governance_core_path` fires via `release-please-config.json` (F1).
- [ ] 1.3 The proposal states, in one sentence: this configuration authorizes nothing.

## Task 2: Implement

- [ ] 2.1 Update `release-please-config.json` for the selected model.
- [ ] 2.2 Update `.release-please-manifest.json` entries for every governed package.
- [ ] 2.3 Configure component-tag behaviour **exactly** — naming, collision handling, and which packages
      participate. #84's criterion is "every governed package has decided behavior", so a package that is
      deliberately excluded must be named as excluded.
- [ ] 2.4 Preserve `private: true` and `UNLICENSED` on every package. Add a validation asserting it, so a
      later change cannot flip it silently.
- [ ] 2.5 Update `RELEASING.md` to state the model and that configuration is non-authorizing.

## Task 3: Prove it

- [ ] 3.1 Config validation against a **disposable** copy (F5).
- [ ] 3.2 Dry-run; assert **no tag collision** across all configured components.
- [ ] 3.3 Assert no publish step exists anywhere in CI, and that `check-publication-path.mjs` still passes.
- [ ] 3.4 Assert `private: true` on every package after the change.

## Task 4: Verify, commit, PR, close

- [ ] 4.1 Both `validate` chains; index empty; governance verified **after** the commit (#191).
- [ ] 4.2 Dual check from the merge-base — `governance_core` (F1).
- [ ] 4.3 Closing comment: the dry-run output, the collision check, and the non-authorization statement.
- [ ] 4.4 Tick #84 in #132's Wave 2 checklist.

---

## Validation matrix

| Acceptance criterion (#84) | Arm |
| --- | --- |
| Configuration validates | Task 3.1 |
| Every governed package has decided behaviour | Task 2.3, including deliberate exclusions |
| Dry-run has no tag collision | Task 3.2 |
| Docs state config is non-authorizing | Task 2.5 + closing comment |

## Risks and open questions

- **#182 colliding with the edit** (F3) is the concrete near-term hazard.
- **`governance_core` ceremony for a config file** may feel disproportionate. It is the classification
  #202 deliberately chose, on the grounds that CI and release configuration determine what the gates can
  observe. Do not relabel the path to save paperwork.
- **Open question for the owner:** should `release-please` become a required check? It is not today, so a
  broken release configuration produces no signal until someone tries to release. That is adjacent to #84
  and worth deciding alongside it.

## What this does not authorize

Merging a release, creating tags, publishing, bumping a version outside fixtures, or changing licensing.

## What this plan did not verify

Whether Release Please's dry-run can be run entirely offline against a disposable config. If it needs the
live repository, Task 3.1 needs a different mechanism.
