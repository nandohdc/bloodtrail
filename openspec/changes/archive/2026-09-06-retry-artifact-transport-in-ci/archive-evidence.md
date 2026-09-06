# Archive Evidence — retry-artifact-transport-in-ci

Explicit archive validation record (R24) for the archive relocation of the `retry-artifact-transport-in-ci` change into `openspec/changes/archive/2026-09-06-retry-artifact-transport-in-ci/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; every relocated file retains byte identity with its pre-archive state on `main` at `dc77fa13879eb035a265e009c2605104bb551f2d`.

## Task completeness

All tasks in `tasks.md` were completed and verified during the implementation stage:

- **1.1** — Propose change `retry-artifact-transport-in-ci` with design, tasks, and full design-pattern assessment.
- **2.1** — Split the coverage upload step into a first attempt with `continue-on-error` and an outcome-gated retry after 10s.
- **2.2** — Keep `if-no-files-found: error`, the exact three-lcov `path:` list, and `overwrite: true` on both upload attempts.
- **3.1** — Split the sonar download step into a first attempt and an outcome-gated retry after 10s.
- **3.2** — Confirm the retry step carries no `continue-on-error`, so a second failure still reds the job.
- **4.1** — Assessment regeneration verified byte-identical with `--check`.
- **4.2** — `openspec validate --all --strict`: 12 passed, 0 failed.
- **4.3** — Governance checker (final phase), dual check against `ecd75e90ab0091c282561a5d01965533ec8903d8`, and contract reuse assessment all passed.
- **4.4** — `git diff --check` clean; YAML parse of the workflow verified.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal baseline | `ecd75e90ab0091c282561a5d01965533ec8903d8` | main tip at proposal time |
| Proposal | `32323d421a00c14aca3d7ecd8edbe94b8c1c170c` | `docs(openspec): propose retry-artifact-transport-in-ci (#345)` |
| Proposal repair | `f25e9996619b4eaaaa7aee6e660d107cfddb4f9d` | `fix(openspec): restore final newline on assessment source (#345)` — required-gate repair, new commit, never amended |
| Merge to main (PR #355) | `90f3c72651759229c699039321b1a24f754d328c` | identity-preserving merge, two parents, owner away-window grant |
| Implementation | `b522409a7d0f35449f12ebe30aa926edab8983f0` | `fix(ci): retry coverage artifact upload and download on transport failure (#345)` |
| Implementation repair | `0a6014bdd477776f80437eeb555f558a9e3da79b` | same newline repair applied to the implementation branch |
| Merge to main (PR #356) | `dc77fa13879eb035a265e009c2605104bb551f2d` | identity-preserving merge, two parents, owner away-window grant; all ten required contexts green |
| Archive relocation | this commit | Pure relocation to `openspec/changes/archive/2026-09-06-retry-artifact-transport-in-ci/` |

## Canonical materialization

None. The change declares no capability deltas (`skip_specs: true`), so no `openspec/specs/**` path is created or modified by this archive.

## Production / publication restrictions

The change authorizes no package publication, production deployment, production collection, real-user processing, framework integration, or delivery infrastructure. The gates that enforce those boundaries — `test:scope`, `test:publication-path`, `test:changed-paths` — are untouched by this change and by this archive.

## Immutable contents

The relocated directory carries, byte-identically to `main` at `dc77fa13879eb035a265e009c2605104bb551f2d`:

- `.openspec.yaml`
- `proposal.md`
- `design.md`
- `tasks.md`
- `assessment.source.json`
- `assessment.json`
