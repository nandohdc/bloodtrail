# Archive Evidence — specify-delivery-conformance-contract

Explicit archive validation record (R24) for the archive relocation of the `specify-delivery-conformance-contract` change into `openspec/changes/archive/2026-09-02-specify-delivery-conformance-contract/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; `tasks.md` is the only relocated file whose bytes changed (eight checkbox flips — 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.2 — plus one closure note under 5.1).

## Task completeness

- **Sections 1.1–1.4** were checked by the change author in the proposal commit `464fa2e9c300b56f12c89e1a7f32dbf961329ba4` (landed via PR #239, merged identity-preserving as `b45abf236ef95a2ff816a08cd61af418dedb5a6f`). The independent reviewer (task t_d08aa66b) reproduced the strict OpenSpec validation and the structural counts: 15 requirements, 21 scenarios, 21 WHEN / 21 THEN paired; contract vocabulary and postures trace verbatim to the frozen `delivery_class_contracts` rows (lines 516–557).
- **2.1** — checked in this archive commit. Proposal commit `464fa2e` on PR #239, staged scope `openspec/changes/specify-delivery-conformance-contract/**` only; merged identity-preserving as `b45abf2` (parents `f5c69f7cc08954715106b5339473ef9e421f97bf` + `464fa2e`).
- **2.2** — checked in this archive commit. All nine required checks green at head `464fa2e` (integrator t_9c6424fc metadata `required_checks_green: 9`). The design-pattern-governance red observed at the reviewed head `d2f495b` was the designed R15 fail-closed state: exactly 6 signed-review-stale diagnostics naming the six new change paths after the then-current contract-reuse-assessment signed record `591fcf9`, nothing else, documented in the PR body and reproduced by the reviewer with baseline main passing. It was cleared by the CRA archive (PR #240 → `e661d2f`), not by weakening any gate. Contract-reuse approved-skip outcome reproduced by the reviewer.
- **2.3** — checked in this archive commit. Reviewer verdict `technical_review: "approved"`, `blocking_findings: []`, bound to exact head `d2f495b` (reviewer run on t_d08aa66b). Strict branch protection (strict:true) forced a rebase onto main; content equivalence proven by diff-blob identity (`7e490af43dee18c74f9b83e14345f450973997f1` before and after the rebase). The merge ran under the project owner's explicit authorization; the integrator recorded the gate-script deviation because its `reviewed_commit == head` gate is unsatisfiable when branch protection forces the head to move. Nothing merged while a required check was pending or failing.
- **3.1** — checked in this archive commit. The fold landed as dedicated commit `bc9cf9959ce27457c230556b1a8158a37aa58402` (one file: `openspec/specs/delivery-conformance-contract/spec.md`), merged identity-preserving as `76833a20c2a675afcaadb2b0629e93a5c25e22a5` (parents `5a66806e70004fd46e7a71126f61add9f73019ae` + `bc9cf99`). No-op proof: applying the fold transform (prepend the H1 + Purpose header, rename `## ADDED Requirements` to `## Requirements`) to the relocated delta reproduces the canonical spec byte-identically (sha256 `c26c784495d2293c92db2961020eebfdca12908d64f89c3370b462fef1e7f6aa`).
- **3.2** — checked in this archive commit. PR #244 scope: exactly `openspec/specs/delivery-conformance-contract/spec.md` (integrator t_eb3fedce `pr_scope_check`); all nine required checks green at head `bc9cf99`; no `packages/*/src/`, contract source, or generated artifact changed.
- **4.1** — checked in this archive commit. The active change moved into `openspec/changes/archive/2026-09-02-specify-delivery-conformance-contract/`; byte identity table below; `openspec/specs/**` absent from the archive diff.
- **4.2** — checked in this archive commit. Strict all-change validation and the governance checker battery ran pre-push, read-only, with an empty index; archive attestations run in the PR's CI (sdk job). Archive readiness is reported in this file, separately from technical and merge readiness: the archive PR requires the standard nine green checks plus the on-card reviewer verdict bound to the exact head before the integrator's identity-preserving merge.
- **5.1** — **UNCHECKED**. No comment naming the canonical spec path exists on #103, #104, #105, #106, #107, #109, #113, or #126 (verified via GitHub API at archive time). Downstream implementation is tracked by those issues; commenting and closure remain downstream work, outside this archive's scope. The reviewer's proposal-time finding stands: the enumerated list in 5.1 omits #108 and #112, which `proposal.md` and `design.md` also name (minor, non-blocking).
- **5.2** — checked in this archive commit. Issue #102 verified state `OPEN` at archive time; this commit does not close it. Closure with chain evidence is the final orchestrator task's responsibility (t_fe06e235).

## Review and merge bindings

| Stage | Technical commit / head | Review verdict | Merge |
| --- | --- | --- | --- |
| Proposal | reviewed at `d2f495b74b9a1e6c33b1ccb04c2041b97d6d733b`; rebased head `464fa2e9c300b56f12c89e1a7f32dbf961329ba4` (diff blob `7e490af` both) | `technical_review: "approved"`, bound to `d2f495b` (t_d08aa66b) | `b45abf236ef95a2ff816a08cd61af418dedb5a6f`, identity-preserving, 2 parents |
| Fold | `bc9cf9959ce27457c230556b1a8158a37aa58402` | `technical_review: "approved"`, bound to `bc9cf99` (t_1fdd19b9) | `76833a20c2a675afcaadb2b0629e93a5c25e22a5`, identity-preserving, 2 parents |
| Archive | this archive-relocation commit | on-card reviewer verdict bound to the exact PR head (after the PR opens) | integrator via the gate script (t_11df6bee), identity-preserving merge |

No signed governance record exists for `specify-delivery-conformance-contract` (spec-only change; `verification-lifecycle.json` carries records for `implement-security-audit-sdk-core` and `remediate-security-audit-sdk-adversarial-review` only), so no record renewal is part of this relocation. At the archived head the R15 signed-review-stale scan no longer applies, and the dangling check recognizes the byte-identical relocation through `proposal.md` and `assessment.json` object identity — the same mechanism recorded by the CRA archive precedent (`2026-09-02-contract-reuse-assessment/archive-evidence.md`).

## Canonical capability materialization

`openspec/specs/delivery-conformance-contract/spec.md` exists at this archive head, created by fold commit `bc9cf99` (one file, 155 insertions) and carried unchanged through the fold merge `76833a2`. It is the canonical capability spec for the change. This archive commit does not touch `openspec/specs/**`.

## Authorization boundary

The proposal's out-of-scope statements hold: no HTTP transport, queues, collector validation, storage implementation, no exactly-once, no production deployment selection; no implementation is authorized by any merge in this chain. This archive commit touches none of those surfaces: its range is the relocation of `openspec/changes/specify-delivery-conformance-contract/` into the dated archive directory, the eight-checkbox task reconciliation plus one closure note, and this evidence file.

## Immutable archive contents

Byte-identical from main HEAD at archive time (`76833a2`) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`)
- `proposal.md`
- `assessment.json`
- `design.md`
- `specs/delivery-conformance-contract/spec.md` (delta spec)

The only relocated file whose bytes changed is `tasks.md` (eight checkbox flips plus one closure note). `archive-evidence.md` is new.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-02-specify-delivery-conformance-contract/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/delivery-conformance-contract/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/specify-delivery-conformance-contract/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/delivery-conformance-contract/spec.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**` and `packages/security-audit-sdk-core/verification-lifecycle.json` are untouched by this commit.

## Byte identity table

Expected blobs are the objects at main HEAD (`76833a2`) at the active change path; actual blobs are `git hash-object` of the relocated files.

| File | Expected (main HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | b4b3ece7847e47875ed4057814d5a8a29a121c2c | b4b3ece7847e47875ed4057814d5a8a29a121c2c | identical |
| `assessment.json` | bf196ffd915d9408c1babd5be315910650c50775 | bf196ffd915d9408c1babd5be315910650c50775 | identical |
| `design.md` | ab81dfe4c2b56ab97a74af35f11355c01bc9c466 | ab81dfe4c2b56ab97a74af35f11355c01bc9c466 | identical |
| `proposal.md` | d675916b7801badadce5cb7f13fa47997e34d62d | d675916b7801badadce5cb7f13fa47997e34d62d | identical |
| `specs/delivery-conformance-contract/spec.md` | 8ec0dd61574d050f394c93b76ea8b25557769771 | 8ec0dd61574d050f394c93b76ea8b25557769771 | identical |
| `tasks.md` | 64f28342166c1a58feb75e4a8dc1112c49a3496d | (changed) | reconciled |

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which is what preserves any governance association across the move.

## Staging-trap countermeasures (PR #185 lesson)

The archive commit must contain the move, not only the destination. Applied checks, on the staged tree before committing:

- Both directions staged explicitly: `git add -A openspec/changes/specify-delivery-conformance-contract openspec/changes/archive/2026-09-02-specify-delivery-conformance-contract`.
- `git diff --cached --name-status` shows an `A` line for every archive file and a `D` line for every active-path file (verified).
- Index-tree verification: `git write-tree` plus `git ls-tree` on that tree object confirms `openspec/changes/` contains the dated archive directory and not the active directory (verified — the index tree is the exact tree the commit carries).
- After commit: `git show --name-status --no-renames HEAD` must show a `D` line for every source file, and the diffstat must be roughly symmetric (6 additions via move + 1 new evidence file + tasks.md edit vs 6 deletions).

## Active enforcement verification

Archive occurs only after active enforcement is verified. Before staging — working tree dirty, empty index, read-only — the following gate set was executed at the archive head:

- `openspec validate --all --strict`
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- `node openspec/scripts/run-governance-dual-check.mjs --base origin/main` (baseline `76833a20c2a675afcaadb2b0629e93a5c25e22a5`; baseline and candidate both passed with identical checker blob `298613975b15`)
- `node --test openspec/tests/design-pattern-governance/*.test.mjs`
- `git diff --check`
- Trailing-whitespace / final-newline check on every new or changed file
- Staged-tree verification per the staging-trap section above

The full SDK, contract, coverage, and archive-attestation chains run in the PR's CI (sdk / contract / coverage jobs). Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all required checks are green at the archive PR head and the on-card reviewer verdict is bound to the exact head before the owner's identity-preserving merge.

## Assurance limitations

- Project-owner/implementer governance; not independent security, privacy, legal, or technical assurance.
- AI-produced analysis informed the archive construction and is not review, approval, or assurance; approval is not inferred from passing tests, checked tasks, issue state, pull-request state, or merged state.
- This archive-evidence record asserts the enumerated R24 items and the relocation facts above. It is not itself approval, assurance, or authorization, and it does not substitute for the reviewer verdict or the owner's merge decision.
