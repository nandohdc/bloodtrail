# Archive Evidence — ratify-sdk-core-authority-scope

Explicit archive validation record (R24) for the archive relocation of the `ratify-sdk-core-authority-scope` change into `openspec/changes/archive/2026-09-02-ratify-sdk-core-authority-scope/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; `tasks.md` is the only relocated file whose bytes changed, by exactly two checkbox flips (3.2, 4.3). The exhaustive byte-change enumeration is the diff between `HEAD:openspec/changes/ratify-sdk-core-authority-scope/tasks.md` and the relocated file: line 17 (`- [ ]` → `- [x]` on 3.2) and line 24 (`- [ ]` → `- [x]` on 4.3). No task text was edited, added, or deleted; every other line is byte-identical.

## Task completeness

- **1.1–1.3** — checked in the materialization stage. Decision-record materialization landed as content commit **3463e60bc8af90d848ccf43d265da3c82bdadd1a** (3 prose files: `docs/adr/0009-sdk-core-authority-scope.md`, this change's `tasks.md`, `packages/security-audit-sdk-core/adr/004-authority-context.md`), merged identity-preservingly as **605f22edb88c1bb6e124e83d32466aeddc3a3358** (PR #243, two parents bc3571d2 + 3463e60). Independent review t_1a1bc387 bound to the pre-rebase head fa65b28 (technically acceptable, zero blocking findings); post-hoc exact-commit re-review t_7b3fd900 bound to 3463e60 + 605f22e (approved, zero blocking findings, diff blob 745871877deab960345baf6c59c49d9b614b2471 independently reproduced). The ADR was later renumbered 0009→0010 by **5a3328a** (PR #251, content-preserving rename, reviewed by t_94984ab4) to resolve the ADR-0009 collision with the topology ADR.
- **2.1–2.4** — **UNCHECKED and intentionally so**. These are future proof obligations bound to #86's authorized Core-split work and to the #79/#86 diagnostic alignment. They are not archive blockers: the archived change keeps them pending for the future #86 implementation, exactly as the delta and the ADRs record. 2.4 is the revisit trigger for reopening the authority-scope decision; nothing in this archive touches it.
- **3.1** — checked in the proposal/materialization stage; the 15-dimension assessment and cross-artifact semantic review are recorded in `assessment.json` and were re-verified by the independent reviews above.
- **3.2** — checked in this archive commit. The canonical fold landed as dedicated commit **1d9866d91b83d64bc08904e6934a1afa658d9c54** (single file `openspec/specs/security-audit-sdk-core/spec.md`, +32 lines) on branch `wt/t_5d2c8cbb-fold`, PR **#252**, created while the change is active. The fold is an intelligent merge into existing canonical content, not a new-spec transform: the appended requirement block is byte-identical to the delta's requirement block (`tail -n +3` of the delta), the requirement heading and each of the six scenario headings occur exactly once in the canonical spec, no delta operation header appears in the canonical spec, and a second semantic application of the delta is a no-op. The fold commit touched no ADR, no implementation, no contract, no generated artifact, and no decision record. At the time this archive commit was prepared, PR #252 is OPEN; the required merge order is fold PR #252 first, this archive PR second (see "Merge ordering" below).
- **3.3** — **UNCHECKED**. The clause spans the proposal, materialization, and fold commits. Verifiable per commit class: the proposal commit is a six-file allowlist under `openspec/changes/ratify-sdk-core-authority-scope/` (merge 22035216); the materialization is exactly three prose files with diff-blob equality across the rebase (745871877d); the fold commit used an explicit one-file staged allowlist with staged/worktree blob equality (d4645db14246f00f9f7c72544f1c59873fbfada5) and no implementation/#79-diagnostic/generated/contract path. It is left unchecked because the full staged-candidate verification chain for the proposal-era commits was not re-established by this task, and this task does not back-fill checkbox state from partial evidence.
- **4.1** — **UNCHECKED**. Substantial evidence exists: independent technical reviews t_1a1bc387 (technically acceptable, bound to fa65b28) and t_7b3fd900 (approved, bound to 3463e60 + 605f22e), plus t_94984ab4 (technically acceptable, bound to the renumber commit 5a3328a), and the project owner's exact-SHA ratification of 605f22e recorded 2026-09-02 on t_44154fad. It is left unchecked because the recorded owner decision (605f22e) predates the final normative technical commit 5a3328a, which updated the change's own planning artifacts for the ADR renumber; no owner exact-commit decision bound to the final normative technical head was found. AI review is not approval; the reviews above are evidence, not owner decisions.
- **4.2** — **UNCHECKED**. The decision-record merge was identity-preserving (605f22e, two parents, tree equality 605f22e^{tree} == 3463e60^{tree} == 7137e19ae20c987ac4471c16ace7b0bb36a0a90a), the merged content is byte-identical to the reviewed content (diff blob 745871877d), and all nine required CI contexts were completed/success at the merged head 3463e60. However, the merge did not go through the repository merge process: the sanctioned script refused at gate 3b and could not run against an already-merged PR. That deviation is permanent, uncurable post-merge, and is recorded on t_44154fad; per governance policy this task is not checked from substance alone.
- **4.3** — checked in this archive commit. The approved decision-record merge (605f22e, owner-ratified by exact SHA) is on main, the canonical fold is created while the change is active (commit 1d9866d, PR #252), and this archive is a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`. Proposal, assessment, design, delta, and metadata retain their historical bytes (byte identity table below).

## Merge ordering requirement

This archive PR is prepared as a candidate from fresh origin/main, independent of the fold PR's tree. It must be merged only after fold PR #252 has merged identity-preservingly. The archive commit itself does not depend on the fold tree; the ordering preserves the repository's fold-before-archive policy (fold while active, archive afterwards).

## Lifecycle bindings

| Phase | Commit | Notes |
| --- | --- | --- |
| Proposal merge (PR #236) | 220352168a072914c61a15db8dca1762666dba43 | six-file allowlist under the change dir |
| Decision-record materialization (PR #243) | 3463e60bc8af90d848ccf43d265da3c82bdadd1a | rebased from reviewed fa65b28; diff blob 745871877d |
| Materialization merge | 605f22edb88c1bb6e124e83d32466aeddc3a3358 | 2 parents (bc3571d2 + 3463e60); owner exact-SHA ratification recorded 2026-09-02 on t_44154fad |
| ADR renumber (PR #251) | 5a3328ae2f0dc5d6e5f0ff7b405b4bfa6d3f7eda | content-preserving 0009→0010 rename; merged as e607786 |
| Canonical fold (PR #252) | 1d9866d91b83d64bc08904e6934a1afa658d9c54 | single file, +32; PR open at archive-prep time; merge must precede this archive |
| Archive relocation | this commit | byte-preserving; tasks.md +2 flips only |

No signed governance record exists for this change: `packages/security-audit-sdk-core/verification-lifecycle.json` carries no `ratify-sdk-core-authority-scope` entry (its seven signed records belong to other changes). R24's signed-record clauses are therefore vacuous for this change and are recorded as such here rather than constructed.

## Canonical capability materialization

The fold commit 1d9866d creates the requirement "Authority-brand scope and Core uniqueness are explicit" in `openspec/specs/security-audit-sdk-core/spec.md` while the change is active, per fold-before-archive policy. This archive commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. The capability re-affirms the authorization boundary: option C scopes brands to the `context.ts` module copy, cross-copy authority fails closed, and the future Core split proves single-instance resolution with a first-party-only runtime-dependency allowance. It authorizes no production transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, audit-log chaining, publication, or real-user processing.

## Immutable archive contents

Byte-identical from the archive base HEAD (e6077866696df532d83cdd1cf11fec238f9b052e) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`, `created: 2026-09-01`)
- `proposal.md`
- `assessment.json`
- `design.md`
- `specs/security-audit-sdk-core/spec.md` (delta spec)

The only relocated file whose bytes changed is `tasks.md` (exactly two checkbox flips: 3.2 and 4.3). `archive-evidence.md` is new.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-02-ratify-sdk-core-authority-scope/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/security-audit-sdk-core/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/ratify-sdk-core-authority-scope/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/security-audit-sdk-core/spec.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**`, `docs/adr/**`, `packages/security-audit-sdk-core/**`, `contracts/**`, and `packages/security-audit-sdk-core/verification-lifecycle.json` are untouched by this commit.

## Byte identity table

Expected blobs are the objects at the archive base HEAD (e607786); actual blobs are `git hash-object` of the relocated files.

| File | Expected (archive base HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | b4b3ece7847e47875ed4057814d5a8a29a121c2c | b4b3ece7847e47875ed4057814d5a8a29a121c2c | identical |
| `assessment.json` | 9c74dc9fe635821cd574eb767b549d09f90e79e2 | 9c74dc9fe635821cd574eb767b549d09f90e79e2 | identical |
| `design.md` | 027a64c9e7e476104345e5487420e48b4aef34c1 | 027a64c9e7e476104345e5487420e48b4aef34c1 | identical |
| `proposal.md` | 205a7b3e210a31499b0265da3978c7d6f5bde8d2 | 205a7b3e210a31499b0265da3978c7d6f5bde8d2 | identical |
| `specs/security-audit-sdk-core/spec.md` | 36b7f3ea66c29d595b82d62349316fe4b565018d | 36b7f3ea66c29d595b82d62349316fe4b565018d | identical |

`tasks.md` is the one relocated file whose bytes changed: exactly two `- [ ]` → `- [x]` flips on lines 3.2 and 4.3; every other line is byte-identical (exhaustive enumeration above).

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which is what preserves the governed evidence across the move.

## Active enforcement verification

At this archive HEAD — where the change is archived, so the R15 signed-review-stale scan no longer applies to this change, and the dangling check recognizes the byte-identical relocation — the following gate set was executed before push, with an empty index:

- `openspec validate --all --strict`
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- `node openspec/scripts/run-governance-dual-check.mjs`
- `npm run validate --prefix contracts/security-audit`
- `npm run validate --prefix packages/security-audit-sdk-core` (full 19-gate SDK chain, including `test:changed-paths` in archived mode, `test:governance-history`, `test:archive-attestations`, `test:coherence`, and the 248-test verification suite)
- Archive completeness: `git show --name-status --no-renames` shows every archive addition and active-path deletion explicitly; the active path is absent at HEAD and the dated archive is present.
- `git diff --check`; staged scope is the relocation allowlist only (both directions staged).

Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all required checks are green at the archive PR head before the owner's identity-preserving merge, and that the fold PR (#252) has merged first.

## Assurance limitations

- No owner exact-commit decision bound to the final normative technical head (5a3328a) was found; the recorded owner ratification names the earlier materialization merge 605f22e. This evidence does not construct approval from review evidence, PR assignment, merged state, or checked tasks.
- The decision-record merge did not go through the sanctioned merge script; the deviation is permanent and is recorded on t_44154fad, not repaired here.
- The technical reviews (t_1a1bc387, t_7b3fd900, t_94984ab4) are evidence, not approval, and are AI-assisted technical review records, not independent human assurance.
- This archive-evidence record asserts the enumerated R24 items and the relocation facts above. It is not itself approval, assurance, or authorization, and it does not substitute for the owner's merge decision.
