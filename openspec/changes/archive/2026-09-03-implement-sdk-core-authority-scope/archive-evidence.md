# Archive Evidence — implement-sdk-core-authority-scope

Explicit archive validation record (R24) for the archive relocation of the `implement-sdk-core-authority-scope` change into `openspec/changes/archive/2026-09-03-implement-sdk-core-authority-scope/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; `tasks.md` is the only relocated file whose bytes changed, by exactly two checkbox flips (6.2, 6.4). The exhaustive byte-change enumeration is the diff between `HEAD:openspec/changes/implement-sdk-core-authority-scope/tasks.md` and the relocated file: line 40 (`- [ ]` → `- [x]` on 6.2) and line 42 (`- [ ]` → `- [x]` on 6.4). No task text was edited, added, or deleted; every other line is byte-identical.

## Task completeness

- **1.1–1.5** — checked in the implementation stage. The nine-arm RED-first authority-scope matrix (same, foreign, forged, cloned, copy, nested, concurrent, cleanup, null) was recorded and regression-guarded by the implementation PR #263 (reviewed head 94e82ae25183fe3495fd347cb0cd6b4c3bbd1e51, independent review t_bd96ac1c approved, zero blocking findings; merged identity-preservingly as 417163bd5f2d23630e7e1bdbf253c6ccc8c28edc with parents d69758bf567c8ab5ffb3f3151a08cd96fbb38d2c + 94e82ae).
- **2.1–2.6** — checked in the implementation stage: comments-only module-copy formalization in `src/context.ts`, the nine-arm matrix with per-arm null controls, the 35/19 insertion-surface enumeration, the genuine two-copy mkdtemp fixture, and the typecheck pass, all landed with PR #263 above.
- **3.1–3.4** — checked in the implementation stage: full `validate` chains, matrix runs, empty-index discipline, and the read-only readiness report precede the reviewed implementation commit.
- **4.1–4.2** — checked in the implementation stage: `compatibility.json` carries the authority-scope classification (no public API change, no runtime behavior change, no new SDK error code) with the bounded module-copy scope decision, and `test:compatibility` passes with it in place.
- **5.1** — checked: issue #79 stands as written; its distinct duplicate-Core diagnostic ownership is unchanged by this change.
- **5.2, 5.3** — **UNCHECKED and intentionally so**. These are issue-comment and issue-closure handoff tasks (comment on #83/#86 that their dependency is resolved; close issue #78 and tick it in issue #132's Wave 2 checklist). They are not archive blockers: issue #78 was still OPEN at archive-prep time, and closure/tick-off is the pipeline's post-landing handoff, not this relocation. Nothing in this archive touches them.
- **6.1** — **UNCHECKED**. Substantial evidence exists: the independent technical reviews t_bd96ac1c (approved, bound to 94e82ae) and t_c863db97 (approved, bound to the fold head 7cd48e8), plus the standing owner grant recorded on the integration card t_a7d4b87a (2026-09-02, verbatim). It is left unchecked because the standing grant is explicitly conditional merge authorization, not a head-bound exact-commit decision: no project-owner exact-commit decision bound to the final normative technical head was found. AI review is not approval; the reviews above are evidence, not owner decisions.
- **6.2** — checked in this archive commit. The canonical fold landed as dedicated commit **7cd48e80e614e3b07bc3094757d1e23457eb3c42** (single file `openspec/specs/security-audit-sdk-core/spec.md`, +56/−0) on branch `wt/t_17043dbc`, PR **#268**, created while the change is active, and merged identity-preservingly as **246ce44a5b523942c12737073feffae260fe34a8** — which is this archive branch's base. The fold was independently reviewed by t_c863db97: the canonical suffix is the delta body verbatim (sha256 79e48150…, appears once, no delta operation header), and a second semantic application is a no-op. The fold commit touched no ADR, no implementation, no contract, no generated artifact, and no decision record.
- **6.3** — **UNCHECKED**. The implementation PR #263 was merged identity-preservingly (417163bd, two parents, second parent == reviewed head 94e82ae) with all nine required CI contexts green at head, and the blocking issue #256 is CLOSED. It is left unchecked because the merge landed before the governed integration card ran (t_a0838822 observed and verified rather than executing the sanctioned merge-script path), and this archive task does not back-fill checkbox state for a merge-path deviation from substance alone — the ratify-sdk-core-authority-scope precedent applied the same treatment to its merge task.
- **6.4** — checked in this archive commit. The approved implementation merge (417163bd) is on main, the canonical fold (246ce44) landed while the change is active, and this archive is a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`. Proposal, assessment, design, delta, and metadata retain their historical bytes (byte identity table below).

## Merge ordering requirement (R15 window)

This archive PR is prepared from fresh origin/main at the fold merge 246ce44. The R15 critical path requires it to land back-to-back after the fold merge, with no unrelated normative merges in between. Verified at archive-prep time: live `origin/main` equals 246ce44, the only other open PR is #182 (chore: release v0.4.0), which the main session deliberately holds outside this window.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal merge (PR #258) | bfb7f76ec400fe40bb1dbdfa29d6689bcab3e885 | head 04c0595; 9/9 required contexts green |
| Implementation merge (PR #263) | 417163bd5f2d23630e7e1bdbf253c6ccc8c28edc | 2 parents (d69758b + reviewed head 94e82ae); review t_bd96ac1c approved |
| Evidence-correction merge (PR #266) | 71e0e8885b6656580757721c19c321ab33a8a663 | head c8547ca; design-pattern-governance PASS at head |
| Canonical fold (PR #268) | 246ce44a5b523942c12737073feffae260fe34a8 | 2 parents (71e0e88 + reviewed head 7cd48e8); review t_c863db97 approved |
| Archive relocation | this commit | byte-preserving; tasks.md +2 flips only |

## Governance record status

No signed governance record exists for this change: `packages/security-audit-sdk-core/verification-lifecycle.json` carries no `implement-sdk-core-authority-scope` entry (its seven signed records belong to other changes), and `openspec/governance/` holds only the activation record, schemas, and templates. R24's signed-record clauses are therefore vacuous for this change and are recorded as such here rather than constructed. The design-pattern-governance final phase is executed at this archive head; its result is recorded with the PR's check state, and no governance record is manufactured. `packages/security-audit-sdk-core/verification-lifecycle.json` is untouched by this commit.

## Canonical capability materialization

The fold merge 246ce44 materializes the delta's requirements in `openspec/specs/security-audit-sdk-core/spec.md` while the change is active, per fold-before-archive policy. This archive commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. The capability re-affirms the authorization boundary: authority scope is module-copy, cross-copy authority fails closed, and the future obligations owned by #79 (distinct duplicate-Core diagnostic) and #86 (single-copy Core proof) are recorded without authorizing either. It authorizes no production transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, audit-log chaining, publication, or real-user processing.

## Immutable archive contents

Byte-identical from the archive base HEAD (246ce44a5b523942c12737073feffae260fe34a8) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`, `created: 2026-09-02`)
- `proposal.md`
- `assessment.json` (assessment level full; triggers: security_sensitive_behavior, public_api)
- `design.md`
- `specs/security-audit-sdk-core/spec.md` (delta spec)

The only relocated file whose bytes changed is `tasks.md` (exactly two checkbox flips: 6.2 and 6.4). `archive-evidence.md` is new.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-03-implement-sdk-core-authority-scope/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/security-audit-sdk-core/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/implement-sdk-core-authority-scope/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/security-audit-sdk-core/spec.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**`, `docs/adr/**`, `packages/security-audit-sdk-core/**` (including `verification-lifecycle.json`), `contracts/**`, and `packages/security-audit-sdk-core/compatibility.json` are untouched by this commit.

## Byte identity table

Expected blobs are the objects at the archive base HEAD (246ce44); actual blobs are `git hash-object` of the relocated files.

| File | Expected (archive base HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | 032461ff9fabbf3f9d3ee05069937b5d3e5d2252 | 032461ff9fabbf3f9d3ee05069937b5d3e5d2252 | identical |
| `assessment.json` | 768c853c33ac59334000f10124ab61292c3e7ea0 | 768c853c33ac59334000f10124ab61292c3e7ea0 | identical |
| `design.md` | 4e657cacc8e5cb866efd4f1afba907e5c4438d95 | 4e657cacc8e5cb866efd4f1afba907e5c4438d95 | identical |
| `proposal.md` | 3dcb0490ac2cdaf0b737d3e542defc510f4bab0c | 3dcb0490ac2cdaf0b737d3e542defc510f4bab0c | identical |
| `specs/security-audit-sdk-core/spec.md` | 2f35f0a2acd6cc91b839013d4dd012bfb606f5ca | 2f35f0a2acd6cc91b839013d4dd012bfb606f5ca | identical |

`tasks.md` is the one relocated file whose bytes changed (HEAD blob 7e71d582e6a17bb07f2422b994bdd7ce3370d621 → relocated blob 8cfa6aeee3ce27833bacd8aaf4952609ce7af33c): exactly two `- [ ]` → `- [x]` flips on lines 6.2 and 6.4; every other line is byte-identical (exhaustive enumeration above).

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which is what preserves the governed evidence across the move.

## Active enforcement verification

At this archive HEAD — where the change is archived, so the R15 signed-review-stale scan no longer applies to this change, and the dangling check recognizes the byte-identical relocation — the following gate set was executed before push, with an empty index:

- `openspec validate --all --strict`
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- `node openspec/scripts/run-governance-dual-check.mjs`
- `npm run validate --prefix contracts/security-audit`
- `npm run validate --prefix packages/security-audit-sdk-core` (full 19-gate SDK chain, including `test:changed-paths` in archived mode, `test:governance-history`, `test:archive-attestations`, `test:coherence`, and the verification suite)
- Archive completeness: `git show --name-status --no-renames` shows every archive addition and active-path deletion explicitly; the active path is absent at HEAD and the dated archive is present.
- `git diff --check`; staged scope is the relocation allowlist only (both directions staged).

Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all required checks are green at the archive PR head before the owner's identity-preserving merge, and that the archive lands back-to-back after the fold merge 246ce44 with no unrelated normative merge in between.

## Assurance limitations

- No project-owner exact-commit decision bound to the final normative technical head was found; the standing owner grant on t_a7d4b87a is conditional merge authorization, not a head-bound sign-off. This evidence does not construct approval from review evidence, PR assignment, merged state, or checked tasks.
- The implementation merge landed before the governed integration card ran; the sanctioned merge-script path was not executed for it. The deviation is recorded on t_a0838822, not repaired here.
- The technical reviews (t_bd96ac1c, t_c863db97) are evidence, not approval, and are AI-assisted technical review records, not independent human assurance.
- This archive-evidence record asserts the enumerated R24 items and the relocation facts above. It is not itself approval, assurance, or authorization, and it does not substitute for the owner's merge decision.
