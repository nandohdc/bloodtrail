# PR #157 R15 Recovery and Activation Implementation Plan

> **For Hermes:** Use subagent-driven-development to execute this plan task-by-task, and load `software-delivery/openspec-governed-change-lifecycle`, `software-development/test-driven-development`, `software-development/requesting-code-review`, and `github/github-pr-workflow` before acting.

**Goal:** Correct the remaining fail-open governance defects on PR #157, freeze and re-sign an exact replacement technical candidate, land it without rewriting identities, activate governance in a dedicated direct-child commit, and stop with an evidence-backed canonicalization/archive readiness report.

**Architecture:** Add a repository-history review-freshness verifier to the existing dependency-free OpenSpec checker. It will locate the current signed record for each active change, derive the commit that introduced that exact record, and reject any normative commit after the bound technical commit while permitting only the closed governance-record-only paths. Narrow the Hermes documentation exception to `.hermes/plans/`, strengthen the independent governance-history mutation inventory, then use the replacement sequence `T_NEW → S_NEW → M → A`. Preserve historical `T_OLD` and `S_OLD`; never amend, squash, rebase, or force-push them.

**Tech Stack:** Node.js 26 ESM, dependency-free Git plumbing, OpenSpec, Node test runner with disposable Git repositories, npm workspace validation, Git/GitHub CLI and branch-protection API.

---

## Current exact baseline

This plan was prepared against:

- Repository: `nandohdc/bloodtrail`.
- PR: `#157`, `feat/design-pattern-governance` → `main`.
- Exact local/tracking/live PR head: `6c2269c459a3fc16ae54d92fda69100fe5f9204f`.
- `origin/main`: `d22d6b74702a491d86ca4643fe73a682aea59cb3`.
- Historical technical commit: `T_OLD = 4f1ee3b544add8d991b3b6a0822dbe9e2028086d`.
- Historical signed-record commit: `S_OLD = f53a07115e91da1fc4f0ae7469d5899b1bd5afa4`.
- PR commit count at plan time: 9.
- PR graph state at plan time: open, non-draft, `MERGEABLE` / `CLEAN`.
- All nine required contexts currently pass, including `design-pattern-governance` and `codescene delta`.
- Branch protection has strict required checks, no pull-request-review requirement, no linear-history requirement, force pushes disabled, and administrators not enforced.
- DeepScan is currently green; its earlier three opaque advisory findings are no longer current.
- The PR description is stale: it still says two commits, pending acknowledgement, no required governance check, and verification at `c571927`.
- No `M`, `A`, canonicalization commit, or archive commit exists.

The new plan file is planning evidence only. Keep it untracked and excluded from implementation staging unless the owner separately chooses to include it.

## Confirmed blockers

1. `S_OLD` is stale. Every content subtree it bound differs at the current head.
2. R15 is specified but not enforced: current required CI passes despite post-signing normative changes.
3. `openspec/governance/design-pattern-policy.json` classifies all `.hermes/` paths as `documentation_only`; executable/configuration/instruction paths can therefore evade the perimeter.
4. `governance-history-mutations.test.mjs` derives expectations from the mutable manifest. Removing the entire `establish-design-pattern-governance` record still leaves the suite green.
5. The PR body contradicts current lifecycle evidence.
6. Replacement `T_NEW`, owner approval, `S_NEW`, `M`, and `A` do not exist.
7. Canonicalization and archive remain expressly withheld by the historical record and are outside this plan's execution boundary.

## Non-negotiable boundaries

1. Do not alter, amend, replace, or force-push `T_OLD` or `S_OLD`; they remain historical evidence.
2. Do not treat green CI, AI review, PR authorship, or project ownership as the fresh explicit approval for `T_NEW`.
3. Do not weaken the definition of normative content. Assessment/design, policy, checker, schemas, catalog, workflows/CI, and invariant tests remain normative.
4. Do not make `.hermes/` broadly benign. Only `.hermes/plans/` receives the requested documentation classification.
5. Do not hand-edit generated contract or SDK output. No production transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, audit chaining, publication, deployment, or real-user processing is authorized.
6. Once `T_NEW` is semantically verified, preserve it byte-for-byte. Once exact `S_NEW` is preflighted, preserve it byte-for-byte. Stage explicit allowlists only.
7. Do not merge unless the live PR head is exactly `S_NEW`, all required checks on that SHA pass, branch protection is unchanged, and `origin/main` is the expected base.
8. Merge PR #157 only with merge-commit mode and `--match-head-commit`; never squash, rebase, auto-merge ambiguously, amend, or force-push.
9. Create `A` on a dedicated activation branch from exact `M`. Land exact `A` by a non-force fast-forward only after required checks have passed on that exact commit.
10. Stop after activation verification and the readiness report. Do not canonicalize or archive under this plan.

---

### Task 1: Re-freeze the live recovery baseline

**Objective:** Ensure implementation starts from the exact state this plan inspected and preserve evidence before any edit.

**Files:**
- Modify: none
- Inspect: Git refs, PR #157, branch protection, required/advisory checks, PR body

**Step 1: Re-read repository instructions**

Read `.hermes.md` and the governed OpenSpec lifecycle skill before touching files.

**Step 2: Re-fetch and prove identities**

Run:

```bash
git fetch origin --prune
git branch --show-current
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD
git rev-parse origin/feat/design-pattern-governance
git rev-parse origin/main
gh pr view 157 --repo nandohdc/bloodtrail --json state,isDraft,headRefOid,baseRefName,mergeable,mergeStateStatus
```

Expected: branch is `feat/design-pattern-governance`; local, tracking, and PR head are identical. The only acceptable untracked path is this requested plan unless the owner has added something else. Stop and re-plan if the PR head moved.

**Step 3: Capture live protection and checks as temporary external evidence**

Run the branch-protection API, `gh pr checks 157 --required`, and the complete check rollup. Store exact API bytes outside the repository and hash them with SHA-256.

Expected: strict mode and the same nine required contexts. Classify CodeScene Cloud and DeepScan separately from required checks.

**Step 4: Do not commit**

This task is read-only.

---

### Task 2: Narrow the Hermes path classification with perimeter regressions

**Objective:** Admit landing plans without granting documentation-only treatment to arbitrary Hermes scripts, configuration, skills, hooks, or instructions.

**Files:**
- Modify: `openspec/governance/design-pattern-policy.json:138-146`
- Modify: `openspec/tests/design-pattern-governance/perimeter.test.mjs`
- Inspect: `openspec/scripts/design-pattern-governance/perimeter.mjs:19-57,119-136`

**Step 1: RED — prove the current blanket rule is unsafe**

Add focused disposable-repository tests that assert:

- `.hermes/plans/example.md` classifies as `documentation_only` and does not trigger `unclassified-path`.
- `.hermes/config.yaml` does not inherit `documentation_only` and is rejected.
- `.hermes/scripts/check.mjs` does not inherit `documentation_only` and is rejected.
- `.hermes/skills/example/SKILL.md` does not inherit `documentation_only` and is rejected.
- `.hermes/hooks/preflight.sh` containing executable behavior is not accepted as documentation.

Run:

```bash
node --test openspec/tests/design-pattern-governance/perimeter.test.mjs
```

Expected RED: at least the negative sibling cases pass unexpectedly under the current `.hermes/` prefix.

**Step 2: GREEN — make the smallest policy correction**

In the `documentation_only` class, replace:

```json
".hermes/"
```

with:

```json
".hermes/plans/"
```

Do not add benign classifications for sibling Hermes paths. Let unmatched sibling content fail closed through the existing unclassified-path control.

**Step 3: Verify GREEN**

Re-run the targeted perimeter file. Expected: every new positive and negative case passes, with exact diagnostic assertions rather than a generic nonzero exit.

**Step 4: Preserve scope**

Do not broaden hidden-implementation heuristics merely to compensate for a broad classification. The classification itself is the defect.

---

### Task 3: Define and validate the signed-record source in policy

**Objective:** Give the OpenSpec governance checker one explicit, fail-closed source for active signed governance records without hardcoding an undocumented repository path.

**Files:**
- Modify: `openspec/governance/design-pattern-policy.json`
- Modify: `openspec/scripts/design-pattern-governance/policy.mjs:17-39,225-320`
- Modify: `openspec/tests/design-pattern-governance/policy.test.mjs`
- Modify: `openspec/tests/design-pattern-governance/support/disposable-repo.mjs`

**Step 1: RED — add malformed/missing source tests**

Add policy tests requiring a top-level object:

```json
"review_freshness": {
  "record_path": "packages/security-audit-sdk-core/verification-lifecycle.json"
}
```

Test exact failures for:

- missing `review_freshness`;
- missing/empty/malformed/traversing `record_path`;
- a record path not included by `governance_record_only_paths`;
- absent, empty, invalid-JSON, or wrong-shaped record source when signed-history verification is requested.

Expected RED: the current policy loader ignores or does not understand this section.

**Step 2: GREEN — add the minimal policy contract**

Add `review_freshness` to `REQUIRED_TOP_LEVEL`. Validate `record_path` with the existing repository-path rules and require it to be covered by the closed `governance_record_only_paths` allowlist. Do not generalize collection names: the canonical manifest field remains `governanceRecords`.

**Step 3: Seed existing disposable fixtures safely**

Update `createRepository()` to write a minimal canonical manifest with `governanceRecords: []`. Do not copy the live manifest, because its real commit bindings are invalid inside throwaway repositories.

Fixtures with no current or historical signed record must continue to represent the legitimate pre-signing technical state.

**Step 4: Verify**

Run:

```bash
node --test openspec/tests/design-pattern-governance/policy.test.mjs
```

Expected: exact new policy diagnostics pass and existing policy behavior remains green.

---

### Task 4: Implement fail-closed R15 review freshness using strict TDD

**Objective:** Make post-signing normative changes fail required governance verification while allowing only the closed governance-record-only path set.

**Files:**
- Create: `openspec/scripts/design-pattern-governance/review-freshness.mjs`
- Create: `openspec/tests/design-pattern-governance/review-freshness.test.mjs`
- Modify: `openspec/scripts/check-design-pattern-governance.mjs:27-63,130-185`
- Modify only if necessary: `openspec/scripts/design-pattern-governance/git.mjs:117-141`
- Reuse: `touchesNormativePath()` and `isGovernanceRecordOnly()` from `perimeter.mjs`

**Required public entry point:**

```js
verifySignedReviewFreshness({ changeIds, repositoryRoot, cwd, policy, sink })
```

Keep record parsing, history derivation, and diagnostic emission inside the new module. Do not couple this repository-wide control to SDK runtime code.

**Required stable diagnostics:**

- `signed-record-source-absent`
- `signed-record-source-invalid`
- `signed-record-ambiguous`
- `signed-record-removed`
- `signed-record-uncommitted`
- `signed-review-history-unavailable`
- `signed-review-stale`

Use the existing bounded/sorted diagnostic sink; each test must assert the exact ID and relevant path/commit text.

**Step 1: RED→GREEN — reject a normative policy commit after S**

Build a disposable sequence:

1. seed a pre-sign state;
2. create technical commit `T_FIXTURE`;
3. commit one exact signed record binding `T_FIXTURE` and its content objects as `S_FIXTURE`;
4. modify `openspec/governance/design-pattern-policy.json` in a later commit.

First run must pass before step 4 and currently passes after step 4. Add the failing test, observe RED, then implement only enough history traversal to produce `signed-review-stale`.

The algorithm must:

1. read the current active change IDs from discovered assessments;
2. parse the configured manifest;
3. require at most one current signed record per active change;
4. resolve `reviewedCommit` as exact `T` and require it to be an ancestor of `HEAD`;
5. find the first reachable commit after T where the current exact target record object appears — this is S;
6. require S to alter only governance-record-only paths;
7. inspect every commit in `T..HEAD`, including merge-parent diffs, and reject the first commit/path for which `touchesNormativePath()` is true;
8. permit commits whose complete changed-path set is governance-record-only.

Do not infer freshness from current path classification alone, commit messages, task checkboxes, or PR state.

**Step 2: RED→GREEN — allow governance-record-only commits after S**

Add a commit after S that changes only `packages/security-audit-sdk-core/verification-lifecycle.json` or `openspec/governance/records/`. It must pass freshness validation.

**Step 3: RED→GREEN — cover every discovered stale class**

Add one isolated test each for post-S changes to:

- `assessment.json`;
- checker implementation;
- governance tests/invariant evidence;
- policy/schema/catalog class;
- workflow/CI;
- a new normative path outside the original reviewed-content entries.

Each must fail with `signed-review-stale` and name the offending commit and path.

**Step 4: RED→GREEN — renewed T/S becomes valid**

From a stale fixture, treat the normative head as `T_REPLACEMENT`, replace the canonical record with a freshly signed binding in a record-only direct child `S_REPLACEMENT`, and prove validation passes. Also assert `S_REPLACEMENT^ == T_REPLACEMENT` in the fixture.

**Step 5: RED→GREEN — removed/narrowed/ambiguous records fail**

Cover:

- deleting a previously present signed record;
- replacing a signed record with an unsigned object;
- duplicating the active change's signed record;
- narrowing reviewed content while claiming the old reviewed commit;
- current record bytes that exist only in the working tree and no commit.

A never-signed fixture may remain technically valid; a history that previously carried a signed record may not silently become never-signed.

**Step 6: RED→GREEN — incomplete Git history fails closed**

Add a shallow-history fixture and an unresolvable T/S fixture. Require `signed-review-history-unavailable`, never a skip or warning.

**Step 7: Handle merge commits correctly**

If the existing `pathsChangedByCommit()` cannot enumerate merge-parent differences, add one read-only Git helper using `diff-tree -m`, normalize/deduplicate paths, and test it. Do not add any mutating Git subcommand.

**Step 8: Wire the verifier into final enforcement**

Call review-freshness validation from `runFinalChecks()` for every active assessment/change. Preserve assessment and implementation phases for technical debugging; required CI continues to use final phase and therefore fails while the old signed record is stale.

**Step 9: Verify the focused file**

Run:

```bash
node --test openspec/tests/design-pattern-governance/review-freshness.test.mjs
```

Expected: all new R15 scenarios pass with nonzero discovery.

---

### Task 5: Strengthen governance-history mutation inventory independently

**Objective:** Prevent deletion of a complete record or narrowing of its binding from normalizing the test's expected totals.

**Files:**
- Modify: `packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs:23-38,46-52`
- Inspect, but do not change unless a real production defect is demonstrated: `packages/security-audit-sdk-core/scripts/check-governance-history.mjs`

**Step 1: RED — add a static expected inventory**

Define an independent, immutable test inventory for the three current record IDs:

- `implement-security-audit-sdk-core`;
- `right-size-change-governance`;
- `establish-design-pattern-governance`.

For content-bound records, declare the minimum expected reviewed paths explicitly. For `establish-design-pattern-governance`, the minimum starts with the four historically signed paths:

- `openspec/changes/establish-design-pattern-governance`;
- `openspec/governance`;
- `openspec/scripts`;
- `openspec/tests/design-pattern-governance`.

Do not derive this inventory from `verification-lifecycle.json`.

**Step 2: RED — reproduce both bypasses**

In disposable cases:

- remove the entire `establish-design-pattern-governance` record;
- remove one required reviewed-content entry.

Expected before the fix: the current dynamic aggregate checks remain green.

**Step 3: GREEN — assert inventory before aggregate totals**

Add an assertion helper that reads each case repository's manifest and requires:

- the exact expected record IDs;
- exactly one record per expected ID;
- every minimum reviewed path for that record;
- no duplicate reviewed path.

Retain dynamic aggregate count assertions for their original purpose; do not let them serve as inventory.

**Step 4: Verify mutation assurance**

Run:

```bash
node --test packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs
```

Expected: unmutated control passes; record removal and binding narrowing are rejected by the explicit inventory; all existing mutations remain green.

If the production checker itself still accepts a state that R15 says must fail for the active change, fix that in Task 4 rather than hardcoding active OpenSpec policy into the generic SDK history checker.

---

### Task 6: Reconcile assessment and evidence without changing requirements

**Objective:** Make current normative evidence truthfully describe the repaired controls and actual current tool state.

**Files:**
- Modify through the governed OpenSpec apply/update workflow: `openspec/changes/establish-design-pattern-governance/assessment.json`
- Modify through the governed OpenSpec apply/update workflow: `openspec/changes/establish-design-pattern-governance/evidence-packet.md`
- Do not modify: R15 requirement text unless implementation proves an actual spec ambiguity
- Do not check post-T lifecycle tasks in `tasks.md`

**Step 1: Update only evidence affected by the repair**

Update invariant/test mappings to include the new review-freshness and perimeter controls. Record the independent inventory regression and the exact stable diagnostics.

**Step 2: Remove stale external-analysis claims**

Replace the obsolete DeepScan three-issue divergence with the exact current status, without claiming DeepScan approval or assurance. Keep CodeScene required and Cloud results distinct.

**Step 3: Recompute only counts that actually changed**

Update executable test totals from real output after Tasks 2–5. Do not alter the normative 24-requirement/129-scenario counts unless the spec itself changes.

**Step 4: Preserve task-state integrity**

Tasks 5.8 and 6.8 are already checked; the repair makes their evidence true. Do not edit groups 9 or 10 before their operations occur, and do not edit `tasks.md` after signing merely to reflect lifecycle progress. Record later lifecycle status in governance-record-only evidence and the final report.

---

### Task 7: Verify and freeze the replacement technical commit T_NEW

**Objective:** Produce one exact replacement technical candidate with independently reviewed behavior and no unrelated paths.

**Files expected in the implementation allowlist:**

- `openspec/governance/design-pattern-policy.json`
- `openspec/scripts/check-design-pattern-governance.mjs`
- `openspec/scripts/design-pattern-governance/policy.mjs`
- `openspec/scripts/design-pattern-governance/review-freshness.mjs`
- `openspec/scripts/design-pattern-governance/git.mjs` only if Task 4 needs merge-aware history enumeration
- `openspec/tests/design-pattern-governance/support/disposable-repo.mjs`
- `openspec/tests/design-pattern-governance/policy.test.mjs`
- `openspec/tests/design-pattern-governance/perimeter.test.mjs`
- `openspec/tests/design-pattern-governance/review-freshness.test.mjs`
- `packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs`
- `openspec/changes/establish-design-pattern-governance/assessment.json`
- `openspec/changes/establish-design-pattern-governance/evidence-packet.md`

Exclude this plan and every unrelated untracked file.

**Step 1: Run targeted GREEN checks**

Run every modified test file directly, then:

```bash
node --test openspec/tests/design-pattern-governance/*.test.mjs
npm run test:governance-history --prefix packages/security-audit-sdk-core
npm run test:verification --prefix packages/security-audit-sdk-core
```

Expected: all tests pass with nonzero discovery.

**Step 2: Prove the live stale state now fails for the correct reason**

Run final governance verification against the candidate and current historical record.

Expected before `S_NEW`: nonzero with `signed-review-stale` naming `T_OLD`/the post-sign normative history. This is the intended R15 red gate, not a defect to suppress. No unrelated diagnostic may be present.

Run assessment and implementation phases separately; they must pass.

**Step 3: Validate in an isolated no-hardlink candidate clone**

Reconstruct exact candidate bytes without the untracked plan, create a disposable candidate commit, install dependencies if needed, and run:

```bash
openspec validate establish-design-pattern-governance --strict
openspec validate --all --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase assessment
node openspec/scripts/check-design-pattern-governance.mjs --phase implementation
node --test openspec/tests/design-pattern-governance/*.test.mjs
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
```

Expected: all pass. Run final phase separately and require exactly the intentional stale-review blocker until the replacement record exists.

Diagnose any other red gate as spec, policy, checker, test, generated output, code, or infrastructure before editing.

**Step 4: Request independent pre-commit reviews**

Obtain at least:

1. a spec/fail-closed review focused on R15 history derivation, merge commits, record deletion, and path classification;
2. a code-quality/security review of the exact diff;
3. an explicit check that the reviewer can reproduce the old bypasses and see the corrected diagnostics.

AI review is quality evidence only, never owner approval.

**Step 5: Run final read-only candidate checks**

Verify syntax, `git diff --check`, exact changed-path allowlist, stable diagnostics, deterministic output, added-line secret/unsafe scans, final newlines, and index/worktree object identity. Do not run write-mode generation in the branch worktree.

**Step 6: Stage an explicit allowlist and commit once**

Use `git add -- <exact paths>`; never `git add .`. Inspect the complete staged diff and commit without amendment, for example:

```bash
git commit -m "fix(governance): enforce signed-review freshness"
```

Record the resulting full SHA as `T_NEW`. Do not fabricate it in advance.

**Step 7: Push without force and prove identity**

Push the feature branch, fetch, and prove local HEAD, tracking ref, GitHub PR head, and the reviewed target are exact `T_NEW`.

**Step 8: Classify exact-T CI honestly**

Wait for exact-T checks. Every check other than `design-pattern-governance` must pass. The governance check is expected to fail only with `signed-review-stale` until `S_NEW` replaces the stale canonical record. Any other failure blocks signing.

This temporary red state is fail-closed and is never merge-ready.

---

### Task 8: Prepare and obtain fresh explicit owner approval for exact T_NEW

**Objective:** Bind a new human decision to exact replacement technical bytes; do not reuse the approval for `T_OLD`.

**Files:**
- Proposed S-only modification: `packages/security-audit-sdk-core/verification-lifecycle.json`
- Temporary evidence: exact object list, assessment digest, branch-protection response/digest, check rollup

**Step 1: Derive all record fields from Git objects**

From exact `T_NEW`, derive:

- T commit and root tree;
- current assessment SHA-256 and commit;
- checker blob;
- policy blob;
- reviewed subtree objects;
- required-check API evidence and digest;
- exact non-governance check results;
- the expected pre-S `signed-review-stale` result;
- current authorizations granted/withheld.

The new reviewed-content entries must include the existing four OpenSpec subtrees plus `packages/security-audit-sdk-core/tests/verification` because the replacement technical change alters normative verification evidence. Add any other normative subtree actually changed by T_NEW. No reviewed path may contain `verification-lifecycle.json`.

**Step 2: Prepare the replacement record without rewriting history**

Update the one canonical current record for `establish-design-pattern-governance` so it binds `T_NEW`; do not append a duplicate record. Historical `S_OLD` remains immutable and recoverable from Git history.

Refresh:

- policy summary;
- `reviewedCommit`, `candidateRoot`, and reviewed objects;
- governed/bound commit lists;
- assessment digest;
- candidate checker blob/result;
- divergences, including the explicitly expected old-record stale diagnostic before S_NEW;
- required-check evidence;
- authorizations and assurance limitations;
- reviewer decision/date only after the owner responds.

Do not name future `M` or `A` hashes.

**Step 3: Present an exact approval statement to the owner**

The request must name full `T_NEW`, its reviewed content objects, the exact authorization scope, and withheld scope. It must ask for an explicit response equivalent to:

> I approve exact technical commit `<T_NEW>` and the listed reviewed content objects; authorize its governance-record-only direct child S_NEW, identity-preserving merge of PR #157, and dedicated direct-child activation A; and continue to withhold canonicalization, archive, publication, deployment, collection, real-user processing, framework integration, and delivery infrastructure.

Do not infer approval from this plan or the prior “Yes, I approve” bound to `T_OLD`.

**Step 4: Stop if the owner changes technical scope**

Any requested normative edit invalidates `T_NEW`. Return to Task 2/4 as appropriate, produce a new technical commit, and request approval again.

---

### Task 9: Construct, preflight, commit, and publish exact S_NEW

**Objective:** Create a governance-record-only direct child of `T_NEW` that clears R15 without changing technical bytes.

**Files:**
- Modify only: `packages/security-audit-sdk-core/verification-lifecycle.json`

**Step 1: Finalize the record from the explicit owner response**

Store the exact decision text, reviewer identity/role/date, refreshed T/content bindings, granted/withheld authorizations, and assurance limitations. Keep `mergeCommits` empty because M does not exist.

**Step 2: Build an exact S candidate with Git plumbing or a private index**

Construct the candidate as a direct child of `T_NEW` in an isolated repository/private index. Preserve exact authoring inputs so the preflighted commit can become the real `S_NEW` without rewriting bytes.

Expected diff: exactly one path, `packages/security-audit-sdk-core/verification-lifecycle.json`.

**Step 3: Run the complete S preflight**

Against the exact candidate S, require:

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final
node --test openspec/tests/design-pattern-governance/*.test.mjs
npm run test:governance-history --prefix packages/security-audit-sdk-core
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate establish-design-pattern-governance --strict
openspec validate --all --strict
```

Expected: all pass. Specifically prove:

- `S_NEW^ == T_NEW`;
- all T_NEW reviewed objects equal the record;
- every `T_NEW..S_NEW` changed path is governance-record-only;
- `signed-review-stale` is absent;
- `S_OLD` remains in history but is no longer the current binding;
- production/publication/canonical/archive authorizations remain withheld.

**Step 4: Freeze and publish exact S_NEW**

Move the verified commit onto the feature branch without amend/rebase/regeneration, push without force, then prove local/tracking/live PR head identity.

**Step 5: Wait for all exact-S checks**

All nine required contexts must pass on exact `S_NEW`. CodeScene Cloud and DeepScan must be read and reported separately. A red `design-pattern-governance` result at this point is a blocker, not expected.

---

### Task 10: Reconcile the PR description and exact lifecycle evidence

**Objective:** Make the live PR body truthful without changing Git-reviewed bytes.

**Files:**
- Modify: GitHub PR #157 description only
- Repository files: none

**Step 1: Generate the body from live evidence**

Read the actual commit list/count, exact `T_NEW` and `S_NEW`, test counts, required contexts, branch-protection evidence, CodeScene/DeepScan status, and current authorization state.

**Step 2: Replace stale present-tense claims**

The body must no longer claim:

- only two commits;
- reviewer acknowledgement/signature is pending;
- the governance check is not required;
- verification is against `c571927`;
- DeepScan still has three current issues;
- groups 9/10 are wholly untouched.

Instead record:

- `T_OLD`/`S_OLD` as historical and superseded for current content;
- exact `T_NEW`/`S_NEW` as the current landing pair;
- R15/perimeter/inventory recovery and exact verification;
- required-check enforcement as mutable external state rechecked before merge;
- merge/activation authorization if and only if present in the fresh owner decision;
- canonicalization/archive and production/publication as withheld.

**Step 3: Read back the body**

Use `gh pr view 157 --json body,headRefOid,commits` and verify exact head remains S_NEW. Do not use the body as a substitute for committed signed evidence.

---

### Task 11: Perform the final exact-head merge gate

**Objective:** Prove the current landing pair is merge-ready immediately before the irreversible merge action.

**Files:**
- Modify: none

**Step 1: Re-fetch and freeze identities**

Require:

- local/tracking/live PR head = `S_NEW`;
- `S_NEW^ = T_NEW`;
- `origin/main` equals the expected pre-merge base;
- worktree/index have no implementation changes;
- exact PR state is open/non-draft/mergeable.

If main moved, do not rebase or automatically merge main into the feature branch. Re-evaluate R15 and direct-child activation feasibility; renewed review is mandatory if any reviewed/normative substance changes.

**Step 2: Re-read branch protection bytes**

Capture and hash the exact response again. Require strict mode and all nine contexts, including `design-pattern-governance`.

**Step 3: Verify exact-S checks through both APIs**

Use PR rollup and commit check-runs/status APIs. Require all required contexts successful on `S_NEW`; reject pending, neutral, skipped, stale, or wrong-SHA results.

**Step 4: Run the lifecycle-status sweep**

Search Markdown/JSON/YAML/templates/tests and the PR body for stale present-tense pending/blocked/unsigned/not-required claims. Historical statements and future withheld gates may remain; contradictions about current S/merge readiness block.

**Step 5: Report the gate before acting**

Report separately:

- technical T_NEW readiness;
- signed S_NEW validity;
- required-check enforcement;
- merge authorization/readiness;
- activation authorization/readiness;
- canonical/archive authorization;
- production/publication authorization.

Proceed only if the fresh owner decision explicitly authorizes merge and activation.

---

### Task 12: Create identity-preserving merge M

**Objective:** Merge PR #157 while preserving exact T_NEW and S_NEW identities.

**Files:**
- Modify: protected Git history through GitHub merge only

**Step 1: Merge with head compare-and-swap**

Run only:

```bash
gh pr merge 157 --repo nandohdc/bloodtrail --merge --match-head-commit "$S_NEW"
```

Do not use `--admin`, `--auto`, `--squash`, `--rebase`, or `--delete-branch`.

**Step 2: Read back M**

Fetch and read the PR merge result. Record exact `M`, its parents, and tree. Require:

- PR state merged;
- `M` is on `origin/main`;
- `M` has two parents;
- one parent is the expected old main tip and the other carries exact `S_NEW`;
- `T_NEW` and `S_NEW` are ancestors;
- no rewritten replacement commits exist.

**Step 3: Stop on any identity mismatch**

Do not attempt activation if GitHub produced an unexpected strategy/parentage or main moved again.

---

### Task 13: Build and pre-verify dedicated activation commit A on a new branch

**Objective:** Create A with sole parent M, exact activation bindings, and no unrelated paths—without committing directly on main.

**Files:**
- Create: `openspec/governance/activation-record.json`
- Create only if already supported by the activation schema/allowlist: one exact evidence record under `openspec/governance/records/`
- Do not modify: T_NEW artifacts, S_NEW record, canonical capability, active change tasks, archive

**Step 1: Create a dedicated activation branch at exact M**

Use a new branch such as `feat/activate-design-pattern-governance`, created from exact fetched `M`. Confirm clean state and `HEAD == M` before editing.

**Step 2: Capture activation-time branch-protection evidence**

Re-query exact required-status-check bytes and SHA-256. Require the same strict nine-context set. This activation-time digest, not only an earlier capture, is the one A binds.

**Step 3: Materialize A from exact Git objects**

Populate the activation record with:

- `refs/heads/main`;
- exact M and M tree;
- merge strategy `merge_commit`;
- exact T_NEW;
- exact S_NEW;
- signed-record content object from S_NEW;
- checker/policy/schema/catalog/actor-neutral document objects from T_NEW;
- required-check identity and activation-time enforcement digest;
- supported schema versions;
- exact grandfathered entries;
- the closed activation path allowlist.

Never include A's own hash and never invent a future commit.

**Step 4: Preflight the would-be A in a disposable exact candidate**

Run bootstrap and activation checks plus their negative controls. Require named failures for wrong parent, squash/rebase, altered T object, missing required context, unrelated A path, shallow history, and bootstrap re-entry.

Run strict OpenSpec, full governance tests, SDK validation, and contract validation in the disposable exact candidate.

**Step 5: Independent activation review**

Obtain an independent review of exact T/S/M bindings, parentage, evidence digest, path allowlist, and absence of canonical/archive/production expansion.

**Step 6: Commit exact A on the activation branch**

Stage only the activation allowlist and commit once:

```bash
git commit -m "feat(governance): activate design-pattern governance"
```

Immediately prove `A^ == M`, A has exactly one parent, and its diff from M contains only allowlisted activation paths. Freeze A byte-for-byte.

---

### Task 14: Pre-check A remotely, then fast-forward protected main to exact A

**Objective:** Obtain required checks on exact A before making it the protected-mainline activation boundary, then land it without a merge/squash/rebase replacement.

**Files:**
- Modify: remote branch refs and protected `main` only

**Step 1: Push only the activation branch**

Push the dedicated branch without force and open a separate activation PR against current main solely to obtain checks on exact A. Record its real number; do not fabricate one in advance.

**Step 2: Wait for exact-A checks**

Require all nine required contexts on A, plus separately inspect CodeScene Cloud and DeepScan. Confirm the activation PR has base at M and exactly one commit A.

Do not merge that PR through GitHub's merge/squash/rebase buttons; a merge commit would make the protected ref advance to a commit after A rather than directly from M to A.

**Step 3: Re-fetch and enforce the direct-child compare point**

Immediately before landing, require `origin/main == M` and `A^ == M`. If main advanced, stop: A can no longer be M's direct child on the protected reference and must be rebuilt/re-reviewed from the new exact base.

**Step 4: Fast-forward main without force or admin bypass**

Push exact A as a normal fast-forward:

```bash
git push origin "$A:refs/heads/main"
```

Do not use force, force-with-lease, `--admin`, or a history-rewriting merge method. Required checks must already exist on exact A.

**Step 5: Read back activation identity**

Require local activation branch, `origin/main`, live GitHub main, and exact A identity to match. Verify the activation PR is recognized as merged-by-inclusion or close it with an evidence note if GitHub does not do so automatically; do not create another commit.

---

### Task 15: Verify active enforcement and stop at the authorization boundary

**Objective:** Prove A is active and report what remains without canonicalizing or archiving.

**Files:**
- Modify: none

**Step 1: Read remote CI on exact A**

Wait for the mainline run and require all nine required contexts successful on exact A. Do not rerun or modify the already preflighted candidate bytes.

**Step 2: Verify immutable object relations read-only**

Prove:

- M preserves exact T_NEW and S_NEW;
- A has sole parent M;
- activation record object bindings resolve to T_NEW/S_NEW/M;
- required-check evidence digest matches captured bytes;
- bootstrap cannot re-enter after A;
- active final/activation enforcement passes;
- production/publication/canonical/archive restrictions remain unchanged.

**Step 3: Report readiness separately**

Report exact T_NEW, S_NEW, M, and A only after they exist. Then state:

- active design-pattern governance: yes/no;
- canonical capability materialization: not executed and not authorized under this plan;
- archive: not ready until canonical materialization, task/evidence reconciliation, explicit archive validation, and fresh authorization;
- production/publication/integration: still withheld.

**Step 4: Stop**

Do not run `openspec sync`, `openspec archive`, modify canonical specs, check post-sign task boxes, create archive attestations, deploy, publish, or add integration infrastructure.

---

## Validation matrix

### During TDD

```bash
node --test openspec/tests/design-pattern-governance/perimeter.test.mjs
node --test openspec/tests/design-pattern-governance/policy.test.mjs
node --test openspec/tests/design-pattern-governance/review-freshness.test.mjs
node --test packages/security-audit-sdk-core/tests/verification/governance-history-mutations.test.mjs
```

Each new control must be observed RED for the intended missing behavior before implementation, then GREEN after the minimal correction.

### Replacement technical candidate T_NEW

```bash
openspec validate establish-design-pattern-governance --strict
openspec validate --all --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase assessment
node openspec/scripts/check-design-pattern-governance.mjs --phase implementation
node --test openspec/tests/design-pattern-governance/*.test.mjs
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
```

All pass. Final phase must fail only with the intentional stale-old-record diagnostic before S_NEW.

### Replacement signed child S_NEW

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final
node --test openspec/tests/design-pattern-governance/*.test.mjs
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate establish-design-pattern-governance --strict
openspec validate --all --strict
```

All pass on exact S_NEW; all nine required GitHub contexts pass on exact S_NEW.

### Before M

- exact PR head S_NEW;
- direct parent T_NEW;
- all required checks exact-S success;
- live strict branch-protection readback;
- stable mergeable/clean state;
- fresh owner authorization includes merge/activation;
- PR body coherent;
- main tip unchanged.

### Exact A preflight

- A sole parent M;
- activation diff exact allowlist;
- all activation bindings exact;
- bootstrap and negative controls pass/fail as specified;
- all required checks successful on exact A before fast-forward;
- origin/main still exact M.

### After A

- origin/main exact A;
- A sole parent M;
- exact T_NEW/S_NEW identities preserved;
- active enforcement successful;
- bootstrap re-entry rejected;
- no canonical/archive/production authorization expansion.

## Commit and branch boundaries

1. Existing commits through `6c2269c`: preserve exactly.
2. `T_NEW`: one technical remediation/evidence commit on `feat/design-pattern-governance`.
3. `S_NEW`: one governance-record-only direct child of T_NEW on the same PR branch.
4. `M`: GitHub merge commit for PR #157, exact-head matched to S_NEW.
5. `A`: one activation-only direct child of M, authored on a dedicated activation branch and fast-forwarded to main after exact-A checks.
6. Canonical materialization: future separately authorized governed change/commit—not part of this plan's execution.
7. Archive: future separate commit after canonicalization and archive evidence—not part of this plan's execution.

## Risks and stop conditions

1. **Circular replacement lifecycle:** T_NEW must expose `signed-review-stale` until S_NEW exists. Treat that one exact failure as the expected fail-closed lifecycle state; all technical gates and all other CI checks must pass. Full final success is required only on exact S_NEW.
2. **Record-introduction derivation:** Comparing only current blobs is insufficient. The verifier must prove where the current exact signed record first appeared after T and inspect every intervening commit, including merges.
3. **Record deletion masquerading as never signed:** Current absence is allowed only if no signed record for the active change ever existed in reachable history. Historical presence followed by absence fails.
4. **Broad path exceptions:** Do not add more `.hermes` sibling exceptions to make tests pass. Unclassified execution/instruction/configuration paths are the intended fail-closed outcome.
5. **Mutable expected totals:** Dynamic counts may remain, but they cannot define which governance records and minimum bindings must exist.
6. **Task-state self-reference:** Groups 9/10 cannot be safely checked after S without changing normative content. Keep T/S frozen and report lifecycle progress in governance-record-only evidence/readiness output. Resolve checkboxes only in a later authorized governed canonical/archive lifecycle.
7. **Mainline movement:** Any commit after M before A breaks the direct-child activation plan. Stop and rebuild A from the new exact base; never rewrite T/S or force main.
8. **Activation PR semantics:** Use the separate PR only to obtain checks on exact A. Land A by normal fast-forward, not GitHub merge/squash/rebase.
9. **Branch-protection mutability:** Re-query before S evidence, immediately before M, and immediately before A. Do not rely on a historical digest alone.
10. **External analysis:** Required CodeScene delta, CodeScene Cloud, and DeepScan are distinct signals. Never suppress CodeScene or invent inaccessible issue details.
11. **Plan file dirtiness:** This requested file is untracked by default and can make live-worktree Git-clean gates red. Validate candidates in isolated clean clones and stage only explicit implementation paths.
12. **Authorization:** If fresh approval does not explicitly name T_NEW and authorize S_NEW/M/A, stop before the first unauthorized action. Canonicalization, archive, production, and publication remain withheld regardless.

## Completion definition

This plan is complete only when real evidence proves:

- R15 rejects every tested post-sign normative change and permits record-only follow-ups;
- `.hermes/plans/` is the sole Hermes documentation exception added for this work;
- record removal/binding narrowing no longer normalizes mutation expectations;
- exact T_NEW and S_NEW exist with fresh owner approval;
- PR #157 body and live checks are coherent at exact S_NEW;
- identity-preserving M exists;
- exact A is M's dedicated sole-child activation commit on protected main;
- active enforcement passes on A;
- canonicalization/archive and production/publication remain unexecuted and are reported separately.
