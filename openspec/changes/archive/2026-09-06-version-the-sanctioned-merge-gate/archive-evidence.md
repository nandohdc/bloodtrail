# Archive Evidence — version-the-sanctioned-merge-gate

Explicit archive validation record (R24) for the archive relocation of the `version-the-sanctioned-merge-gate` change into `openspec/changes/archive/2026-09-06-version-the-sanctioned-merge-gate/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24).

## Task completeness

- **1.1–1.3** (Versioned Merge Gate Decision Module) — checked. `.github/scripts/merge-gate.mjs` implements pure gate functions for pull-request state (gate 1), required-context presence and passing (gate 2), review verdict bound to the exact head (gate 3), and merge method (gate 4); `.github/scripts/merge-gate.test.mjs` proves every arm against a defective input and its null control, including the PR #245 missing-context shape and the non-archive squash shape. All three subtasks complete in implementation PR #349 (content commit `31f74f3`).
- **2.1–2.2** (Versioned Operator Entry Point) — checked. `.github/scripts/merge-pr.sh` collects pull-request metadata, changed paths, required contexts, reported checks, and reviewer runs, failing closed on any unreadable source, delegates the decision to `merge-gate.mjs`, and merges only on a clean gate report with `--merge --delete-branch --match-head-commit`.
- **3.1–3.2** (Executable Gate Arms Behind a Required Check) — checked. `merge-gate.test.mjs` covers every gate arm with defective input and null control; `ci.yml`'s `design-pattern-governance` job now runs `node --test .github/scripts/*.test.mjs`, recovering the never-run `npm-audit-retry.test.mjs`. Test suite passes 39/39.
- **4.1** (Documentation) — checked. CONTRIBUTING.md corrected: `main` protection is required status checks only (`required_pull_request_reviews` null, no CODEOWNERS, `enforce_admins` false) and the sanctioned merge path through `.github/scripts/merge-pr.sh` is documented.
- **4.2–4.4** (Verification) — checked. `node --test .github/scripts/*.test.mjs` 39/39; `merge-pr.sh --dry-run` run against a live open pull request with the gate report matching its observed check state; `check-design-pattern-governance.mjs --phase assessment` and `run-governance-dual-check.mjs` both pass.
- **Canonical fold** — checked. Fold PR #352 applied the `## ADDED` delta to `openspec/specs/change-governance/spec.md` (three requirements appended verbatim) while the change was still active, at commit `1440d4a`.
- **Archive change** — checked. Byte-preserving archive relocation commit into `openspec/changes/archive/2026-09-06-version-the-sanctioned-merge-gate/`.
- Issue #246 closure is a separate reconcile step performed after archive completion.

## Lifecycle bindings

| Phase | PR | Merged Commit | Notes |
| --- | --- | --- | --- |
| Proposal | #346 | `9854c90` | `docs(openspec): propose version-the-sanctioned-merge-gate (#246)` |
| Implementation | #349 | Pending | `feat(governance): version the sanctioned merge gate (#246)` at content commit `31f74f3` |
| Canonical fold | #352 | Pending | `docs(openspec): fold version-the-sanctioned-merge-gate delta into change-governance (#246)` at content commit `1440d4a` |
| Archive | Pending PR | Pending | Byte-preserving archive relocation |

## Canonical capability materialization

The canonical capability specification carries this change's requirements, materialized by fold PR #352 at commit `1440d4a`:

- `openspec/specs/change-governance/spec.md` — three requirements added: *The sanctioned merge path is versioned and its decisions are executable*, *Required-context presence is judged against branch protection*, and *Every merged pull request preserves the commits a record may bind*.

This archive relocation commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. It does not authorize package publication, production deployment, production collection, or real-user processing.

## Immutable archive contents

Byte-identical from the active change into the archive:

- `.openspec.yaml`
- `proposal.md`
- `design.md`
- `assessment.json`
- `assessment.source.json`
- `specs/change-governance/spec.md`
- `tasks.md`

`archive-evidence.md` is added.
