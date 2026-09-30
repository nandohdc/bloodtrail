## Why

`contracts/security-audit/package-lock.json` resolves `fast-uri` 3.1.7 through AJV, and
GHSA-hrr3-gc8f-f4qj, a moderate advisory published on 2026-09-29, affects that release.
`upgrade-fast-uri-3-1-8` patched the sdk-core lockfile and left this one alone, because the `contract`
check audits at `high` and stays green.

Dependabot then opened #676 with the same three-line bump for the contract workspace. It fails
`design-pattern-governance` with `openspec-association-unrelated`: the lockfile is a governed
implementation path, no active change owns it, and a bot cannot author one. This change owns the bump,
so the patched release lands and the contract workspace's build toolchain carries no known advisory.

## What Changes

- Refresh the contract workspace lockfile's `node_modules/fast-uri` entry from 3.1.7 to 3.1.8.
- Keep AJV, AJV Formats and every other lockfile entry unchanged. AJV 8.20.0 already accepts `fast-uri`
  through `^3.0.1`.
- Record a contract reuse assessment. The lockfile sits under `contracts/`, so the contract reuse check
  requires one, and it classifies the change as reusing `security-audit@2.1.0` exactly.

## Capabilities

### New Capabilities

None. This is a build-toolchain dependency refresh with no contract or product behaviour, so the change
opts out of spec deltas.

### Modified Capabilities

None. No contract content, requirement, generated artifact or version changes.

## Impact

- `contracts/security-audit/package-lock.json`, three lines of the `fast-uri` entry. It is the one path
  `verification-lifecycle.json` exempts from sdk-core's frozen-contract prefix rule, and
  `contract-provenance.json` does not declare it as contract content.
- Supersedes Dependabot PR #676, which carries the identical lockfile bytes.
