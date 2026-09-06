# Archive Evidence — add-ci-coverage-for-every-package

Explicit archive validation record (R24) for the archive relocation of the `add-ci-coverage-for-every-package` change into `openspec/changes/archive/2026-09-05-add-ci-coverage-for-every-package/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24).

## Task completeness

- **1.1–1.3** (Package Discovery Completeness Assertion) — checked. Implemented `.github/scripts/check-package-discovery.mjs` asserting that `git ls-files '*package.json'` matches the 4 declared packages (`contracts/security-audit`, `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, `research/browser-telemetry`), failing closed in both directions and asserting nonzero discovery count (1.1). Created comprehensive test suite `.github/scripts/check-package-discovery.test.mjs` covering positive matches, missing package failures, phantom package failures, and count assertions (1.2). Wired discovery assertion and test suite into `.github/workflows/ci.yml` under `design-pattern-governance` job (1.3).
- **2.1–2.3** (CI Coverage for security-audit-sdk-node) — checked. Added `test:coverage` script to `packages/security-audit-sdk-node/package.json` with fail-closed thresholds (`--test-coverage-lines=80 --test-coverage-branches=25`) emitting lcov and junit results (2.1). Wired `packages/security-audit-sdk-node` into the `sdk` job across primary Node 26.5.0 leg (`npm ci`, `validate`, audit retry) and Node 24.2.0 compatibility leg (`test`) (2.2). Wired `packages/security-audit-sdk-node` into the `coverage` job with cache paths, `test:coverage`, repository-relative lcov path rewriting, artifact upload, and Codecov flags (2.3).
- **3.1–3.2** (Root Command Surface Integration) — checked. Updated root `Makefile` targets (`runtime-gates`, `governance-gates`, `sdk`) to include `packages/security-audit-sdk-node` (3.1). Verified `make test` (~26s) and `make sdk` execute successfully across all four workspaces (3.2).
- **4.1–4.3** (Verification and Governance) — checked. Executed unit tests for `check-package-discovery.test.mjs` (4.1), fast product test loop across all four workspaces via `make test` (4.2), and governance checks via `check-design-pattern-governance.mjs` and `run-governance-dual-check.mjs` (4.3). Merged in PR #338 at commit `17595f7`.
- **Canonical fold** — checked. Fold PR #339 merged canonical capability spec into `openspec/specs/ci-topology/spec.md` with updated package discovery completeness and root command surface requirements at commit `122d223` while the change was still active.
- **Archive change** — checked. Byte-preserving archive relocation commit into `openspec/changes/archive/2026-09-05-add-ci-coverage-for-every-package/`.
- Issue #85 closed upon implementation and archive completion.

## Lifecycle bindings

| Phase | PR | Merged Commit | Notes |
| --- | --- | --- | --- |
| Proposal | #336 | `9ede235` | `docs(openspec): propose add-ci-coverage-for-every-package (#85)` |
| Implementation | #338 | `17595f7` | `ci(ci): wire all packages into CI and assert discovery completeness (#85)` |
| Canonical fold | #339 | `122d223` | `docs(openspec): fold add-ci-coverage-for-every-package spec delta into ci-topology` |
| Archive | Pending PR | Pending | Byte-preserving archive relocation |

## Canonical capability materialization

`openspec/specs/ci-topology/spec.md` exists and carries both updated requirements from this change, materialized by fold PR #339 at commit `122d223`. This archive relocation commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. It does not authorize package publication, production deployment, production collection, or real-user processing.

## Immutable archive contents

Byte-identical from the active change into the archive:

- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `assessment.source.json`
- `design.md`
- `specs/ci-topology/spec.md`
- `tasks.md`

`archive-evidence.md` is added.
