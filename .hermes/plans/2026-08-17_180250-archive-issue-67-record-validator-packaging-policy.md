# Issue #67 Archive Cycle — record-validator-packaging-policy Implementation Plan

> **For Hermes:** Execute task-by-task per the governed archive recipe
> (`bloodtrail-governance-machinery` → references/archive-under-active-enforcement.md);
> no TDD (no code changes — this is a governed relocation + evidence documentation).

**Goal:** Archive the landed `record-validator-packaging-policy` change (R24-mandated), completing #67's remaining criteria, and stop.

**Architecture:** A pure `git mv` relocation of the change into `openspec/changes/archive/2026-08-17-record-validator-packaging-policy/`, final task reconciliation inside the moved dir only, an `archive-evidence.md` discharging R24, full read-only preflight gates, one `docs(openspec):` commit, PR, owner's identity-preserving merge. The change is doc-only (skip_specs, no spec delta, no signed record), so the archive touches no `openspec/specs/**` and no `verification-lifecycle.json`.

**Tech Stack:** git, openspec checker (`openspec/scripts/check-design-pattern-governance.mjs`), openspec CLI, npm gates, gh CLI.

---

## Current context (verified 2026-08-17)

- `origin/main` = `3003e73663daf0c8392063488b4b59826e9daf9c` (identity-preserving merge of PR #170 = #67's landing).
- Issue #67 is **CLOSED** (2026-08-17T03:15:34Z) — the closure criterion is already satisfied; only the archive remains.
- ADR-SDK-011 verified at main: blob `576bf1907453ed4be6508b5181a655f9ddfbc69f`.
- Change contents (4 files, active-path blobs at origin/main):
  - `.openspec.yaml` → `72e4e47ee368d4142059699b556be525dcc63470` (schema: spec-driven, created: 2026-08-16, skip_specs: true)
  - `assessment.json` → `81380372ccd7b71f6ff34c31b171e53bf80b8120` (abbreviated, capabilities: `["security-audit-sdk-core"]`, owned_paths: ADR + check-coherence.mjs)
  - `proposal.md` → `30d42550dc73608329668a31b65c13c8580e2435`
  - `tasks.md` → `5e412eaf206bc6fc1f2403aea645e81393ffdc80` (1.1–1.5 checked; 1.6, 1.7 unchecked)
- No signed record for this change (doc-only; `governanceRecords` in `verification-lifecycle.json` holds only the three archived implementation changes) — the archive-evidence doc must state this explicitly.
- Precedent: branch `feat/archive-<id>`, commit `docs(openspec): archive <id>`, owner merge via PR (e.g. #168 for establish-design-pattern-governance).
- **Stop boundary:** #68's branch (`feat/bundle-validator-runtime-helpers`, T 9b33658, PR #171) is NOT touched by this cycle. No repair, no regeneration, no #68 work rides along.

---

## Task 1: Freeze identity and preflight

**Objective:** Prove the frozen starting point before any mutation.

**Files:** none.

**Step 1: Re-fetch and freeze**

Run:
```bash
cd /Users/fernando.costa/Git/bloodtrail
git fetch origin --quiet
git rev-parse origin/main
```
Expected: `3003e73663daf0c8392063488b4b59826e9daf9c`. If main has moved, record the new HEAD and re-verify the four active-path blobs (Task 2) against the new main before proceeding.

**Step 2: Confirm the tree is clean and #68 untouched**

Run: `git status --short --branch`
Expected: branch `feat/bundle-validator-runtime-helpers`; only untracked `.hermes/plans/*.md`; no modified/staged files.

Run: `git rev-parse HEAD`
Expected: `9b336582b2a8b436dc497b9a0726c4de593c1b01` (T stays untouched).

**Step 3: Confirm the issue and ADR state**

Run: `gh issue view 67 --json state,closedAt --jq '{state,closedAt}'`
Expected: `{"state":"CLOSED","closedAt":"2026-08-17T03:15:34Z"}`

Run: `git ls-tree origin/main -- packages/security-audit-sdk-core/adr/011-validator-runtime-packaging-policy.md`
Expected: blob `576bf1907453ed4be6508b5181a655f9ddfbc69f` (ADR-SDK-011 present at main).

**Step 4: Note the coexisting active change**

Run: `ls openspec/changes/`
Expected: `bundle-validator-runtime-helpers`, `correct-local-instruction-verification-premise`, `record-validator-packaging-policy`, `archive/`. Both remaining active changes are unrelated to this archive; if any gate at Task 5 fails because of their state, diagnose before committing — do not touch them.

---

## Task 2: Branch and relocate (pure git mv)

**Objective:** Cut the archive branch off main and move the change dir with byte identity intact.

**Files:**
- Move: `openspec/changes/record-validator-packaging-policy/` → `openspec/changes/archive/2026-08-17-record-validator-packaging-policy/` (4 files)

**Step 1: Branch**

Run: `git switch -c feat/archive-record-validator-packaging-policy origin/main`
Expected: new branch, HEAD = `3003e73...`.

**Step 2: Relocate**

Run:
```bash
git mv openspec/changes/record-validator-packaging-policy openspec/changes/archive/2026-08-17-record-validator-packaging-policy
git status --short
```
Expected: four `R` entries under the archive path, nothing else.

**Step 3: Byte-identity check (pure R100 relocation, before ANY edits)**

Run:
```bash
for f in .openspec.yaml assessment.json proposal.md tasks.md; do
  active=$(git rev-parse "origin/main:openspec/changes/record-validator-packaging-policy/$f")
  moved=$(git rev-parse "HEAD:openspec/changes/archive/2026-08-17-record-validator-packaging-policy/$f")
  printf '%s %s %s\n' "$f" "$active" "$moved"
  test "$active" = "$moved" || echo "DIVERGENCE on $f"
done
```
Expected: identical hash pairs; expected values from the context section above (72e4e47e…, 81380372…, 30d42550…, 5e412eaf…). No `DIVERGENCE` lines. (The index still holds the staged mv — do NOT commit yet; preflight gates run on the unstaged-index form in Task 5. If any preflight needs a committed diagnostic HEAD, commit a throwaway WIP in a disposable clone instead — never on this branch.)

---

## Task 3: Mark the final tasks

**Objective:** Reconcile tasks 1.6 and 1.7 with evidence.

**Files:**
- Modify: `openspec/changes/archive/2026-08-17-record-validator-packaging-policy/tasks.md` (only this file, inside the moved dir)

**Step 1: Edit tasks.md**

Change:
```markdown
- [ ] 1.6 Push and open the PR; report merge readiness (owner merges with an identity-preserving merge commit)
- [ ] 1.7 After merge: verify ADR-SDK-011 at main and close #67 with an evidence comment (owner-confirmed)
```
to:
```markdown
- [x] 1.6 Push and open the PR; report merge readiness (owner merges with an identity-preserving merge commit) — PR #170, merged as 3003e73663da (identity-preserving, 2 parents)
- [x] 1.7 After merge: verify ADR-SDK-011 at main and close #67 with an evidence comment (owner-confirmed) — ADR verified at main (blob 576bf190), issue closed 2026-08-17T03:15:34Z
```

**Step 2: Confirm only tasks.md differs**

Run: `git status --short`
Expected: the four rename entries plus ` M` (modified) on the moved `tasks.md`; nothing outside the archive dir.

---

## Task 4: Write archive-evidence.md

**Objective:** Discharge R24 with explicit per-item evidence.

**Files:**
- Create: `openspec/changes/archive/2026-08-17-record-validator-packaging-policy/archive-evidence.md`

**Step 1: Write the evidence doc** (template follows `openspec/changes/archive/2026-08-16-establish-design-pattern-governance/archive-evidence.md`), sections:

1. **Identities** — P `bf96500`, A `ba2d586`, T `401f3ad` (full hashes resolved at execution), merge M `3003e73663da…` with both parents verified (`git show --no-patch --pretty=%P 3003e73`; expect `3aedfec` tip + prior mainline), T reachable from M. State: **no S commit exists** — this is a doc-only change (`material_capability_modification: false`, `security_sensitive: false`); its chain legitimately contains no signed governance record, and `verification-lifecycle.json` `governanceRecords` holds records only for the three archived implementation changes. Review-freshness checks apply only to changes with records.
2. **Task completeness** — 7/7 tasks checked at the archive commit; 1.6 and 1.7 discharged with the PR/merge and ADR/closure evidence recorded in Task 3.
3. **Signed record authorizations** — N/A by design (no record); state this and the reasoning, so the archive-evidence contract's T/S-binding items are explicitly addressed rather than silently omitted.
4. **Canonical capability presence** — `skip_specs: true`, no `specs/` delta, `material_capability_modification: false`: nothing folds into `openspec/specs/security-audit-sdk-core/spec.md`; its blob on main is unchanged by this change (record the blob at execution: `git rev-parse origin/main:openspec/specs/security-audit-sdk-core/spec.md`). The archived `assessment.json` retains `capabilities: ["security-audit-sdk-core"]` — required by the association gate's capability filter for relocated changes.
5. **Production / publication restrictions** — unchanged; still enforced by `test:scope`, `test:publication-path`, and the existing signed records' withheld authorizations; all green at the archive commit (record the gate outputs from Task 5).
6. **Immutable archive contents, exact changed paths, byte identity** — list the four blobs and the R100 comparison result (Task 2 Step 3); promise `proposal.md` and `assessment.json` remain byte-identical to their active-path content at M (the dangling check compares them); the only edits inside the moved dir are `tasks.md` reconciliation and this new file.
7. **Active enforcement verified** — record the Task 5 results: final phase, `openspec validate --all --strict` (archived mode), SDK chain, contract, dual check. Phrase CI results as a **pre-merge requirement** (required checks green on the PR) — do NOT claim CI passed before it has run.

---

## Task 5: Preflight gates (read-only, index unstaged)

**Objective:** Prove the archive HEAD passes every gate before committing.

**Files:** none (verification only).

**Step 1: Governance final phase**

Run: `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`
Expected: `design-pattern governance passed in final phase…` — the relocation is recognized by the dangling check (byte-identical proposal/assessment) and by the perimeter's relocated-ownership logic (archived assessment with non-empty capabilities). Any other diagnostic = stop and diagnose.

**Step 2: OpenSpec strict validation (archived mode)**

Run: `openspec validate --all --strict`
Expected: all changes pass, including the relocated one in archived mode.

**Step 3: SDK chain (empty index)**

Run: `npm run validate --prefix packages/security-audit-sdk-core`
Expected: all 19 gates green (includes 199/199 verification, governance history, archive attestations, scope, publication-path, coherence, `test:git` with the still-empty index).

**Step 4: Contract chain**

Run: `npm run validate --prefix contracts/security-audit`
Expected: 14/14.

**Step 5: Dual check**

Run: `node openspec/scripts/run-governance-dual-check.mjs`
Expected: baseline (main checker) and candidate (this HEAD) agree; report the checker blob.

**Step 6: Diff hygiene**

Run: `git diff --check`
Expected: no whitespace errors.

---

## Task 6: Commit, push, PR

**Objective:** Land the archive commit on the branch and open the PR.

**Files:** the moved archive dir only.

**Step 1: Stage the explicit allowlist**

Run: `git add openspec/changes/archive/2026-08-17-record-validator-packaging-policy/`
Then: `git status --short` — expected: staged entries ONLY under `openspec/changes/archive/2026-08-17-record-validator-packaging-policy/`; `.hermes/plans/*` and any #68 files remain untracked/unstaged.

**Step 2: Commit**

Run: `git commit -m "docs(openspec): archive record-validator-packaging-policy"`
Then: `git show --stat HEAD` — expected: 4 files (+evidence) with rename detection for the moved files; total ~5 files; no other paths.

**Step 3: Push and PR**

Run:
```bash
git push -u origin feat/archive-record-validator-packaging-policy
gh pr create --title "docs(openspec): archive record-validator-packaging-policy" \
  --body "R24 archive of the landed doc-only change (PR #170, merge 3003e73663da). No code changes; no spec delta (skip_specs); no signed record (doc-only). Preflight: governance final phase green, openspec strict, SDK + contract chains, dual check. Expected CI: all required jobs green — codescene delta (markdown/JSON only), sonar (no analyzed paths), conventional-commits, governance. Owner merges with an identity-preserving merge commit."
```
Expected: PR URL returned.

**Step 4: Watch CI and report merge readiness**

Run: `gh pr checks <PR> --watch` (select the ci workflow run by headSha; re-query `gh pr checks` for the authoritative rollup).
Expected: all required checks green (sonar, codescene delta, conventional-commits, governance, ci, sdk, contract). Report merge readiness to the owner: exact archive commit hash, PR number, check state. The owner merges manually — never merge on his behalf.

---

## Task 7: Post-merge verification and stop

**Objective:** Verify the owner's merge and confirm #67's criteria are complete.

**Step 1: Verify the merge** (after the owner merges)

Run:
```bash
git fetch origin --quiet
git show --no-patch --pretty=%P origin/main
git merge-base --is-ancestor <archive-commit> origin/main && echo reachable
```
Expected: two parents (prior main + exact archive commit), archive commit reachable from the new main.

**Step 2: Verify the archive at main**

Run: `git ls-tree origin/main -- openspec/changes/archive/2026-08-17-record-validator-packaging-policy/`
Expected: the 5 files present; `openspec/changes/record-validator-packaging-policy` no longer exists at main.

**Step 3: Report and STOP**

Report: #67 remaining criteria complete — issue already closed (2026-08-17T03:15:34Z), ADR-SDK-011 verified at main, archive landed. Explicitly state that nothing from the #68 chain (branch, T 9b33658, PR #171, the pending repair decisions) was touched.

---

## Risks, tradeoffs, open questions

- **main moving mid-cycle:** re-fetch and re-freeze; re-run the final phase at the new base. `correct-local-instruction-verification-premise` is an owner-owned active change — never touch it; if a gate fails because of it, report and stop.
- **CodeScene delta on a docs-only diff:** expectation is no findings (no code in the diff). If it flags, diagnose honestly — no waiver, no config carve-out.
- **Dangling check strictness:** proposal.md/assessment.json must remain byte-identical to their active-path blobs at M; any accidental edit to them must be reverted, not papered over.
- **No movementAttestations update:** precedent (right-size-change-governance, establish-design-pattern-governance archives) added none; the archive-attestations gate validates declared attestations, not undeclared movements.
- **Archive date prefix:** `2026-08-17` set at creation; if the merge lands after midnight UTC the directory name is not renamed.
- **Issue #67 closure comment:** the issue is already closed; if the owner wants a post-archive evidence comment appended, that is his action — not part of this cycle.
