# Archive Evidence — fix-codecov-test-results-upload

Explicit archive validation record (R24) for the archive relocation of the `fix-codecov-test-results-upload` change into `openspec/changes/archive/2026-09-02-fix-codecov-test-results-upload/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This is a byte-preserving relocation: the exhaustive byte-change enumeration for the relocated files is **zero changes** — every relocated file is byte-identical to the object the active change path carried at the archive base HEAD (c6a4b74c2d66ac8799b923c28a84dc90d6dddf42), so Git records all five as `R100`. `tasks.md` required **zero checkbox flips**: it was already 5/5 checked at the merge commit, verified on main at c6a4b74 (tasks 1.1, 2.1, 2.2, 3.1, 3.2 all `- [x]`, zero `- [ ]`). No task text was edited, added, or deleted. `archive-evidence.md` (this file) is the only new file in the commit.

## Provenance honesty

This change was authored **outside the tracked backlog**: PR #254 arrived untracked (no owning card on either board, sim-authored) and was merged as c6a4b74c2d66ac8799b923c28a84dc90d6dddf42 with two parents (999ff4eebad3326af8bab35d83d2ede738e474f4 + 87c8e7e7b333869039588226a18276f748d8dc71). Its independent technical review is task **t_41b1058c**, bound to the reviewed head 87c8e7e7b333869039588226a18276f748d8dc71 — technically acceptable, zero findings. That review is **not approval**: AI review is not approval, and **no owner decision is bound to this change**. This archive card (t_c2e4e651) exists to close the loose end that nothing else would archive this change; it does not retroactively create an owner decision.

## Task completeness

- **1.1** — checked before this archive. The workflow correction (report_type + disable_search on the test-results invocation) is merged on main via PR #254.
- **2.1** — checked before this archive. Strict validation for the change, strict validation for all OpenSpec content, and `git diff --check` were run and passed at implementation time.
- **2.2** — checked before this archive. The trusted-baseline and candidate design-pattern governance checks were run separately for the governance-core workflow edit and both accepted.
- **3.1** — checked before this archive. The assessment was committed before the workflow implementation; the focused branch and PR head identity were verified at implementation time.
- **3.2** — checked before this archive. Live-verification evidence is recorded in the task line itself: Actions run 33650343593, job 100315849998 — no unexpected-input warning, `CC_REPORT_TYPE: test_results`, exactly two JUnit files, no LCOV file, upload queued.

No checkbox state changes in this commit. The change was fully checked on main at c6a4b74 before this archive existed; nothing here is a post-hoc task completion.

## Skip-specs proof (no canonical spec invented)

`.openspec.yaml` declares `skip_specs: true`. The status artifact graph marks `specs` as **skipped** with an empty `existingOutputPaths` list. The active change had **no `specs/` directory**, and the archive has none either. `openspec/specs/` is untouched by this commit: the canonical specs tree is `9bcd5085fc5bddb758c0b7e82d372cc5e77c7fdd` at both the archive base c6a4b74 and this archive HEAD, and no path under `openspec/specs/` appears in the working-tree diff. A skip-specs change that created a capability spec would be a defect; none was created.

## Immutable archive contents

Byte-identical from the archive base HEAD (c6a4b74c2d66ac8799b923c28a84dc90d6dddf42) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`, `created: 2026-09-02`, `skip_specs: true`)
- `assessment.json`
- `design.md`
- `proposal.md`
- `tasks.md` (5/5 checked — no flips, no edits)

`archive-evidence.md` is new. There is no delta spec and no other relocated file.

## Byte identity table

Expected blobs are the objects at the archive base HEAD (c6a4b74, path `openspec/changes/fix-codecov-test-results-upload/<file>`); actual blobs are `git hash-object` of the relocated files in the dated archive directory.

| File | Expected (archive base HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | 56d5883464a8ca2242e72cde2ee957f6f0211140 | 56d5883464a8ca2242e72cde2ee957f6f0211140 | identical |
| `assessment.json` | 4503c98739e5bf79ce480c0b3496f064b80cbea2 | 4503c98739e5bf79ce480c0b3496f064b80cbea2 | identical |
| `design.md` | d001cce99cc1e1398a04efac96bd478498d1484f | d001cce99cc1e1398a04efac96bd478498d1484f | identical |
| `proposal.md` | b37447bd50427a98ead327a0af0f484c6289087f | b37447bd50427a98ead327a0af0f484c6289087f | identical |
| `tasks.md` | 36e07d4ddb7ca84c57dfc20c52f83270f22a4c24 | 36e07d4ddb7ca84c57dfc20c52f83270f22a4c24 | identical |

Exhaustive byte-change enumeration: none of the five relocated files differs by even one byte. The only byte changes in this commit are the five path moves (five deletions from the active directory, five identical-content additions to the dated archive directory) and the one new file `archive-evidence.md`. There is no silent task-line edit, no metadata rewrite, and no checkbox flip of any kind.

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which preserves the governed evidence across the move.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-02-fix-codecov-test-results-upload/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/fix-codecov-test-results-upload/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**`, `.github/workflows/**`, `docs/adr/**`, `packages/security-audit-sdk-core/**`, `contracts/**`, and `packages/security-audit-sdk-core/verification-lifecycle.json` are untouched by this commit.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Workflow correction (PR #254) | c6a4b74c2d66ac8799b923c28a84dc90d6dddf42 | merge, 2 parents (999ff4ee + 87c8e7e7); authored outside the tracked backlog |
| Independent technical review | t_41b1058c | bound to head 87c8e7e7b333869039588226a18276f748d8dc71; technically acceptable, zero findings; evidence, not approval |
| Archive relocation | this commit | byte-preserving; zero relocated-byte changes; archive-evidence.md new |

No signed governance record exists for this change: `packages/security-audit-sdk-core/verification-lifecycle.json` carries no `fix-codecov-test-results-upload` entry, and none is constructed here. R24's signed-record clauses are vacuous for this change and are recorded as such rather than fabricated.

## Active enforcement verification

At this archive HEAD the following gate set was executed before push, with an empty index:

- `openspec validate --all --strict`
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`
- `npm run test:changed-paths --prefix packages/security-audit-sdk-core`
- `npm run test:archive-attestations --prefix packages/security-audit-sdk-core`
- `git diff --check` (plus direct final-newline and trailing-whitespace checks on the untracked archive files)
- Staging trap verification: both movement directions staged explicitly; `git diff --cached --find-renames --name-status` shows five `R100` lines plus the `A` for archive-evidence.md; `git ls-tree --name-only -d HEAD openspec/changes/` does not list the active change directory; `git show --name-status --no-renames HEAD` shows all five `D` lines and six `A` lines.

Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all nine required branch-protection contexts are present and passing at the archive PR head before the owner's identity-preserving merge.

## Assurance limitations

- This change has no owner decision bound to it. The technical review t_41b1058c is evidence, not approval, and is an AI-assisted technical review record, not independent human assurance.
- The change's provenance (untracked, sim-authored PR #254) is recorded here rather than retroactively normalized; this archive closes the ownership loose end administratively and does not manufacture governance that never occurred.
- This archive-evidence record asserts the relocation facts and the gate results above. It is not itself approval, assurance, or authorization, and it does not substitute for the owner's merge decision.
