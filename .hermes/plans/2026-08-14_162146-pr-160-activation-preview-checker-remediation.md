# PR #160 Activation-Preview Checker Remediation Plan

> **For Hermes:** Implement this plan with subagent-driven development task-by-task. Before acting, load `software-delivery/signed-review-freshness-verification`, `software-delivery/governed-landing-cycle-execution`, `software-delivery/openspec-governed-change-lifecycle`, `software-delivery/exact-commit-governance-audit`, `software-development/test-driven-development`, and `github/github-pr-workflow`. This plan file is planning evidence only: keep it untracked and excluded from implementation staging unless the owner separately chooses to include it.

**Goal:** Fix the activation-record introduction check so a normal post-activation pull-request synthetic merge is no longer misread as a second activation introduction, land the fix through a governed T3 → S3 → M3 → A′ cycle, and prove end-to-end that a normal PR preview passes the required governance check.

**Architecture:** Replace the single-parent-only "introduction" comparison in `childCommitsIntroducing` with a uniform any-parent rule: a commit introduces the activation record only when *no parent* carries it. This is an actor-neutral shape rule — no PR-ref special-casing, no weakening. Regression tests reproduce the PR #160 synthetic-merge graph in disposable fixtures, plus a negative control proving a merge that merely carries the record from a side branch is still not a dedicated activation commit.

**Tech Stack:** Node 26 ESM, dependency-free Git plumbing, `node --test` disposable repositories, OpenSpec CLI, `gh` CLI and the branch-protection API, npm workspace validation.

---

## 1. Frozen state and exact identities

Live baseline (verified 2026-08-14):

- `origin/main` = `5e732c163f3c3a88586d1370e3779d725a6cb7a5` (M/M2 recorded in the establish record's `mergeCommits`)
- Signed record for `establish-design-pattern-governance` (in `packages/security-audit-sdk-core/verification-lifecycle.json`):
  - `reviewedCommit` T2 = `11996085a55ecb0ba627532ea67558793064d21c`
  - signed record commit S2 = `1379a26a263645216bf7f5a3cd29b798b62803f6`
  - `mergeCommits` = [`a2ce4d8983b385e3ea06685780bd436d99dbc3c3`, `5973c767a2bec815410e05a2b711fc8ed4a85f75`]
- Activation record `openspec/governance/activation-record.json` binds M2 = `5973c767a2bec815410e05a2b711fc8ed4a85f75`, T2, S2, and the checker blob `c9f836ac56855b8fc4eaaef37aed88805264910b`.

## 2. Root cause

`openspec/scripts/design-pattern-governance/activation.mjs`, `childCommitsIntroducing` (~line 123):

```js
const before = parents.length === 1 ? objectAtPath(parents[0], path, cwd) : null;
```

For any two-parent commit `before` is forced to `null`, so a merge whose parents already carry the activation record is counted as *introducing* it. GitHub's pull-request checkouts are synthetic two-parent merges (`refs/pull/N/merge`), so every normal post-activation PR preview registers a second introduction candidate. `findActivationCommit` requires exactly one candidate; it finds two (the real A plus the preview merge) and fails with `activation-commit-absent`.

The real A on the preview's first-parent chain is correctly detected; the preview merge itself must simply not be counted, because it inherited the record from a parent.

Confirmed live: PR #160 preview failed with exactly this diagnostic while the identical commit passed the checker on the true linear history.

## 3. Governance posture — why this is a full re-signing cycle

- `openspec/scripts/design-pattern-governance/` and `openspec/tests/design-pattern-governance/` are normative paths. The signed record binds T2; any change after T2 must fail with `signed-review-stale` until a new record lands.
- Expected red at T3: the governance check fails with `signed-review-stale` naming `openspec/scripts/design-pattern-governance/activation.mjs` and `openspec/tests/design-pattern-governance/activation.test.mjs`. That red is the intended fail-closed state, never merge-ready.
- The fix stays inside the active `establish-design-pattern-governance` change (it introduced the checker and its record is what R15 enforces). No new OpenSpec change is needed.
- Fresh owner approval naming exact T3 is mandatory. A clarify timeout is not approval. Do not reuse the T2 decision.

## 4. Non-negotiable boundaries

1. Never weaken the checker with PR-specific or ref-name logic; the fix must be the shape rule alone.
2. Do not alter, amend, or force-push any historical commit (T, S, T2, S2, M, M2, A, `5e732c1`).
3. Preserve each frozen candidate byte-for-byte after verification: no regenerate, reformat, or rerun on a verified candidate.
4. Stage explicit allowlists only; `test:git` requires an empty index before staging.
5. Merge M3 with merge-commit mode and `--match-head-commit`; never squash, rebase, amend, or force-push.
6. A′ has sole parent M3 and contains only `openspec/governance/activation-record.json`.
7. Do not touch tasks.md 9.x/10.x during this cycle; task reconciliation stays archive-time work, consistent with the prior cycles.
8. Canonicalization and archive remain withheld. They are the next separately authorized change after this remediation lands.
9. Disposable verification runs use an isolated `HOME` (so global Git identity/config cannot leak in); `gh`/remote steps run with the real `HOME=/Users/fernando.costa` — mixing the two silently breaks `gh` auth.
10. Do not check any governance task box, merge, or push without the corresponding owner authorization step.

---

### Task 1: Re-freeze the live baseline

**Objective:** Prove local, tracking, and live identities before any edit.

**Files:** none.

**Step 1** — with real HOME:

```bash
git fetch --prune origin
git rev-parse HEAD                          # expect 5e732c163f3c3a88586d1370e3779d725a6cb7a5
git rev-parse origin/main                   # expect 5e732c163f3c3a88586d1370e3779d725a6cb7a5
gh api repos/nandohdc/bloodtrail/git/ref/heads/main --jq '.object.sha'  # same
git status --porcelain=v1 --untracked-files=all                          # clean except this plan file
git worktree list --porcelain              # one worktree, the primary repo
```

**Step 2** — record the branch name to create: `fix/activation-preview-second-parent`. Confirm no local or remote branch with that name exists (`git show-ref`, `git ls-remote --heads origin fix/activation-preview-second-parent`).

**Step 3** — create it from exact `origin/main`:

```bash
git switch -c fix/activation-preview-second-parent origin/main
```

### Task 2: RED — reproduce the synthetic-merge defect in a fixture

**Objective:** Add regression tests that fail on the current checker with `activation-commit-absent`.

**Files:**
- Modify: `openspec/tests/design-pattern-governance/activation.test.mjs`

**Step 1** — add to `activation.test.mjs` a new describe block using the existing `buildGovernedHistory` / `commitActivation` helpers:

```js
describe("R17 a two-parent commit carrying the record from a parent is not a second introduction", () => {
  it("accepts an ordinary merge preview after activation", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, record);

    // GitHub PR-checkout shape: a synthetic merge whose first parent (main)
    // already carries the activation record.
    repository.branch("feat/followup");
    repository.write("docs/followup.md", "# Follow-up\n");
    repository.commit("docs: an ordinary post-activation follow-up");
    repository.checkout("main");
    repository.git(["merge", "--no-ff", "feat/followup", "-m", "Merge followup"]);

    assertPasses(check(repository));
  });

  it("still rejects a merge that carries the record without a dedicated activation commit", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    // No commitActivation on main: the record arrives only via a merge from a
    // side branch, which is not A (sole parent M). The merge must not count as
    // the introduction, so no activation commit is found.
    repository.branch("feat/activation-carried");
    repository.writeJson(ACTIVATION_PATH, record);
    repository.commit("chore: carry an activation record on a side branch");
    repository.checkout("main");
    repository.git(["merge", "--no-ff", "feat/activation-carried", "-m", "Merge activation-carried"]);

    assertDiagnostic(check(repository), "activation-commit-absent");
  });
});
```

**Step 2** — run and expect RED:

```bash
node --test openspec/tests/design-pattern-governance/activation.test.mjs
```

Expected: the first new test fails with `activation-commit-absent` (the PR #160 reproduction); the second may already pass but must be kept as the negative control.

**Step 3** — commit the RED tests alone:

```bash
git add openspec/tests/design-pattern-governance/activation.test.mjs
git commit -m "test(governance): reproduce the activation-preview second-introduction defect"
```

### Task 3: GREEN — the any-parent introduction rule

**Objective:** Minimal fix so a commit introduces the record only when no parent carries it.

**Files:**
- Modify: `openspec/scripts/design-pattern-governance/activation.mjs` (only `childCommitsIntroducing` and a small helper)

**Step 1** — replace the `before` computation:

```js
function childCommitsIntroducing(path, merge, cwd) {
  const result = [];
  const objectAtMerge = objectAtPath(merge, path, cwd);
  const head = resolveCommit("HEAD", cwd);
  if (head === null) return result;
  const objectAtHead = objectAtPath(head, path, cwd);
  if (objectAtHead === null) return result;
  if (objectAtMerge !== null) return result; // present already at M: not introduced after it
  // Walk the first-parent chain forward from M looking for the introduction.
  const chain = firstParentChain(head, merge, cwd);
  for (const commit of chain) {
    const parents = parentsOf(commit, cwd) ?? [];
    const carriedByParent = parents.some((parent) => objectAtPath(parent, path, cwd) !== null);
    const after = objectAtPath(commit, path, cwd);
    if (!carriedByParent && after !== null) result.push(commit);
  }
  return result;
}
```

Rationale recorded in a code comment: a merge whose parent already carries the blob inherited it — only content present at the commit while absent from *every* parent is introduced there. This is the same rule the R15 merge-path scanner uses and requires no knowledge of PR refs.

**Step 2** — run the activation tests and expect GREEN:

```bash
node --test openspec/tests/design-pattern-governance/activation.test.mjs
```

**Step 3** — full governance suite and the exact-commit audit checks (read-only):

```bash
node --test openspec/tests/design-pattern-governance/*.test.mjs
node openspec/scripts/check-design-pattern-governance.mjs --phase final   # expect signed-review-stale ONLY
```

Expected: the full suite passes; the final phase on this worktree still reds with `signed-review-stale` naming exactly the two changed normative paths. Any other diagnostic blocks.

**Step 4** — CodeScene delta clearance. If the local `cs` CLI reports new findings for `activation.mjs`, decompose without behavior change: bundle inputs, ≤3 decisions per function, ≤4 positional args, module mean ≤4. Each fix round is a NEW commit, never an amend. Re-run the full governance suite after every decomposition (a "behavior-preserving" split previously broke a scan-until-positive walk).

**Step 5** — commit:

```bash
git add openspec/scripts/design-pattern-governance/activation.mjs openspec/tests/design-pattern-governance/activation.test.mjs
git commit -m "fix(governance): treat merge commits as introducing the activation record only when no parent carries it"
```

### Task 4: Freeze T3 and verify in a disposable exact-tree clone

**Objective:** Full read-only verification on the exact branch tree without mutating the governed worktree.

**Files:** none.

**Step 1** — freeze:

```bash
git rev-parse HEAD                        # T3; record it
git status --porcelain=v1 --untracked-files=all   # clean except this plan file
```

**Step 2** — disposable no-hardlink clone from the live remote at T3 (after push in Task 5, or locally detached at T3 with `git clone --no-hardlinks file://…`); install with an isolated HOME, run the complete gate set, and require byte identity with the live tree:

```bash
npm ci --prefix <clone>/packages/security-audit-sdk-core
npm ci --prefix <clone>/contracts/security-audit
npm run check:generated --prefix <clone>/packages/security-audit-sdk-core
node <clone>/openspec/scripts/check-design-pattern-governance.mjs --phase final   # signed-review-stale ONLY (expected at T3)
node --test <clone>/openspec/tests/design-pattern-governance/*.test.mjs
npm run test:governance-history --prefix <clone>/packages/security-audit-sdk-core
npm run validate --prefix <clone>/packages/security-audit-sdk-core
npm run validate --prefix <clone>/contracts/security-audit
openspec validate establish-design-pattern-governance --strict
openspec validate --all --strict
```

Expected: everything passes except the expected final-phase `signed-review-stale`. Prove the clone worktree is clean afterwards and the candidate bytes equal the live bytes.

### Task 5: Push T3, open the PR, classify exact-T3 CI honestly

**Files:** GitHub PR only; repository files: none.

**Step 1** — push without force and open the PR (real HOME):

```bash
git push -u origin fix/activation-preview-second-parent
gh pr create --repo nandohdc/bloodtrail --base main --head fix/activation-preview-second-parent \
  --title "fix(governance): treat merge commits as introducing the activation record only when no parent carries it" \
  --body "<PR body following .github/PULL_REQUEST_TEMPLATE.md: OpenSpec change establish-design-pattern-governance; governance-core change; expected signed-review-stale at T3; verification results>"
```

Record the real PR number; never fabricate one in advance.

**Step 2** — wait for checks on exact T3. Require every check except `design-pattern-governance` green (sdk, contract, coverage, ci/*, sonar, codescene delta, conventional-commits). `design-pattern-governance` must fail with ONLY `signed-review-stale` naming the two normative paths. Any other failure blocks. This temporary red is fail-closed; never merge at T3.

### Task 6: Owner approval naming exact T3

**Files:** none.

Ask the owner in plain chat, with the exact wording equivalent to:

> Approve exact technical commit `<T3>` for the activation-preview remediation (fix in `openspec/scripts/design-pattern-governance/activation.mjs` plus regression tests in `openspec/tests/design-pattern-governance/activation.test.mjs`); authorize its governance-record-only direct child S3 updating only `packages/security-audit-sdk-core/verification-lifecycle.json`, the identity-preserving merge of the T3 PR, the rebuilt dedicated direct-child activation commit A′ bound to the new merge, the fast-forward landing of A′ to `refs/heads/main`, and the post-activation record-only commit recording the new merge in `mergeCommits`; continue to withhold canonicalization, archive, publication, deployment, production collection, real-user processing, framework integration, and delivery infrastructure.

A clarify timeout is not approval. The owner answers with one word.

### Task 7: Construct, preflight, commit, and publish exact S3

**Objective:** Governance-record-only child of the branch tip that clears R15.

**Files:**
- Modify ONLY: `packages/security-audit-sdk-core/verification-lifecycle.json`

**Step 1** — update the ONE current record for `establish-design-pattern-governance` (never append a duplicate):

- `policy`: keep the owner-decision summary; refresh the clause about the checker result to reference the T3 cycle.
- `reviewedCommit` → T3; `reviewedContent.candidateRoot` → `git rev-parse T3^{tree}`.
- `reviewedContent.entries`: `openspec/scripts` → `git rev-parse T3:openspec/scripts`; `openspec/tests/design-pattern-governance` → `git rev-parse T3:openspec/tests/design-pattern-governance`; the other three entries unchanged (verify their objects still match T3; no reviewed path may contain `verification-lifecycle.json`).
- `governedCommits`: existing list plus T3. `boundCommits` → `[T3]`.
- `mergeCommits`: keep the two recorded merges (both remain ancestors). The new M3 cannot be named before it exists; Task 11 records it.
- `designPatternGovernance.checkerResults.candidate`: `sourceRef` → T3, `checkerBlob` → `git rev-parse T3:openspec/scripts/check-design-pattern-governance.mjs`, `exitCode: 1` with diagnostics describing the expected pre-S3 `signed-review-stale`.
- `divergences`: add the accepted divergence documenting that the T3 red was the intended R15 state for a post-signing normative fix.
- `requiredCheckEvidence`: re-query `gh api repos/nandohdc/bloodtrail/branches/main/protection/required_status_checks | shasum -a 256` and refresh the digest/plan.
- `authorizations`: unchanged granted/withheld set. `signatureDecision`: store the owner's exact T3 decision text only after the owner responds (Task 6). `reviewer.signedAt` → the decision date.

**Step 2** — build S3 as a direct child of the branch tip (T3). Expected diff: exactly one path. Do not name future M3 or A′ hashes.

**Step 3** — preflight in a disposable clone: `S3^ == T3`, every T3 reviewed object equals the record, `T3..S3` changed paths are governance-record-only, `signed-review-stale` absent, full gate set green:

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final   # ZERO failures
node --test openspec/tests/design-pattern-governance/*.test.mjs
npm run test:governance-history --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate establish-design-pattern-governance --strict
openspec validate --all --strict
```

**Step 4** — stage only the record, verify blob identity, commit as `docs(governance): re-sign the activation-preview fix`, push without force, prove local/tracking/live PR head equality.

**Step 5** — the T3 PR now shows the full end-to-end proof: its preview synthetic merge must pass `design-pattern-governance` (freshness cleared by S3, activation misread fixed). Require all required checks green on exact S3 before Task 8.

### Task 8: Identity-preserving merge M3

**Files:** protected history only.

**Step 1** — final merge gate: local/tracking/live PR head = S3, `S3^` = branch tip under T3, `origin/main` unchanged at `5e732c1`, branch protection digest re-queried and unchanged, exact-S3 checks green.

**Step 2** — merge:

```bash
gh pr merge <pr> --repo nandohdc/bloodtrail --merge --match-head-commit <S3>
```

**Step 3** — read back M3: two parents (one `5e732c1` or its then-current main tip, one S3), T3 and S3 ancestors, no rewritten replacements. Record exact M3 and `M3^{tree}`. Stop on any identity mismatch.

### Task 9: Rebuild and pre-verify dedicated activation commit A′

**Files:**
- Modify: `openspec/governance/activation-record.json` (allowlisted path only)

**Step 1** — dedicated branch `feat/rebind-activation-preview-fix` created at exact M3; prove `HEAD == M3` and a clean state.

**Step 2** — re-capture the branch-protection required-status-check bytes and SHA-256 at activation time (activation-time digest, not a stale capture).

**Step 3** — rebuild the record: `merge_commit` = M3, `merge_tree` = `M3^{tree}`, `technical_commit` = T3, `signed_record_commit` = S3, `signed_record_content_object` = `T3^{tree}`, `bound_blobs` re-derived from T3 for every existing key (checker blob WILL change; policy/schemas/catalog/docs/template only if their T3 blobs differ — verify each with `git rev-parse T3:<path>`), `required_check` with the fresh digest and `verified_contexts` matching the live API, `supported_schema_versions` and `grandfathered_entries` unchanged, `allowlisted_activation_paths` unchanged. Never include A′'s own hash.

**Step 4** — preflight in a disposable clone with `git update-ref refs/heads/main M3` pinned: require activation phase to print enforcement-active, final phase zero failures, bootstrap to fail with ONLY `bootstrap-re-entry` (isolate with `|| true`). Negative controls in separate throwaway clones: interposed commit → `activation-parent`; smuggled extra path → `activation-unrelated-change`; altered checker binding → `checker-blob-mismatch`.

**Step 5** — stage only the activation record and commit once on the activation branch:

```bash
git commit -m "feat(governance): rebind the activation record to the preview-fix landing cycle"
```

Prove `A′^ == M3`, exactly one parent, diff from M3 contains only the activation record. Freeze A′ byte-for-byte.

### Task 10: Land A′ by fast-forward, require the mainline run

**Files:** remote refs only.

**Step 1** — push the activation branch without force, open an activation PR solely to obtain checks. Its preview governance check is EXPECTED to fail with `activation-parent` (synthetic two-parent merge); do not weaken anything. Wait for the other required contexts on exact A′.

**Step 2** — immediately before landing require `origin/main == M3` and `A′^ == M3`. Then land with the same authorized pattern as activation:

```bash
git push origin "<A′>:refs/heads/main"
```

No force, no admin bypass, no GitHub merge button. Disclose any reported rule bypass and require the mainline push run on exact A′ to be green — activation phase, final phase, and every required context.

**Step 3** — read back: local activation branch, `origin/main`, and live GitHub main all equal A′; the activation PR recognized as merged by inclusion.

### Task 11: Record M3 in mergeCommits (record-only)

**Files:**
- Modify ONLY: `packages/security-audit-sdk-core/verification-lifecycle.json`

**Step 1** — branch `docs/record-preview-fix-merge` from A′ (this is the same R15-permitted governance-record-only pattern already executed for M/M2). Append `{ "commit": "<M3>", "expectedParents": 2 }` to the establish record's `mergeCommits`. Verify `git rev-list --parents -n 1 M3` shows exactly two parents.

**Step 2** — preflight in a disposable exact-tree clone (isolated HOME): governance final phase pass, governance tests, SDK validate, contract validate, strict openspec.

**Step 3** — push, open a PR. Its preview governance check must PASS — this is the first ordinary PR after the fix and doubles as the live regression proof that the PR-preview path is repaired.

**Step 4** — with the owner's Task-6-authorized scope, land by non-force fast-forward to `refs/heads/main` and require the mainline run green.

### Task 12: Final verification and stop-boundary report

**Files:** none.

**Step 1** — re-freeze and prove: live main == R3 commit; first-parent chain main carries T3/S3/M3/A′ intact; the activation record binds M3/T3/S3 and re-derived blobs match; final phase zero failures on mainline CI; the throwaway/ordinary PR preview passed.

**Step 2** — report separately: technical T3 readiness; signed S3 validity; M3 merge identity; A′ activation state; mergeCommits state (M, M2, M3); production/publication restrictions unchanged; canonicalization not executed and still withheld; archive not ready (requires canonical materialization, task reconciliation, explicit archive validation, and fresh authorization).

**Step 3** — STOP. Do not run `openspec sync`, `openspec archive`, modify canonical specs, check post-sign task boxes, or create archive attestations.

---

## Validation matrix

```bash
node --test openspec/tests/design-pattern-governance/*.test.mjs
node openspec/scripts/check-design-pattern-governance.mjs --phase final      # T3: stale-only; S3/A′/R3: zero
node openspec/scripts/check-design-pattern-governance.mjs --phase activation # post-A′ only
node openspec/scripts/check-design-pattern-governance.mjs --phase bootstrap  # re-entry only (expected-fail, || true)
npm run test:governance-history --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate establish-design-pattern-governance --strict
openspec validate --all --strict
```

## Pitfalls carried forward

- Approval timeouts are not approval; re-ask, never proceed on a timeout.
- Disposable verification runs must use an isolated HOME; `gh`/remote steps must use the real HOME — the two never mix in one command.
- PR previews are synthetic two-parent merges: `activation-parent` on the A′ preview and `signed-review-stale` at T3 are both EXPECTED, fail-closed reds — never suppressed.
- Fixture seeders exclude the live activation record and seed an empty canonical manifest; never copy the live `verification-lifecycle.json` into fixtures.
- Use `set -o pipefail`; expected-failure probes (bootstrap re-entry) are isolated with `|| true`; never judge by `node --test | tail`.
- CodeScene delta is a required gate; fix new findings with behavior-preserving decomposition in NEW commits and re-run the full suite each round.
- Patch-tool trailing-newline trap: re-read the edited region after every JSON patch.
- Every FF push to protected main requires the corresponding owner authorization step and a mainline CI readback on the exact SHA; disclose any branch-rule bypass message.
- Stage the explicit allowlist only; `git add -A` in a clone after `npm install` sweeps npm-dirtied lockfiles into the candidate.

## Open questions for the owner

1. Whether the Task-6 approval may cover the whole cycle (S3, M3, A′, R3 fast-forwards) in one decision naming exact T3 — recommended, mirroring the T2 decision structure — or whether each push should get its own go.
2. Whether the plan file itself may be committed with the remediation or stays untracked planning evidence (prior convention: untracked).
