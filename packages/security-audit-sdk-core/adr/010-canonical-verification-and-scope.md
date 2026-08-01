# ADR-SDK-010: One clean repository verification entry point and exact scope boundary

## Status

Implemented for Pass 3 technical closure; governance decisions remain pending.

## Context

Separate npm scripts are useful during development but can accidentally reuse stale output, omit repository-level checks, or validate a wider change than the isolated SDK proposal authorizes. Package dry-run evidence must also be intentional rather than inferred from the `files` array alone.

## Decision

1. `npm run verify` is the canonical all-in-one repository entry point.
2. It checks prerequisites, removes `node_modules` and disposable outputs, runs exact `npm ci`, rejects pre-existing generated drift, regenerates and rechecks, then executes type/build/test/example/export/compatibility/contract/scope/dependency/audit/package/path/coherence/OpenSpec/Git checks in deterministic order.
3. The command requires a supported current Node runtime. Exact Node `24.2.0` and `26.5.0` matrix runs remain independent evidence using `npm run test:matrix` after a clean exact install.
4. Changed paths are measured from proposal commit `94dc6e3bcc74beecd1fca2832948b139167fdd3b` with rename detection disabled so both source deletion and destination addition are visible.
5. During active implementation, only `packages/security-audit-sdk-core/` and `openspec/changes/implement-security-audit-sdk-core/` are allowed.
6. After a separately authorized archive, the check may additionally infer one dated SDK archive path plus `openspec/specs/security-audit-sdk-core/`; canonical contract paths and archived contract governance remain protected in every lifecycle state.
7. A separate source/import/dependency scope check rejects production integrations inside an otherwise allowed package path.
8. `npm pack --dry-run --json` is parsed against a strict package allowlist. Source, tests, scripts, ADRs, governance, contract sources, caches, local paths, and machine-specific evidence are excluded.
9. Verification requires an empty Git index and never stages or commits.

## Consequences

- Running the canonical command is intentionally destructive to local disposable package state and may need network access for `npm ci`/audit.
- A path under the package is necessary but not sufficient: production/framework/transport/browser functionality still fails scope checks.
- Archival remains usable without weakening the active contract boundary.
- Passing does not record owner review, release approval, merge approval, archive approval, or production authorization.
