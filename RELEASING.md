# Releasing

Runbook for cutting a Bloodtrail release. Release Please is the primary path; the manual steps at
the end remain as a fallback for automation outages.

## What a Bloodtrail release is *not*

Read this first. A release here is narrower than the word usually implies.

- **It does not publish a package.** No workflow in this repository runs `npm publish`. Every
  workspace is `private: true`, and `packages/security-audit-sdk-core/scripts/check-package-contents.mjs`
  asserts both `private === true` and `license === "UNLICENSED"`. Flipping either fails the `sdk` job.
- **It does not lift the authorization boundary.** Cutting `vX.Y.Z` grants nothing: production
  deployment, real-user data processing, framework instrumentation, collectors, transports, queue or
  outbox infrastructure, storage, SIEM integration, and analytics all remain unauthorized. That
  boundary is enforced by `npm run test:scope --prefix packages/security-audit-sdk-core`, not by
  convention. See `README.md` and `SECURITY.md`.
- **It does not version the SDK package.** See the next section.

A tag marks a reviewed repository milestone. Nothing more.

## What the version actually versions

Release Please manages a repository-level version in `version.txt` and the matching `vX.Y.Z` tag.

It deliberately does **not** touch any `package.json`:

| Workspace | Version | Governed by |
| --- | --- | --- |
| `packages/security-audit-sdk-core` | `0.1.0` | frozen until an explicit owner release authorization; `compatibility.json` asserts this exact value and `npm run test:compatibility` fails if it desyncs |
| `contracts/security-audit` | `1.0.0` | the separate `security-audit-event-contract` governance process; a protected prefix that `test:changed-paths` refuses to write |
| `research/browser-telemetry` | `0.0.0-research` | investigation artifact, never released |

If you ever need the SDK package version to move, that is a governed change with its own owner
decision — not a side effect of a release. It must update `compatibility.json` in the same commit.

Two config values in `release-please-config.json` control where the series begins, and both matter:

- `bootstrap-sha` — the changelog starts at `f368cb49…`, the commit before release management was
  introduced. Without it Release Please walks the entire history and generates an entry for every
  Conventional Commit ever made.
- `initial-version` — pinned to `0.1.0`. Release Please treats a manifest value of `0.0.0` as *no
  prior release* and would otherwise fall back to its default first version of `1.0.0`;
  `bump-minor-pre-major` does not prevent that, because it only governs bumps *from* an existing
  `0.x` version.

## Preconditions

- [ ] CI is green on the release commit.
- [ ] The blocking Sonar quality gate passes.
- [ ] The Release Please PR is current with `main` and contains the expected `CHANGELOG.md` and
      `version.txt` updates.
- [ ] `.release-please-manifest.json` still matches the last released version before the Release PR
      is merged.
- [ ] No existing `vX.Y.Z` tag for the version being cut, locally or on `origin`.

## Version decision

During `0.x`, breaking changes ride a **minor** bump and are listed under a `Breaking` sub-heading
in the changelog.

| Change type | Bump | `0.x` example |
| --- | --- | --- |
| Backward-compatible bug fix | patch | `0.1.0` → `0.1.1` |
| New backward-compatible feature | minor | `0.1.0` → `0.2.0` |
| Breaking change | minor (`0.x` rule) | `0.1.0` → `0.2.0` |
| Breaking change (post-1.0) | major | `1.0.0` → `2.0.0` |

Commit subjects drive all of it:

| Commit signal | Release impact during `0.x` | Changelog section |
| --- | --- | --- |
| `feat:` | minor | Added |
| `fix:` | patch | Fixed |
| `perf:` | patch | Changed |
| `security:` | patch | Security |
| `docs:` | patch | Documentation |
| `feat!:` or `BREAKING CHANGE:` | minor | Breaking note |
| `build:` / `chore:` / `ci:` / `refactor:` / `revert:` / `style:` / `test:` | no visible entry | hidden |

## Release tag protection

`vX.Y.Z` tags are immutable release identifiers. Once a tag or GitHub Release is published:

- do not delete the tag;
- do not force-push, retarget, or recreate the tag;
- do not edit a GitHub Release to replace the artifact for the same version;
- ship a new version with the correction.

## Release Please credential

Release Please authenticates with the `RELEASE_PLEASE_TOKEN` repository secret — a fine-grained PAT
scoped to this repository only, with **Contents: Read and write** and **Pull requests: Read and
write**. It does **not** use `GITHUB_TOKEN`.

The reason is event suppression, not permissions: pushes and pull requests authored by
`GITHUB_TOKEN` do not trigger workflows. A Release PR opened with it receives **zero** workflow
runs, so it can never satisfy the required status checks — it could only be admin-merged
unvalidated. A PAT-authored Release PR runs the full suite.

Consequences to expect:

- The Release PR is authored by the PAT owner, not `github-actions[bot]`, so it is not
  self-approvable. Merge it with `gh pr merge --admin`, as with every PR in this repository.
- The repository setting "Allow GitHub Actions to create and approve pull requests" stays
  **disabled**. It is unnecessary with a PAT, and leaving it off keeps Actions from approving PRs.

**Rotation.** Fine-grained PATs expire. On expiry the workflow fails at the PR step with a 401/403.
Re-mint the token with the same two permissions and update the secret:

```bash
gh secret set RELEASE_PLEASE_TOKEN --repo nandohdc/bloodtrail
```

## Release Please labels

Release Please marks the Release PR `autorelease: pending` and, after the tag exists,
`autorelease: tagged`. **These labels are load-bearing, not decoration** — a *merged* Release PR is
identified solely by its label, so `skip-labeling: true` stops tags and GitHub Releases from ever
being created while each merge still bumps the manifest. Never add it.

Pre-create the labels so the PAT only needs to *apply* them (Pull requests: write) rather than
*create* them (which would need Issues: write). If they are ever deleted, restore them:

```bash
for l in "autorelease: pending" "autorelease: tagged" "autorelease: snoozed"; do
  gh label create "$l" --color ededed --description "Release Please state marker"
done
```

## Automated release steps

Release Please runs on every push to `main`. It parses Conventional Commits since the last release,
maintains a Release PR, and creates the `vX.Y.Z` tag plus GitHub Release after that PR is merged.

### 1. Merge releasable work to `main`

Use Conventional Commit subjects. The `conventional-commits` check validates the PR title and every
commit subject in the PR — see `CONTRIBUTING.md`.

### 2. Review the Release PR

Confirm that it:

- bumps only `version.txt` and `.release-please-manifest.json`;
- touches **no** `package.json` and **no** `compatibility.json`;
- moves generated release notes into the top released `CHANGELOG.md` entry;
- uses the expected `vX.Y.Z` version.

### 3. Merge the Release PR

Merge through the protected-branch flow once every required check is green. Because the PR is
authored by the `RELEASE_PLEASE_TOKEN` owner it is not self-approvable, so this is a
`gh pr merge --admin` merge. An admin merge substitutes for the approval only; it never substitutes
for the checks, which must have passed.

Do not tag manually. The next `release-please` run creates the tag and GitHub Release.

### 4. Post-release checks

- [ ] `gh release view vX.Y.Z` shows the GitHub Release.
- [ ] `git fetch --tags && git tag --list vX.Y.Z` finds the tag.
- [ ] `git show vX.Y.Z:version.txt` contains the same version.
- [ ] `git show vX.Y.Z:CHANGELOG.md` has that version as the top released entry.
- [ ] `git show vX.Y.Z:packages/security-audit-sdk-core/package.json` still reports `0.1.0` and
      `"private": true`.

### Recovery

Re-run Release Please without pushing a commit to `main`:

```bash
gh workflow run release-please.yml --ref main
```

## Manual fallback release steps

Use only if Release Please is unavailable and the release cannot wait. Prefer restoring automation
over manual tagging.

1. **Update the version.** Edit `version.txt` and the `"."` entry in `.release-please-manifest.json`
   to the same `X.Y.Z`.
2. **Update the changelog.** Insert a new `## [x.y.z] - YYYY-MM-DD` heading directly below the
   preamble, newest first, and list the changes under it. There is no `Unreleased` section to
   drain — Release Please does not maintain one.
3. **Verify.** Run the full gate chain before tagging:
   ```bash
   npm run validate --prefix packages/security-audit-sdk-core
   npm run validate --prefix contracts/security-audit
   ```
4. **Tag and release.**
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   gh release create vX.Y.Z --notes-from-tag
   ```

Record why automation was bypassed, then reconcile `.release-please-manifest.json` so the next
automated run starts from the correct baseline.
