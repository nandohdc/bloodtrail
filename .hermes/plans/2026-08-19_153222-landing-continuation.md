# Continuation — correct-local-instruction governance landing (sessions after 2026-08-19, ~16:50 -03)

> Written at the owner's request because the active session's model credits were running out.
> This file picks up exactly where execution stopped. It is NOT a new plan — it continues
> `.hermes/plans/2026-08-19_123222-correct-local-instruction-governance-landing.md` (Revision 2,
> owner-corrected, owner-approved Option A), which remains the authoritative plan. Read it first.

## Status at handoff (all facts verified at write time)

Completed and merged (owner performed every merge, identity-preserving):

| Step | PR | Commit | Merge |
| --- | --- | --- | --- |
| Task 3.1 propose retire-change | #181 | `68fb9680c578aed2b8abf6d90e28e22d3455c0e2` | `029f8fb613e81c6282b1643194c8df15acebfeb9` |
| Task 3.2 retire the grandfathering entry | #183 | `19afaa73fe01a734a6371b94b274ec9f2466c5d4` | `6ea3b5c1e3492c1db5d834e7b75499f1add84569` |
| Task 4 archive the correction (fold + reconcile + evidence) | #184 | `fd2ff14467bd5d138bc58446bac4b71258179b34` | `1b69590cd913866830bdd092f6443728d6045346` |

In flight at handoff:

- **Task 6 — PR #185** `docs(openspec): archive cover-local-instruction-control-paths`
  https://github.com/nandohdc/bloodtrail/pull/185
  - Branch `docs/archive-cover-local-instruction-control-paths`, commit
    `057d4571635189cfae129adc991871845bc514fc`, pushed.
  - All local gates ran green at that commit (SDK validate, contract validate, openspec strict +
    archived, post-commit governance final phase green — rangeBase `1b69590c`, 10 paths, non-null;
    dual-check candidate == baseline, checker blob `13cd54e26afa`; governance suite 196/196).
  - CI was still running when this file was written. A background `gh pr checks 185 --watch`
    belonged to the old session and is dead — do NOT rely on it.
  - The working tree is currently ON this PR's branch.

Key pins for reference (all previously verified):

- Correction: P `9e356f3a81b1290d61b7fc69fd0e1b38d367a285`, T `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3`,
  M `2b9b2297e3665b6f513eb9f85b522f556e61f24b` (PR #178); keeper K `716e35b4f10d07ecc9c33c3e4fdb94fb395f1255`.
- Spec blob after the fold (PR #184): `fd303b8f141d7d15bf86c38e2d8acfb176dc9b76`.
- Checker blob for dual-check: `13cd54e26afa`.
- Retire-change blobs at merge `6ea3b5c` (the pre-archive state Task 7 must move byte-identical):
  - `.openspec.yaml` `4ea27766c762fc7ae9063860e026b4e71e25384e`
  - `assessment.json` `0f6f2f7869179b05ff0ef0a45fb0637624fb607d`
  - `proposal.md` `e666dcc8532fd34d8b1368f9589cc4ba0e724640`
  - `tasks.md` `4365eb52c13c47ba733895d24c484c4181b8e56b` (pre-reconciliation)
- Active changes right now: only `retire-local-instruction-grandfathering`.
- Untracked in the repo: only `.hermes/plans/2026-08-19_123222-correct-local-instruction-governance-landing.md`
  (and this file once written). Leave untracked files alone.

## Step 1 — finish PR #185 (Task 6, already prepared)

1. `cd /Users/fernando.costa/Git/bloodtrail && gh pr checks 185`
   - If anything is still pending, poll until settled (CI queue congestion has been common — a run
     sitting in `queued` for 20+ minutes is normal here; do not treat it as failure).
   - If any check is red: do NOT touch the commit. Report the failing job and stop for the owner.
     The branch was verified green locally at `057d457`; a red CI needs diagnosis, not a fix-up
     commit. (Note: `codecov`-family checks have been flaky-pass elsewhere; treat required contexts
     as authoritative — the repo's required checks include `design-pattern-governance`.)
2. When all green: report readiness to the owner in plain chat: exact commit `057d4571635189cfae129adc991871845bc514fc`,
   PR #185, all checks green, and that the agent does not merge. The OWNER merges, identity-
   preserving (merge commit, never squash/rebase).

## Step 2 — Task 7: archive the retire-change (PR #186, the 5th and last PR)

Preconditions: PR #185 merged; main pulled; the correction's dated archive dir and the policy edit
are already in main (they are — PRs #183/#184). Active changes = retire-change only.

1. `git checkout main && git pull` — verify the new merge is identity-preserving: two parents
   (old main + `057d4571635189cfae129adc991871845bc514fc`).
2. `git switch -c docs/archive-retire-local-instruction-grandfathering`
3. No spec sync — `skip_specs: true`, no delta. Do NOT run any sync step.
4. Move:
   `mv openspec/changes/retire-local-instruction-grandfathering openspec/changes/archive/2026-08-19-retire-local-instruction-grandfathering`
5. Reconciliation INSIDE the moved dir only (fixture precedent — exactly two files change):
   - `tasks.md`: check 2.1 (owner identity-preserving merges of PRs #181/#183 — recorded, not
     re-done, with merge hashes `029f8fb…` / `6ea3b5c…`), 2.2 (discharged: stayed active, declaring
     `software-design-pattern-governance` and owning the policy file + the correction's dated
     archive dir, until the correction's archive merged at `1b69590c…`), 2.3 (this archive). All
     five tasks must end checked.
   - `archive-evidence.md` (NEW, model on
     `openspec/changes/archive/2026-08-19-cover-local-instruction-control-paths/archive-evidence.md`):
     identities (proposal `68fb9680…` / implementation `19afaa73…` / merge `6ea3b5c…` + parents),
     task completeness, the coverage role this change played (owned the policy file while the
     entry was retired and the correction's dated archive dir while it landed), byte-identity
     table using the pinned blobs above (`assessment.json` AND `proposal.md` are both relocation
     artifacts here, recognition doubly satisfied; `.openspec.yaml` is NOT), self-coverage note
     (its own relocation is covered because it carries an `assessment.json` with a non-empty
     capability `software-design-pattern-governance`), spec blob unchanged between pre-archive
     head and this commit, production/publication restrictions unchanged, active enforcement
     verified.
6. Gate battery — Stage 1 BEFORE `git add` (`test:git` requires an empty index):
   ```
   npm run check:generated --prefix packages/security-audit-sdk-core
   npm run validate --prefix packages/security-audit-sdk-core
   npm run validate --prefix contracts/security-audit
   openspec validate --all --strict
   openspec validate --all --archived --strict
   git diff --check
   ```
7. Commit with an explicit allowlist covering **both** directions of the move — staging only the
   destination commits additions and leaves the change duplicated in `main` (this is exactly what
   went wrong in PR #185 at `057d457`, and neither the local battery nor CI catches it, because the
   checker folds working-tree and untracked paths into its range):
   ```
   git add -A openspec/changes/retire-local-instruction-grandfathering \
              openspec/changes/archive/2026-08-19-retire-local-instruction-grandfathering
   git diff --cached --name-status --no-renames   # expect 5 A + 4 D, nothing else
   git commit -m "docs(openspec): archive retire-local-instruction-grandfathering"
   ```
   Then verify the **commit tree**, not the exit code:
   `git ls-tree --name-only HEAD openspec/changes/` must list only `openspec/changes/archive`.
8. Gate battery — Stage 2 AFTER the commit (these read HEAD; before the commit they are vacuously
   green — do not skip this and do not judge through a pipe):
   ```
   node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
   node openspec/scripts/check-design-pattern-governance.mjs --phase final --json   # rangePaths must NOT be null
   node openspec/scripts/run-governance-dual-check.mjs
   node --test openspec/tests/design-pattern-governance/*.test.mjs
   ```
   Watch: `openspec-association-unrelated` on the policy file = retire-change no longer active
   (should be impossible here — it owns itself); on the dated archive dir = missing/misspelled
   owned_paths entry (keep the trailing `/`).
9. `git push -u origin docs/archive-retire-local-instruction-grandfathering`, open the PR
   (`gh pr create` — follow the body style of PRs #184/#185: summary, staged scope, local gate
   evidence, "No production or publication authorization is granted or implied"). Watch CI.
   When all green: report readiness; OWNER merges identity-preserving.

## Step 3 — Task 8: final state verification and report

After the retire-change archive merges, on an updated main:

```
openspec list                                   # expect: No active changes found.
openspec validate --all --strict
openspec validate --all --archived --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
git status --short --branch                     # clean, synced
```

Report to the owner: exact commits for each of the five PRs (P/T/M per archive), gate results,
what was NOT verified (no CI claim before CI ran; the independent review of `6fab5f9` is a
recorded technical pass, not an approval — the owner's 6.3 decision is the binding record), and
that production/publication authorization remains withheld.

## Rules that govern this continuation (unchanged from the plan)

- The owner merges every PR, identity-preserving. The agent reports readiness, never merges.
- Proposal / implementation / archive commits stay separate; each PR is one commit.
- Stage only an explicit allowlist; leave unrelated untracked files untouched.
- Never judge checker output through a pipe — read the exit code directly.
- Never edit generated output (specs fold via the sync flow only; the Task 7 archive has NO fold).
- Node is pinned `>=24 <25 || >=26 <27`; run npm via `--prefix`, there is no root package.json.
- AI review / CI green / PR state is not approval. Owner decisions from Task 2 (2a exact-commit
  grant, 2b Option A, inline review record) are already recorded in the correction's archive and
  cover this continuation; no new approvals are needed for Tasks 7–8, which the approved plan
  already authorized.
