## Why

The required `sdk` check fails on `main` at `1961a11` and on every pull request. Its sdk-core
`npm audit --audit-level=low` step reports GHSA-333x-w4r6-6crp, a moderate advisory against
`fast-uri` 3.1.8, which the sdk-core lockfile resolves through AJV. The advisory was published on
2026-10-23, and nothing in the repository changed. `DEPENDENCIES.md` says the audit must pass and
that its findings are not waived, so the lockfile has to move to the patched release.

## What Changes

- Refresh the sdk-core lockfile's `node_modules/fast-uri` entry from 3.1.8 to 3.1.9, the first
  patched 3.x release.
- Keep every direct dependency declaration unchanged. AJV 8.20.0 already accepts `fast-uri`
  through `^3.0.1`.
- Leave the audit threshold as it is.

## Capabilities

### New Capabilities

None. This is a transitive dependency security refresh with no product behaviour, so the change
opts out of spec deltas.

### Modified Capabilities

None. No requirement, public API, validation behaviour or compatibility statement changes.

## Impact

- `packages/security-audit-sdk-core/package-lock.json`, three lines of the `fast-uri` entry.
- `fast-uri` is a development dependency. The generated schema validator loads no module at all,
  so no shipped file changes.
- `contracts/security-audit/package-lock.json` also resolves `fast-uri` 3.1.8. The `contract`
  check audits at `high`, so this moderate advisory does not fail it, and the frozen contract
  workspace is left alone.
