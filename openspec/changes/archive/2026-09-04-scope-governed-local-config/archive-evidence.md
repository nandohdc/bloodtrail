# Archive Evidence — scope-governed-local-config

Explicit archive validation record (R24) for the archive relocation of the `scope-governed-local-config` change into `openspec/changes/archive/2026-09-04-scope-governed-local-config/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; every relocated file retains byte identity with its pre-archive state on `main` at `5595d8d`.

## Task completeness

All tasks in `tasks.md` were completed and verified during the implementation stage:
- **1.1** — Create OpenSpec change `scope-governed-local-config` with proposal, design, and tasks.
- **1.2** — Formulate design-pattern governance assessment for `scope-governed-local-config`.
- **2.1** — Update `governedLocalConfig()` in `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` to filter `branch.*` entries and sort deterministically.
- **2.2** — Add unit test in `mutations.test.mjs` verifying that `governedLocalConfig()` ignores concurrent branch configuration keys.
- **2.3** — Update `CLAUDE.md` with guidelines on pushing branches without `-u` from the primary checkout.
- **3.1** — Validate OpenSpec changes with `npx --yes @fission-ai/openspec@latest validate --all --strict`.
- **3.2** — Run SDK verification tests and full validation via `npm run validate --prefix packages/security-audit-sdk-core`.
- **3.3** — Run design-pattern governance checker and verify zero policy violations.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal baseline | `c28c30c` | `docs(openspec): plan scoped governed local config assertion (#265)` |
| Governance assessment | `e0b6c72` | `docs(governance): assess scoped governed local config assertion (#265)` |
| Implementation | `548b235` | `fix(sdk): scope governed local config assertions to exclude concurrent branch keys (#265)` |
| Merge to main (PR #290) | `5595d8d` | Merged with all 9 required checks green |
| Archive relocation | this commit | Pure relocation to `openspec/changes/archive/2026-09-04-scope-governed-local-config/` |

## Canonical capability materialization

The change declared `skip_specs: true` in `.openspec.yaml` (no delta specs introduced; change modified internal SDK verification test assertions and developer workflow documentation only). Therefore, no delta fold was required before archiving.

## Governance record status

Touching `CLAUDE.md` and `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` was assessed under the full design-pattern assessment model. The complete 15-dimension assessment was committed at `e0b6c72`. All governance validations succeeded.

## Immutable archive contents

Byte-identical from the archive base HEAD (`5595d8d`) into the archive:
- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `design.md`
- `tasks.md`

`archive-evidence.md` is new.
