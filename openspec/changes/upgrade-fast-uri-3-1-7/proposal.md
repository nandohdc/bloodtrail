## Why

The SDK CI job now fails its post-validation `npm audit --audit-level=low`
gate because the lockfile resolves transitive `fast-uri` 3.1.5, which is
affected by four high-severity host-confusion and SSRF advisories. The
dependency range already permits the fixed 3.1.7 release, so the repository
must refresh the locked transitive version without changing SDK behavior.

## What Changes

- Update the SDK lockfile resolution for `fast-uri` from 3.1.5 to 3.1.7.
- Keep the direct AJV and AJV Formats dependency versions unchanged.
- Verify the SDK validation chain and low-threshold audit gate pass with the
  refreshed lockfile.

## Capabilities

### New Capabilities

None. This is a transitive dependency security refresh and adds no product
behavior; the change opts out of specification deltas.

### Modified Capabilities

None. No SDK requirement, public API, validation behavior, or compatibility
contract changes.

## Impact

- `packages/security-audit-sdk-core/package-lock.json`
- `openspec/changes/upgrade-fast-uri-3-1-7/`
- The SDK CI audit gate on pull request #257

No runtime source, generated artifact, direct dependency declaration, package
API, contract, or canonical specification changes.
