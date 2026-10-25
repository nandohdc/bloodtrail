## Why

Dependabot PR #888 proposes the contract toolchain's fast-uri 3.1.8 → 3.1.9 refresh, but CI rejects the unowned governed lockfile and Sonar receives no credentials in the bot context. A maintainer-authored, assessed replacement follows the prior contract fast-uri update and preserves the repository's restriction on Dependabot access to restricted secrets.

## What Changes

- Own the contract lockfile refresh in this change before applying it, with a full assessment and a contract reuse record.
- Apply the exact `contracts/security-audit/package-lock.json` bytes proposed by #888, changing only fast-uri's version, registry URL and integrity.
- Deliver through a maintainer-authored replacement PR with the normal required CI checks; supersede #888 after the replacement lands.

## Capabilities

### New Capabilities

None. This is a transitive development-tool dependency refresh, declared `skip_specs: true`.

### Modified Capabilities

None. No contract requirement, source, generated artifact, fixture, version or product API changes.

## Impact

- `contracts/security-audit/package-lock.json` and this change directory.
- AJV's existing range already admits 3.1.9; direct dependency declarations remain unchanged.
- The contract lockfile is the existing toolchain exemption in the SDK's frozen-contract path policy; declared contract content remains immutable.
- No workflow, audit threshold, branch-protection setting or secret-access policy changes.

Refs #893, #888.
