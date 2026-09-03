# Archive Evidence — implement-duplicate-core-diagnostic

Explicit archive validation record (R24) for the archive relocation of the `implement-duplicate-core-diagnostic` change into `openspec/changes/archive/2026-09-03-implement-duplicate-core-diagnostic/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; `tasks.md` is the only relocated file whose bytes changed, by exactly two checkbox flips (5.1, 5.3). The exhaustive byte-change enumeration is the diff between `HEAD:openspec/changes/implement-duplicate-core-diagnostic/tasks.md` and the relocated file: line 31 (`- [ ]` → `- [x]` on 5.1) and line 33 (`- [ ]` → `- [x]` on 5.3). No task text was edited, added, or deleted; every other line is byte-identical.

## Task completeness

- **1.1** — checked in the proposal stage: proposal PR #270 (reviewed head d27a0e064cbd0ff4aba4955c6c193a8f29f7402f, review t_09a62a2c no blocking findings, 9/9 required contexts green at head) merged identity-preservingly as 29ab7e7f0f75da8cf945055069092dcc58065e4b (parents 8224850258514b64ef52ce22f29aa69701ceda51 + d27a0e064cbd0ff4aba4955c6c193a8f29f7402f).
- **2.1–2.8** — checked in the implementation stage: the RED baseline record, `src/duplicate-copy-probe.ts` with the `globalThis` copy-probe channel and its dedicated scope-gate role, the five-site shared decision helper, the `DUPLICATE_AUTHORITY` constant, the verification-fixture tightening (copy and duplicate arms on `DUPLICATE_AUTHORITY`, forged/cloned kept on `AUTHORITY_ESCALATION`), the `reviewedNewSdkSourcePaths` ownership entry, and the re-run matrix, all landed with implementation PR #272.
- **3.1–3.2** — checked in the implementation stage: the `compatibility.json` `patch[]` classification (safe diagnostic bound tightening, no version bump, #78 entry untouched) and the dated amendment to `adr/004-authority-context.md`, landed with PR #272.
- **4.1–4.5** — checked in the implementation stage: scope and compatibility gates, both full `validate` chains, `check:generated`, the Node 24/26 matrix, the lying-predicate assurance limitation, and the empty-index discipline precede the reviewed implementation commit.
- **5.1** — checked in this archive commit. The canonical fold landed as dedicated commit **60f717ca1ee0f57b283a82f0fcc19774f2c3848e** (single file `openspec/specs/security-audit-sdk-core/spec.md`, +30/−4) on branch `wt/t_a090f5d8`, PR **#280**, created while the change is active, and merged identity-preservingly as **3be942c4197323885442ee1fa4ddeaefb9b3a0dc** — which is this archive branch's base. The fold was independently reviewed by t_0d91a86f (approved, bound to 60f717ca): the two MODIFIED requirement blocks replaced with the delta versions, the new Duplicate-copy-diagnostic requirement added byte-identical to the delta, no contradictory SHALLs remain, the deferral sentences settled, and a second semantic application is a no-op. The fold commit touched no ADR, no implementation, no contract, no generated artifact, and no decision record.
- **5.2** — **UNCHECKED and intentionally so**. Substantial evidence exists: the independent technical reviews t_de3aa2a3 (CHANGES_REQUESTED at 2562789 — two blockers) followed by the corrective commit and the fresh exact-head re-review t_3a6821dd (technically_acceptable at cb04f901066627e72501f1785cd124064fee4abe, zero blocking findings, 9/9 contexts green at the head), plus the fold review t_0d91a86f (approved at 60f717ca) and the standing owner grant recorded verbatim on the #79 integrator cards (2026-09-03, conditioned on CI green, CI 9/9 green at both heads). It is left unchecked because the standing grant is explicitly conditional merge authorization, not a head-bound exact-commit decision: no project-owner exact-commit decision bound to the final normative technical head (cb04f90) was found. AI review is not approval; the reviews above are evidence, not owner decisions. This mirrors the #78 archive's treatment of its review-and-owner-decision task.
- **5.3** — checked in this archive commit. The reviewed implementation merge (84ddce7) is on main, the canonical fold (3be942c) landed while the change is active, and this archive is a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`. Proposal, assessment, design, delta, and metadata retain their historical bytes (byte identity table below).

## Merge ordering requirement (R15 window)

This archive PR is prepared from fresh origin/main at the fold merge 3be942c4197323885442ee1fa4ddeaefb9b3a0dc. The R15 critical path requires it to land back-to-back after the fold merge, with no unrelated normative merges in between. Verified at archive-prep time: live `origin/main` equals 3be942c, which is the exact fold merge, and no further merges have landed since.

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal merge (PR #270) | 29ab7e7f0f75da8cf945055069092dcc58065e4b | head d27a0e0; review t_09a62a2c no blocking findings; 9/9 required contexts green |
| Implementation merge (PR #272) | 84ddce7db58cc7d3aa6d01f8697d7e28a98f581b | 2 parents (6b94ee6 + reviewed head cb04f90); commits 069630c + cb04f90; review t_de3aa2a3 CHANGES_REQUESTED at 2562789, re-review t_3a6821dd technically_acceptable at cb04f90; admin used for the strict up-to-date branch-protection mechanic only (head behind by the deliberate #82 chain, every required check green at the exact reviewed head, rebase of the reviewed head prohibited) |
| Canonical fold (PR #280) | 3be942c4197323885442ee1fa4ddeaefb9b3a0dc | 2 parents (84ddce7 + reviewed head 60f717ca); review t_0d91a86f approved; no admin |
| Archive relocation | this commit | byte-preserving; tasks.md +2 flips only |

## Governance record status

No signed governance record exists for this change: `packages/security-audit-sdk-core/verification-lifecycle.json` carries no `implement-duplicate-core-diagnostic` entry (its signed records belong to other changes), and `openspec/governance/` holds only the activation record, schemas, and templates. R24's signed-record clauses are therefore vacuous for this change and are recorded as such here rather than constructed. The design-pattern-governance final phase is executed at this archive head; its result is recorded with the PR's check state, and no governance record is manufactured. `packages/security-audit-sdk-core/verification-lifecycle.json` is untouched by this commit.

## Canonical capability materialization

The fold merge 3be942c materializes the delta's requirements in `openspec/specs/security-audit-sdk-core/spec.md` while the change is active, per fold-before-archive policy. This archive commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. The capability re-affirms the authorization boundary: the duplicate-Core diagnostic is diagnostic-only and bounded (code/category/path, under 512 bytes, no caller data, boolean-only probe channel, impersonation boundary), cross-copy authority fails closed with `DUPLICATE_AUTHORITY` for sibling and nested duplicates, and forged/cloned values keep `AUTHORITY_ESCALATION`. It authorizes no production transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, audit-log chaining, publication, or real-user processing.

## Immutable archive contents

Byte-identical from the archive base HEAD (3be942c4197323885442ee1fa4ddeaefb9b3a0dc) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`, `created: 2026-09-03`)
- `proposal.md`
- `assessment.json`
- `design.md`
- `specs/security-audit-sdk-core/spec.md` (delta spec)

The only relocated file whose bytes changed is `tasks.md` (exactly two checkbox flips: 5.1 and 5.3). `archive-evidence.md` is new.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-03-implement-duplicate-core-diagnostic/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/security-audit-sdk-core/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/implement-duplicate-core-diagnostic/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/security-audit-sdk-core/spec.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**`, `docs/adr/**`, `packages/security-audit-sdk-core/**` (including `verification-lifecycle.json` and `compatibility.json`), and `contracts/**` are untouched by this commit.

## Byte identity table

Expected blobs are the objects at the archive base HEAD (3be942c); actual blobs are `git hash-object` of the relocated files.

| File | Expected (archive base HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | 9696e00f11eedeb87cebb23d7c3fe5c042fc309f | 9696e00f11eedeb87cebb23d7c3fe5c042fc309f | identical |
| `assessment.json` | 511b7531554686470b6b58b60aee76dc9f0f6f79 | 511b7531554686470b6b58b60aee76dc9f0f6f79 | identical |
| `design.md` | f7223c4c2ad626dbe203784c28a9c685ea2b989b | f7223c4c2ad626dbe203784c28a9c685ea2b989b | identical |
| `proposal.md` | a9e9d8a3c66040416c043c96a7843ae2a981320b | a9e9d8a3c66040416c043c96a7843ae2a981320b | identical |
| `specs/security-audit-sdk-core/spec.md` | b4f39b4e51e849b7f88150f3e9b9f5428ce447cd | b4f39b4e51e849b7f88150f3e9b9f5428ce447cd | identical |

`tasks.md` is the one relocated file whose bytes changed (HEAD blob 2d6285be4110a310b8e7e8cb5009606425fe7968 → relocated blob 78a8e5e33ddb92a95edfe047070386e542560f64): exactly two `- [ ]` → `- [x]` flips on lines 5.1 and 5.3; every other line is byte-identical (exhaustive enumeration above).

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which is what preserves the governed evidence across the move.

## Active enforcement verification

At this archive HEAD — where the change is archived, so the R15 signed-review-stale scan no longer applies to this change, and the dangling check recognizes the byte-identical relocation — the following gate set was executed before push, with an empty index:

- `openspec validate --all --strict` (active change absent; `openspec/changes/` then contains only `archive/`)
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- `node openspec/scripts/run-governance-dual-check.mjs`
- `npm run validate --prefix contracts/security-audit`
- `npm run validate --prefix packages/security-audit-sdk-core` (full 19-gate SDK chain, including `test:changed-paths` in archived mode, `test:governance-history`, `test:archive-attestations`, `test:coherence`, and the verification suite)
- Archive completeness: `git show --name-status --no-renames` shows every archive addition and active-path deletion explicitly; the active path is absent at HEAD and the dated archive is present.
- `git diff --check`; staged scope is the relocation allowlist only (both directions staged).

Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all required checks are green at the archive PR head before the owner's identity-preserving merge, and that the archive lands back-to-back after the fold merge 3be942c with no unrelated normative merge in between.

## Assurance limitations

- No project-owner exact-commit decision bound to the final normative technical head was found; the standing owner grant on the #79 integrator cards (2026-09-03, verbatim) is conditional merge authorization, not a head-bound sign-off. This evidence does not construct approval from review evidence, PR assignment, merged state, or checked tasks.
- The implementation merge used `--admin` for the strict up-to-date branch-protection mechanic only (the reviewed head was behind by the deliberate #82 chain; every required check was green at the exact reviewed head; rebasing the reviewed head is prohibited). The deviation is recorded on t_5713510c, not repaired here.
- The technical reviews (t_09a62a2c, t_de3aa2a3, t_3a6821dd, t_0d91a86f) are evidence, not approval, and are AI-assisted technical review records, not independent human assurance.
- This archive-evidence record asserts the enumerated R24 items and the relocation facts above. It is not itself approval, assurance, or authorization, and it does not substitute for the owner's merge decision.
