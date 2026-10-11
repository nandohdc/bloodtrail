# Proposal

## Why

Run-local work-item IDs such as Tamandua's `US-001` and tracker keys pass the conventional-commits check as change descriptions, so Release Please copies them into `CHANGELOG.md` as feature entries. These IDs recur every run, identify nothing across runs, and cause changelog pollution and latent version inflation; #743 remedies this backstop under parent #747.

## What Changes

- Add a single shared rejection predicate to `.github/scripts/check-conventional-commits.mjs` for PR titles and commit subjects whose descriptions open with a work-item key (`[A-Z][A-Z0-9]*-\d+`) followed by ` - ` or `:`.
- Name the offending subject in failures and explain that a work-item ID is not a change description.
- Add `.github/scripts/check-conventional-commits.test.mjs` driving the existing `--title` CLI, with valid-description regressions and a planted-defect control disabling the rejection.
- Use an abbreviated, specs-skipped change with a full governance-core assessment, separating proposal and implementation commits. Archive separately in #752.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `skip_specs: true` declares no specification delta: the release capability ratifies nothing about commit subjects, and this bounded tooling correction changes no canonical requirement.

## Impact

- `.github/scripts/check-conventional-commits.mjs`
- `.github/scripts/check-conventional-commits.test.mjs`
- `openspec/changes/work-item-key/`

Release Please configuration, manifest and release workflow remain outside scope. The v0.22.0 changelog and GitHub Release notes remain accepted as tagged; correcting the agent-run brief is separate human work.
