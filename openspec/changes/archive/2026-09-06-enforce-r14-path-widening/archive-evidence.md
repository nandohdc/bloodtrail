# Archive Evidence — enforce-r14-path-widening

Explicit archive validation record (R24) for the archive relocation of the `enforce-r14-path-widening` change into `openspec/changes/archive/2026-09-06-enforce-r14-path-widening/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; every relocated file retains byte identity with its pre-archive state on `main` at `777150b61a6f75ff9546b324e47e73e4382d13ec`.

## Task completeness

All tasks in `tasks.md` were completed and verified during the implementation stage:

- **1.1** — Propose change `enforce-r14-path-widening` with design, tasks, and full design-pattern assessment.
- **2.1** — Add `path-widening.mjs` implementing event detection (path reclassification into `documentation_only` for paths that existed at the base; benign pattern growth matching no tracked path) and acknowledgement resolution with six distinct diagnostics.
- **2.2** — Wire the rule into `checkPerimeter` in `check-design-pattern-governance.mjs`.
- **2.3** — Verified both dual-check runs resolve the same comparison base without extra plumbing: the rule reuses the range base `checkPerimeter` already resolved.
- **3.1** — Add the widening rule, its diagnostics, and the acknowledgement field to `docs/design-pattern-governance.md`.
- **4.1** — Self-governance fixtures: unacknowledged path widening and benign pattern growth fail with `path-class-widening-unacknowledged`.
- **4.2** — Fixtures: an exactly-bound acknowledgement passes; a stale baseline, a wrong path set, a superset path set, a recorded denial, and an ambiguous record each fail with their distinct ids.
- **4.3** — Fixtures: a narrowing, a strengthening pattern addition, and a new path arriving with its benign classification do not fire the rule.
- **5.1** — Assessment regeneration verified byte-identical with `--check`.
- **5.2** — `openspec validate --all --strict`: 12 passed, 0 failed.
- **5.3** — Governance suite (231 tests), contract-reuse suite (72 tests), checker (final phase), dual check against `ecd75e90ab0091c282561a5d01965533ec8903d8`, and contract reuse assessment all passed.
- **5.4** — `git diff --check` clean; the change touches only the declared owned paths.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal baseline | `ecd75e90ab0091c282561a5d01965533ec8903d8` | main tip at proposal time |
| Proposal | `474ad8cf0a2073d397e5b8c5215b066ca03015b2` | `docs(openspec): propose enforce-r14-path-widening (#203)` |
| Merge to main (PR #357) | `8b5b875f2324b8152bac65594f2daa611847a4e8` | identity-preserving merge, two parents, owner away-window grant |
| Implementation | `b7b5473910bd8d0ea6e7cfba3993339084d3e0fa` | `feat(governance): enforce R14 path-class widening with signed-record acknowledgement (#203)` |
| Implementation repair | `b73145b2f6f0f63db5542208956fac9309c63938` | `refactor(governance): flatten widening rule into small helpers (#203)` — CodeScene delta gate repair, new commit, never amended |
| Merge to main (PR #358) | `777150b61a6f75ff9546b324e47e73e4382d13ec` | identity-preserving merge, two parents, owner away-window grant; all ten required contexts green |
| Archive relocation | this commit | Pure relocation to `openspec/changes/archive/2026-09-06-enforce-r14-path-widening/` |

## Canonical materialization

None. The change declares no capability deltas (`skip_specs: true`): the R14 scenario it implements was already specified in `openspec/specs/software-design-pattern-governance/spec.md`, and no `openspec/specs/**` path is created or modified by this change or by this archive.

## Production / publication restrictions

The change authorizes no package publication, production deployment, production collection, real-user processing, framework integration, or delivery infrastructure. The gates that enforce those boundaries — `test:scope`, `test:publication-path`, `test:changed-paths` — are untouched by this change and by this archive.

## Immutable contents

The relocated directory carries, byte-identically to `main` at `777150b61a6f75ff9546b324e47e73e4382d13ec`:

- `.openspec.yaml`
- `proposal.md`
- `design.md`
- `tasks.md`
- `assessment.source.json`
- `assessment.json`
