# Self-Sufficient Archive-Movement Fixture Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Decouple the `archive-movement-unrelated-deletion` verification control from whatever OpenSpec change happens to be active, by synthesizing an unrelated active change inside the disposable clone — so `correct-local-instruction-verification-premise` (task 6.6) can archive without breaking the suite, and no future archive can break it again.

**Architecture:** Test-harness-only change. The control **moves out of** `mutations.test.mjs` into a new dedicated suite, `packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs`. That suite seeds a minimal synthetic change under `openspec/changes/` in a disposable clone, commits it, then deletes the committed file — so the fixture is created by the test rather than borrowed from the repository's live lifecycle. A same-fixture null arm proves the diagnostic is attributable to the deletion. `mutations.test.mjs` shrinks by nine lines, which is what keeps the required `codescene delta` check green.

**Tech Stack:** Node 24/26 (`node:test`, plain `.mjs`), OpenSpec spec-driven changes, bloodtrail design-pattern governance (`check-design-pattern-governance.mjs`, `design-pattern-policy.json`).

---

## Revision note — what changed from the first draft, and why

Five substantive corrections. Each was verified against the code, not assumed.

1. **The edit must not grow `mutations.test.mjs`.** The first draft added a helper plus a test to a 1173-line file that is already a CodeScene hotspot. That exact move has already failed here: adding ~66 lines and three helpers declined its code health 7.91 → 7.22 and failed the required `codescene delta` check on *Lines of Code in a Single File* and *Number of Functions in a Single Module*. Both are file-level rules — no amount of tightening the new function clears them, so the draft's mitigation ("keep the helper under the complexity threshold, ≤4 positional args") addresses the wrong rule. The gate compares against `origin/main`, so the fix that worked before is the fix here: put the control in its own suite and let `mutations.test.mjs` shrink. The directory already does this fourteen times over.

2. **No signed governance record is required — drop the T/S cycle.** `verifyChange` in `review-freshness.mjs` routes a change with no record to `verifyUnsignedChange`, which fails only if reachable history *previously* carried one. Precedent agrees: `2026-08-17-record-validator-packaging-policy` modified `scripts/check-coherence.mjs` and archived with `Signed governance record S — none — by design … the only executable change is two literals in a verification script`; `2026-08-18-cover-bundle-archive-spec-fold` did the same. That deletes Tasks 7–8 of the draft, the "expect N `signed-review-stale` diagnostics" expectation (final phase should be **green**, not red), and the R15 scheduling pressure entirely.

3. **If a record were ever added, it would trip a gate the draft did not know about.** `governance-history-mutations.test.mjs:45` pins `EXPECTED_RECORD_IDS` with `assert.deepEqual`, so a new record must be registered there in the same reviewed technical commit — which is why the `bundle-validator-runtime-helpers` record documents an intentionally-red intermediate state. Avoiding the record avoids that entire trap. Kept below as a warning, not a task.

4. **The draft's negative control was a no-op.** It wrote a file and immediately deleted it, leaving the filesystem byte-identical to having done nothing; `succeeds(...)` then re-asserted the existing positive control at line 157. Replaced with a genuine differential — same committed fixture, the deletion as the only variable — plus a tracked-at-HEAD guard inside the seed helper so a broken seed fails loudly instead of quietly becoming vacuous.

5. **`git checkout -b <name> origin/main` sets the upstream to `main`.** A later bare `git push` then lands on protected `main` with no PR. This has happened in this repository. `git switch -c` behaves identically; only `--no-track` prevents it.

Smaller fixes folded in: the `write()` open question is resolved (it does create parent directories); `validate` runs 20 steps, not 19; the control is at line 213 and the clean-movement positive control at 157; the required `design-pattern-governance` CI job and its three steps were missing from the verification and CI lists.

## Verified facts

Checker behaviour, read at `2b9b229`:

- `mutations.test.mjs:213-221` — the test does `rmSync(resolve(root, "openspec/changes/correct-local-instruction-verification-premise/proposal.md"))` and expects `archive-movement-unrelated-change-deletion`. `prepareControl()` clones the real repository, so the fixture exists only while that change is tracked on `main`. It was already repointed once, by `e5b5814 fix(governance): decouple verification fixtures from the governance change lifecycle`, when `establish-design-pattern-governance` archived. Repointing again is proven-temporary.
- `isUnrelatedActiveDeletion` (`check-changed-paths.mjs:486`) is purely path-based: `status === "D"`, under `openspec/changes/`, not under the remediation active dir, not under `openspec/changes/archive/`. The synthetic change needs no `.openspec.yaml`, no assessment, no tasks — one committed file is sufficient.
- `resolveMovementBaseline` (`:264`) returns `inProgressSource = { revision: "HEAD" }` whenever the active remediation directory is still in HEAD, and `collectMovementChanges` then uses `workingChangesAgainst("HEAD")`. **The synthetic file must therefore be committed in the disposable clone before it is deleted**, and the active directory must be removed from the working tree only, never committed as deleted.
- Movement violations accumulate in `movementViolations` and are thrown together at the end of `validateArchiveMovement` (`:229`). A fixture that is not a byte-exact movement still reports the unrelated-deletion diagnostic alongside the others — which is what lets the new suite use a cheap fixture and assert on the diagnostic's presence/absence rather than on exit status.
- A committed extra directory under `openspec/changes/` trips nothing else: `trackedChanges(base)` classifies it `unrelated-history-or-worktree`, and none of the violation branches in the records loop match it.
- `check-scope.mjs` walks only `src/`, so a new file under `tests/verification/` is outside its filename and import rules. `sdkSourcePrefixes` is `src/` + `lib/` only, so `test:changed-paths` does not require a `reviewedNewSdkSourcePaths` entry for it. No document enumerates the verification suites, so adding one needs no doc update.

Governance, read at `2b9b229`:

- `governedPatterns()` includes the raw `governed_implementation` + `governance_core` patterns and excludes only `planning_artifact_patterns`. So **both** test files are governed implementation paths (`packages/` matches), while `proposal.md` / `assessment.json` / `tasks.md` / `.openspec.yaml` under a change directory are excluded — the proposal commit introduces no governed path.
- `packages/security-audit-sdk-core/verification-lifecycle.json` is classed `governance_record_only`, but `governedPatterns()` does not subtract that class, so it *also* matches `packages/` and would need explicit `owned_paths` coverage if touched. Not touching it avoids the question.
- `checkOpenSpecAssociation` builds `covered` as a union over every active change with a non-empty `applicability.capabilities`. The keeper `cover-local-instruction-control-paths` already owns `mutations.test.mjs`, so overlap is harmless — but it does **not** own the new suite file, which this change's own assessment must therefore list.
- `checkGrandfatheredScopes` judges a grandfathered change by the paths *its own assessment* owns. `correct-local-instruction-verification-premise` has no `assessment.json`, so `ownedPathsFor` falls back to `openspec/changes/correct-local-instruction-verification-premise/`. This change touches nothing there, so no scope-expansion trigger fires — its `bounded_paths` are a ceiling on what it may touch, never a grant to anyone else.
- Correction task 6.6 requires the decoupling to happen "in a separate change first". That is the governing instruction; the keeper is not an eligible vehicle, since its own assessment states it "only holds a capability declaration open".
- `design-pattern-governance` is a required check (`activation-record.json` `verified_contexts`) and runs three steps: `--phase final`, `run-governance-dual-check.mjs --base <base sha>`, and `node --test openspec/tests/design-pattern-governance/*.test.mjs`.
- `openspec validate --all --strict` and `check-design-pattern-governance --phase final` are both green on `main` today.

## Proposed approach

1. New branch off `origin/main` with **no upstream tracking**.
2. New OpenSpec change `self-sufficient-archive-movement-fixture` — `.openspec.yaml` (`skip_specs: true`), `proposal.md`, `assessment.json`, `tasks.md`. No spec delta: no requirement of `security-audit-sdk-core` changes.
3. Move the control into a new dedicated suite with a self-seeding fixture, a null arm, and a seed guard; delete it from `mutations.test.mjs`.
4. Full verification, PR, independent review, owner merge, archive. No signed governance record.

## Step-by-step plan

### Task 1: Branch and identity freeze

**Objective:** Start from a clean, verified `main`, on a branch that cannot push to it.

```bash
git status -sb                       # expect: ## main...origin/main, clean
git fetch origin main
git rev-parse origin/main            # 2b9b2297e3665b6f513eb9f85b522f556e61f24b at plan time — re-check
git switch -c --no-track test/self-sufficient-archive-movement-fixture origin/main
git rev-parse --abbrev-ref '@{upstream}'   # MUST fail (no upstream). Never origin/main.
```

`--no-track` is mandatory. An explicit remote-tracking start point sets `branch.<name>.merge = refs/heads/main` regardless of whether `checkout -b` or `switch -c` created the branch, and `push.autoSetupRemote` does not override it. If the upstream resolves to `origin/main`, run `git branch --unset-upstream` before doing anything else. Record the full `origin/main` sha — it is the assessment's `proposal_baseline_commit`. If `origin/main` has moved past `2b9b229`, branch from the new tip and use that sha.

### Task 2: Author the OpenSpec change artifacts

**Files (all new):** `openspec/changes/self-sufficient-archive-movement-fixture/{.openspec.yaml,proposal.md,assessment.json,tasks.md}`

**Step 1 — `.openspec.yaml`,** mirroring the keeper:

```yaml
schema: spec-driven
created: 2026-08-19
skip_specs: true
```

`skip_specs: true` is required: without it `openspec validate --strict` errors `CHANGE_NO_DELTAS`. It conflicts if `specs/` holds any file, so do not create one.

**Step 2 — `proposal.md`** — Why / What Changes / Capabilities (none added, none modified) / Impact:

- Why: `mutations.test.mjs:213` uses the correction change's active directory as the `archive-movement-unrelated-deletion` fixture; archiving the correction removes it. Already repointed once (`e5b5814`). The dependency is structural — `prepareControl()` clones the live repository, so the control inherits whatever the repository's change lifecycle happens to hold.
- What: relocate the control to its own suite, where it seeds and commits its own unrelated change inside the disposable clone; add a same-fixture null arm. State plainly that the relocation is also what keeps `codescene delta` green, citing the file-level rules.
- Non-goals: does not archive or modify the correction or the keeper; does not change `check-changed-paths.mjs`, any classification rule, or any diagnostic id; adds no governance record; does not track a root `CLAUDE.md`/`AGENTS.md`; grants no production or publication authorization.

**Step 3 — `assessment.json`.** Model on the keeper's, which is the closest valid example. Required shape:

- `schema_version: "1.1"`, `change_id: "self-sufficient-archive-movement-fixture"`, `assessment_level: "abbreviated"`, `decision: "direct_implementation"`.
- `applicability`: `triggers_matched: []`, a `full_trigger_absence_proof` of 40–1000 chars, `material_capability_modification: false`, `capabilities: ["security-audit-sdk-core"]`.
- `owned_paths` — **exact file paths, no directory prefixes**, because an active change's `owned_paths` grants association coverage to every later PR whose paths fall inside it:
  - `packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs`
  - `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs`
- `candidate_approaches` — the selected `direct_implementation` plus alternatives; every id `^approach-[a-z0-9][a-z0-9-]{2,79}$`. Rejected alternatives to record:
  - repoint at the keeper — the same defect one cycle later, since the keeper archives after the correction;
  - grow `mutations.test.mjs` in place — fails the required `codescene delta` on file-level rules;
  - let the correction make the edit — exceeds its grandfathered bounded scope, and its task 6.6 requires a separate change.
- `rejected_alternative_ids` (≥1) and a `rejection_reasons` entry for each, force-based.
- `selected_pattern_ids: []` and no `catalog_binding` — both are rejected for `direct_implementation`.
- `implementation_invariant_ids` — author-coined under the `implementation-` prefix, not looked up in the registry; e.g. `implementation-unrelated-deletion-fixture-self-seeded`. Each needs an `invariant_evidence` entry with non-empty `task_ids` and `evidence_ids`.
- `security_sensitive: false` — this then requires `security_justification` with **all 15** dimensions, each 20–600 chars, no extra keys: `audit_integrity`, `authentication_or_authorization`, `authority_provenance`, `concurrency`, `confidentiality`, `cryptography`, `error_disclosure`, `external_security_integration`, `fail_posture`, `lifecycle`, `mutation_ownership`, `privacy_transformation`, `resource_retention`, `retry_or_redelivery`, `trust_boundary`.
- `ordering: { "proposal_baseline_commit": "<40-hex origin/main sha from Task 1>" }` — nothing else. `assessment_commit` is optional, and omitting it stops ordering verification after the baseline resolves; supplying it pulls in `assessment-shares-implementation-commit` and the ancestry chain for no benefit here.
- `verification_task_ids` — the task ids that discharge the invariants.

**Step 4 — `tasks.md`** — groups: 1. Proposal validation; 2. Implementation (new suite, removal from `mutations.test.mjs`); 3. Verification (single file, full SDK chain, contract chain, governance phases); 4. Review and merge; 5. Archive. Include an explicit task: *confirm no edit to `scripts/check-changed-paths.mjs`, its classification rules, or any diagnostic id*. Task groups must complete in order; merge and archive tasks stay unchecked while the change is active.

**Step 5 — verify before committing** (both read-only, both catch the schema traps in seconds):

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change self-sufficient-archive-movement-fixture
openspec validate self-sufficient-archive-movement-fixture --strict
openspec validate --all --strict
```

**Step 6 — proposal commit** (separate from implementation):

```bash
git add openspec/changes/self-sufficient-archive-movement-fixture/
git commit -m "docs(openspec): propose self-sufficient archive movement fixture"
```

### Task 3: Write the new verification suite

**Objective:** One dedicated file holding the relocated control, its fixture, and its null arm.

**File (new):** `packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs`

Model the harness on `local-instruction-classification.test.mjs` — it is the lightest example in the directory and was written for exactly this kind of control. `vp-reviewed-paths.test.mjs` is the other reference. Do **not** copy `mutations.test.mjs`'s `archivedCaseRepository`: its 88-task reconciliation and canonical-capability synchronization exist to make the movement byte-exact, which these arms do not need.

Shape:

```js
const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-archive-movement-unrelated-"));
const controlRoot = resolve(suiteRoot, "control");
const remediation = lifecycleMetadata.remediationChange;
const archiveDestination = `openspec/changes/archive/2099-01-02-${remediation.name}`;
const syntheticChange = "openspec/changes/synthetic-unrelated-active-change";
const diagnostic = "archive-movement-unrelated-change-deletion";
```

`prepareControl()` clones the repository with full history (the checker needs the proposal baseline to be an ancestor of HEAD), overlays the live package with `cpSync` minus `node_modules`/`dist*`/`.verification-output`, and commits with `--allow-empty`. `caseRepository(name)` clones the control per case. Both are ~6 lines each in the model file.

The fixture puts the repository in the in-progress archive state the checker recognises as `rederived`:

```js
function archiveInProgressRepository(name) {
  const root = caseRepository(name);
  seedSyntheticUnrelatedChange(root);
  cpSync(resolve(root, remediation.active), resolve(root, archiveDestination), { recursive: true });
  rmSync(resolve(root, remediation.active), { recursive: true, force: true });
  return root;
}
```

The active directory is removed from the **working tree only**. It must stay in HEAD, or `resolveMovementBaseline` leaves the re-derived path and the unrelated-change scan never runs.

The seed helper commits, and guards that it did:

```js
function seedSyntheticUnrelatedChange(root) {
  write(root, `${syntheticChange}/proposal.md`, "## Why\n\nSynthetic fixture: an unrelated active change no real archive can remove.\n");
  git(root, ["add", syntheticChange]);
  git(root, ["commit", "-m", "test: synthetic unrelated active change"]);
  // Load-bearing: only a tracked file can produce the "D" record the rule matches.
  git(root, ["ls-files", "--error-unmatch", `${syntheticChange}/proposal.md`]);
}
```

The `ls-files --error-unmatch` line is what stops this control from silently degrading into a no-op if a later refactor drops the commit — `git()` asserts a zero exit. Reuse the model file's `write()` and `git()` helpers; `write()` creates parent directories, so no separate `mkdirSync` is needed.

`runChecker(root)` returns `{ status, text }` rather than asserting success — both arms need to inspect output regardless of exit status. Invoke it as the moved control did, with `--mode archived` and `SDK_VERIFICATION_CHANGE=remediate-security-audit-sdk-adversarial-review`, so the relocated control keeps its exact invocation.

Two arms:

```js
test("archive movement rejects deletion from an unrelated active change", () => {
  const root = archiveInProgressRepository("unrelated-deletion");
  rmSync(resolve(root, syntheticChange, "proposal.md"));
  const run = runChecker(root);
  assert.notEqual(run.status, 0, "the checker accepted a deletion from an unrelated active change");
  assert.match(run.text, new RegExp(diagnostic));
});

test("the same fixture left intact raises no unrelated-change deletion", () => {
  const root = archiveInProgressRepository("unrelated-intact");
  assert.doesNotMatch(runChecker(root).text, new RegExp(diagnostic),
    "the diagnostic is not attributable to the deletion");
});
```

The two arms differ in exactly one way — whether the committed synthetic file is deleted — which is what makes the second arm evidence rather than decoration. It deliberately asserts on the diagnostic's absence, not on exit status: this cheap fixture is not a byte-exact movement, so the run reports other movement diagnostics, and the claim under test is attributability. Making it a clean `exit 0` would mean duplicating `archivedCaseRepository` wholesale; not worth it.

Keep every function small and single-purpose — the new file is new code and CodeScene scores it.

### Task 4: Remove the control from `mutations.test.mjs`

**File:** `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs:213-221`

Delete the whole `test("archive movement rejects deletion from an unrelated active change", …)` block, including its four-line comment about the grandfathered change being "the stable fixture" — that comment is now false. The file loses nine lines and one test; that shrink is what keeps `codescene delta` green.

Leave the neighbouring tests untouched: `archive-movement-active-remnant` above and `archive-movement-unrelated-archive` below both still belong here, on `archivedCaseRepository`'s exact-movement fixture.

**Verify the last lifecycle dependency is gone:**

```bash
grep -rn "correct-local-instruction-verification-premise" packages/security-audit-sdk-core/ openspec/tests/
```

Expect no matches. (Matches under `openspec/governance/` are the grandfathering record and are expected; matches under `openspec/changes/` proposal prose are fine.)

### Task 5: Run the two suites

```bash
node --test packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs
node --test packages/security-audit-sdk-core/tests/verification/mutations.test.mjs
```

Expect both to pass. If the first arm reports no diagnostic, check in this order: was the synthetic file committed (the guard should have caught it); is the active remediation directory still present in HEAD; did `resolveVerificationLifecycle` resolve archived mode at all (a cardinality error surfaces as `archive-movement-wrong-archive-path` or `archive-movement-multiple-destinations` instead).

Both suites write only inside their own `mkdtemp` roots. A verification test that writes to the live tree corrupts sibling test files, which snapshot the live package in parallel — never relax that.

### Task 6: Full verification with an empty index

```bash
git status --porcelain                      # only the intended files
npm run test:verification --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate --all --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase final
node openspec/scripts/run-governance-dual-check.mjs
node --test openspec/tests/design-pattern-governance/*.test.mjs
```

Expected: everything green, including `--phase final`. **This is a change from the previous draft** — with no governance record for this change, `verifyUnsignedChange` returns silently and there is no `signed-review-stale` to expect. A red final phase here is a real problem, not an expected intermediate state.

`validate` runs 20 steps and `test:git` requires an empty Git index, so run it before `git add` (or after committing), never with staged changes. `test:git` also rejects any CR byte, any trailing whitespace, and any missing final newline in every file changed since the baseline — including the new `.md` and `.json` files from Task 2. Run gates bare; never pipe through `tail` or `head`.

### Task 7: Implementation commit, PR, review

```bash
git add packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs \
        packages/security-audit-sdk-core/tests/verification/mutations.test.mjs
git commit -m "test(verification): self-seed the unrelated active change fixture"
git push -u origin test/self-sufficient-archive-movement-fixture
gh pr create --repo nandohdc/bloodtrail --title "test(verification): self-seed the unrelated active change fixture" --body "..."
```

Stage an explicit allowlist; leave unrelated untracked files alone (the plan file in `.hermes/plans/` stays untracked). Separate commits for proposal and implementation — never mixed. Conventional Commits are validated on the PR title *and every commit subject*.

The PR body should state that the change carries **no signed governance record by design**, citing `2026-08-17-record-validator-packaging-policy` and `2026-08-18-cover-bundle-archive-spec-fold`, and that `--phase final` is green — so a reviewer does not go looking for a missing record.

**HUMAN GATE:** independent technical review of the exact implementation commit, then the owner's explicit exact-commit decision. Test success is not review, and agent analysis is not review. Bind the review to the full commit sha.

### Task 8: CI and merge

Required to merge: `ci / lint|test|audit`, `sdk`, `contract`, `sonar`, `conventional-commits`, `codescene delta`, `design-pattern-governance`. Not required: `coverage`, the CodeScene App's own Check Run, `release-please`.

Select the `ci` workflow run by workflowName + headSha (not the `conventional-commits` run), then re-query `gh pr checks` and `gh pr view` for authoritative state.

- `codescene delta` is the one to watch. It runs `cs delta origin/<base_ref> --error-on-warnings`, so it can genuinely fail; the local `cs` CLI cannot substitute (`CS_ACCESS_TOKEN` is CI-only). A finding on reviewed code forces a fresh review cycle. If it still reports a decline on `mutations.test.mjs` despite the removal, do not tighten the new file — check that the removal actually landed and that the file is shorter than on `origin/main`.
- A red `sonar` is more often the self-hosted server than the code; the job retries once and prints the failing conditions.

**HUMAN GATE:** the owner merges (identity-preserving two-parent merge). The agent never merges.

```bash
git fetch origin main
gh pr view <N> --repo nandohdc/bloodtrail --json mergeCommit,mergedAt,mergedBy
git checkout main && git merge --ff-only origin/main
```

### Task 9: Archive the change

**Objective:** Archive `self-sufficient-archive-movement-fixture` as a pure relocation — no specs delta, so no spec-fold coverage is needed and there is no recursion.

- Use the `openspec-archive-change` skill. The archive commit is a **separate commit on a new branch** (`docs/archive-self-sufficient-archive-movement-fixture`) with its own PR.
- Include an `archive-evidence.md`, following `openspec/changes/archive/2026-08-18-cover-bundle-archive-spec-fold/archive-evidence.md`: identity table (proposal commit P, technical commit T, merge commit M and its two parents, reachability), task completeness with evidence per task, and an explicit **`Signed governance record S — none — by design`** row stating that review-freshness applies only to changes carrying records and that `governanceRecords` holds records only for the four archived implementation changes.
- `verification-lifecycle.json` is **not** touched: `movementAttestations` covers only the remediation change's archive.
- After the archive merges: `openspec validate --all --strict`, the full SDK `validate`, then delete the branches (local and remote) on owner instruction.

### Task 10: Report downstream state (no execution)

After the archive lands, report — do not act on:

- Correction task 6.6 is now satisfiable; the correction's archive (6.4) remains gated on 6.2 (independent review) and 6.3 (owner decision), both human, and on 6.5 (keeper alive — it is).
- The keeper's archive (its task 2.2) follows the correction's archive.
- The root `CLAUDE.md`/`AGENTS.md` tracking question remains a separate, unauthorized decision.

## Files likely to change

- `packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs` — new suite.
- `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` — the only pre-existing file touched; nine lines and one test removed.
- `openspec/changes/self-sufficient-archive-movement-fixture/{.openspec.yaml,proposal.md,assessment.json,tasks.md}` — new.
- Later, archive commit: `openspec/changes/archive/<date>-self-sufficient-archive-movement-fixture/` relocation plus `archive-evidence.md`.

Explicitly NOT touched: `scripts/check-changed-paths.mjs`, any classification rule or diagnostic id, `verification-lifecycle.json`, `governance-history-mutations.test.mjs`, the correction change, the keeper change, SDK source, generated artifacts, contract artifacts, `openspec/governance/`.

## Tests / validation

- `node --test packages/security-audit-sdk-core/tests/verification/archive-movement-unrelated-change.test.mjs` — fast loop.
- `node --test packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` — the file the control left.
- `npm run test:verification --prefix packages/security-audit-sdk-core` — full mutation/evidence suite.
- `npm run validate --prefix packages/security-audit-sdk-core` — 20 steps, empty index.
- `npm run validate --prefix contracts/security-audit`.
- `openspec validate --all --strict`; `check-design-pattern-governance.mjs --phase assessment` then `--phase final`; `run-governance-dual-check.mjs`; `node --test openspec/tests/design-pattern-governance/*.test.mjs`.
- CI: all required checks green, `codescene delta` in particular.

## Risks, tradeoffs, and open questions

- **CodeScene, still the main risk.** The relocation is modelled on the one that worked, but the new file is new code and is scored on its own. Keep it short and its functions small. If the delta still reports a decline, diagnose before editing — check that the removal landed and that `mutations.test.mjs` is genuinely shorter than on `origin/main`.
- **If the checker ever demands a signed record.** The evidence says it will not. If `--phase final` unexpectedly asks for one, stop: adding a record also requires registering the change id in `EXPECTED_RECORD_IDS` (and its reviewed paths in `MINIMUM_REVIEWED_PATHS`) in `governance-history-mutations.test.mjs` **within the reviewed technical commit**, because a record-only commit cannot change a governed implementation path. That change also adds `governance-history-mutations.test.mjs` and `verification-lifecycle.json` to `owned_paths`, and makes the SDK chain red by construction until the record lands. Re-plan rather than improvising it.
- **Owned-paths overlap with the keeper.** Both will own `mutations.test.mjs`. `checkOpenSpecAssociation` unions the covered set, so overlap is accepted — verify at `--phase assessment` in Task 2 before writing any code.
- **Fixture cheapness.** The new fixture is not a byte-exact movement, so its runs report other movement diagnostics. Both arms are written to be indifferent to that: the first asserts a nonzero exit plus the diagnostic, the second asserts the diagnostic's absence. Do not "fix" this by asserting exit 0 without first porting `archivedCaseRepository` in full.
- **Synthetic change name.** `synthetic-unrelated-active-change` must not collide with a real change id and must stay outside `openspec/changes/archive/`, or `isUnrelatedActiveDeletion` stops matching.
- **This plan file.** It lives in `.hermes/plans/`, classified `documentation_only`. If it is ever committed, `checkHiddenImplementation` scans added lines for `export function` / `export class` / `export const x = (`; the snippets above deliberately avoid all three. Keep it untracked and keep it free of trailing whitespace — `test:git` scans untracked files too.
