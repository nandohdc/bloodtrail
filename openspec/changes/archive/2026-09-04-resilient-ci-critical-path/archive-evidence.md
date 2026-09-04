# Archive Evidence — resilient-ci-critical-path

Explicit archive validation record (R24) for the archive relocation of the `resilient-ci-critical-path` change into `openspec/changes/archive/2026-09-04-resilient-ci-critical-path/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; every relocated file retains byte identity with its pre-archive state on `main` at `d4de8a0c20a4b7f5da8e9b8849bbf255b6df9127`.

## Task completeness

All tasks in `tasks.md` were completed and verified during the implementation stage:
- **1.1** — Propose change `resilient-ci-critical-path` with design, tasks, and full design-pattern assessment.
- **2.1** — Write unit tests in `.github/scripts/npm-audit-retry.test.mjs` verifying transport classification, recovery retry, and the null control.
- **2.2** — Implement `.github/scripts/npm-audit-retry.mjs` to satisfy the tests with bounded retries and fast timeouts.
- **2.3** — Run test suite via `node --test .github/scripts/npm-audit-retry.test.mjs` and verify all cases pass.
- **3.1** — Update `.github/workflows/ci.yml` so that `sonar` depends strictly on `[coverage]`.
- **3.2** — Update `sdk` and `contract` audit steps in `.github/workflows/ci.yml` to use `.github/scripts/npm-audit-retry.mjs`.
- **4.1** — Validate OpenSpec changes with `npx --yes @fission-ai/openspec@latest validate --all --strict`.
- **4.2** — Run design-pattern governance checker and dual-check against baseline.
- **4.3** — Run `git diff --check` and workspace validations.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal baseline | `d0e9e7d` | `docs(openspec): plan resilient CI critical path and audit transport` |
| Governance assessment | `f3984a7` | `docs(governance): assess resilient CI critical path and audit transport` |
| Implementation | `304fefb` | `fix(ci): optimize critical path and retry audit transport` |
| Review remediation | `f88932e` | `fix(ci): address code review feedback on audit transport retry (#286)` |
| Test deduplication | `512d316` | `refactor(ci): deduplicate test fixtures in audit retry test` |
| Merge to main (PR #288) | `d4de8a0` | Merged with all 9 required checks green (ci/lint, ci/test, ci/audit, sonar, sdk, contract, conventional-commits, codescene delta, design-pattern-governance) |
| Archive relocation | this commit | Pure relocation to `openspec/changes/archive/2026-09-04-resilient-ci-critical-path/` |

## Canonical capability materialization

The change declared `skip_specs: true` in `.openspec.yaml` (no delta specs introduced; change modified internal CI execution ordering and transport resilience scripts only). Therefore, no delta fold was required before archiving.

## Governance record status

Touching `.github/workflows/ci.yml` and `.github/scripts/npm-audit-retry.*` triggered full design-pattern assessment under `governance_core_path` policy. The complete 15-dimension assessment was committed at `f3984a7` (descendant of proposal commit `d0e9e7d` and ancestor of implementation commits). All dual-check and governance validations succeeded.

## Immutable archive contents

Byte-identical from the archive base HEAD (`d4de8a0c20a4b7f5da8e9b8849bbf255b6df9127`) into the archive:
- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `design.md`
- `tasks.md`

`archive-evidence.md` is new.
