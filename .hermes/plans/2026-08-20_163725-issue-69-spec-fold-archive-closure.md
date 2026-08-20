# Issue #69 Spec Fold, Archive, and Closure Implementation Plan

> **Execution:** run the stateful work serially in one session against one worktree. The spec fold and the archive move must not be delegated: both depend on an evolving worktree and exact Git state. Independent read-only review may be delegated.

**Goal:** Fold the merged `reject-undeclared-shipped-imports` capability delta into the canonical SDK spec in its own owner-merged PR, close issue #69, then archive the change at 13/13 in a third PR, and land the trailing documentation separately.

**Architecture:** Three identity-preserving owner-merged PRs — implementation merge M1 (PR #190, done), canonical spec fold F/M2 while the change remains active, archive A/M3 as a complete committed relocation. The fold candidate changes exactly the canonical capability spec and the active change's task ledger. The archive candidate moves the active change into a dated archive, preserves five immutable blobs byte-for-byte, reconciles only `tasks.md`, and adds `archive-evidence.md`.

**Tech Stack:** Git, GitHub CLI, OpenSpec CLI 1.9.0, Markdown, JSON, Node.js 24/26, npm workspace validation, Bloodtrail design-pattern-governance checker.

---

## Current context and frozen facts

Verified read-only on 2026-08-20 before writing this plan.

### Repository and remote identity

- Worktree: `/Users/fernando.costa/Git/bloodtrail`.
- Current branch/HEAD: `feat/reject-undeclared-shipped-imports` at `d4085cb89290ba3f8cddbd47966494fc337e32e4`; index and worktree clean apart from this plan file.
- Local `main`: `c08c45bd32473c767393c40b4a13507598fd3e6b`; `origin/main`: `c98132c89e928f8b59562a1344c342facbde465d`. Local `main` is one owner merge behind.
- PR #190 is merged: https://github.com/nandohdc/bloodtrail/pull/190.
- PR #190 merge topology is identity-preserving:
  - first parent `c08c45bd32473c767393c40b4a13507598fd3e6b`;
  - second parent / exact PR head `d4085cb89290ba3f8cddbd47966494fc337e32e4`;
  - merge `c98132c89e928f8b59562a1344c342facbde465d`;
  - merge tree and PR-head tree both `c03fc95bbdd4fa52ec06eb29ab7cc993287ae3e6`;
  - the range contains the seven PR commits plus the merge commit.
- PR #182 (`chore: release v0.4.0`, release-please) is **open**. Hold it until M3 merges — it moves `main` and would force a full re-freeze of every base identity mid-lifecycle. It touches no governed path, so holding it costs nothing but ordering.

### Change and spec state

- `openspec status --change reject-undeclared-shipped-imports --json` reports all four planning artifacts done and exactly one delta spec: `openspec/changes/reject-undeclared-shipped-imports/specs/security-audit-sdk-core/spec.md`.
- The delta contains one `## ADDED Requirements` block, `Dependency verification inspects module imports in shipped artifacts`, with seven scenarios.
- Canonical `openspec/specs/security-audit-sdk-core/spec.md`: **47** `### Requirement:` headers, **0** delta operation headers, target requirement absent.
- Active task state **9/13**: 1.1–2.7 checked; 3.1–3.4 unchecked.
- Issue #69 is OPEN, category `enhancement`, state role `ready-for-agent`, triage brief at https://github.com/nandohdc/bloodtrail/issues/69#issuecomment-5356452683.

### Verified mechanics — do not re-derive, do not assume otherwise

These were checked against the source, not inferred. They are the reason the sequencing below is what it is.

1. **An active change owns its capability's canonical spec path.** `ownedPathsFor` (`openspec/scripts/design-pattern-governance/perimeter.mjs:259-271`) appends `openspec/specs/<capability>/` for every entry in `applicability.capabilities`, and returns early — *without* that append and without `owned_paths` — once the change is relocated. `reject-undeclared-shipped-imports/assessment.json` declares `capabilities: ["security-audit-sdk-core"]`, so it owns the canonical spec **while active only**. Its `owned_paths` list does not contain the canonical spec and does not need to.
2. **The fold and the archive cannot share a PR.** `collectRangePaths` unions paths across every commit in the range. A range containing both the fold and the relocation is evaluated against a change that is relocated at HEAD, so the canonical spec path loses coverage and `checkOpenSpecAssociation` fails with `openspec-association-unrelated`. Separate ranges are mandatory, not stylistic.
3. **`test:changed-paths` resolves to `archived` mode**, for `remediate-security-audit-sdk-adversarial-review` (its dated archive exists; the active dir does not). Verified by running it: `changed-path policy passed in archived mode ... {"sdk-capability":1, ...}`. Canonical SDK spec edits are a classified, permitted bucket.
4. **`check-coherence` governs the lifecycle change only.** It reads `verification-lifecycle.json`, whose change is `remediate-security-audit-sdk-adversarial-review`. CLAUDE.md's "merge/archive tasks must remain unchecked while the change is active" is scoped to that change. Checking landing tasks 3.1/3.2 on *this* change while active trips nothing.
5. **The governance perimeter silently passes when `base === head`.** `check-design-pattern-governance.mjs:322` is `if (base === head) return;` — no diagnostic, exit `0`, `passed in final phase`. A branch created at `origin/main` with uncommitted edits satisfies this, so a pre-commit `--phase final --base origin/main` run inspects **nothing**. Reproduced with a null control: with an untracked unclassified probe present, `--base origin/main` exits 1 with `path-unclassified`; `--base <HEAD>` exits 0 with `passed`. Filed as issue #191.
6. **`docs/` is `documentation_only`** (`openspec/governance/design-pattern-policy.json` → `path_classes`), and `checkOpenSpecAssociation` receives governed paths only. A `docs/adr/` file needs no OpenSpec change and no association coverage. `packages/**` and `openspec/**` are `governed_implementation` and do.
7. **`checkHiddenImplementation` fires on `documentation_only` paths.** Its signals include `/^\+\s*export\s+(async\s+)?function\s+/m`. Prose quoting `export function …` at line start trips `hidden-implementation`; reference by `file:line` or indent the snippet.
8. **`.hermes/plans/` is tracked**, committed in batched dedicated commits separate from the work described — `66bbeea docs(hermes): add planning notes for issue 67 and 68 lifecycle` (three plans), `62e0975 feat(governance): add recovery and activation implementation plan` (three plans). This file is untracked only because it has not been committed yet.

### Precedents this plan follows

- **Close the issue before archiving.** `openspec/changes/archive/2026-08-17-record-validator-packaging-policy/tasks.md:1.7` — "After merge: verify ADR-SDK-011 at main and close #67 with an evidence comment" — was completed and checked, then the change archived at 7/7. That resolves the ordering conflict without a 12/13 archive or a reconciliation commit.
- **A self-referential archive task is legitimate.** `openspec/changes/archive/2026-08-18-cover-bundle-archive-spec-fold/tasks.md:2.2` checks "archive this change as a pure relocation" inside the archive commit, with "the archive commit hash is reported after storage, not self-bound".
- **This archive is self-covering.** `carriesRelocatedArtifact` recognises the relocation because `assessment.json` and `proposal.md` are the exact objects history carried at the active path, so `ownedPathsFor` grants the dated archive directory. No keeper change is required — unlike `bundle-validator-runtime-helpers`, which needed `cover-bundle-archive-spec-fold` because it folded its spec *inside* the archive range.
- **`archive-evidence.md` is established.** Present in nine dated archives; newest structure at `2026-08-20-enforce-archive-relocation-completeness/archive-evidence.md`.

### Frozen active-change blobs at M1

| Active path suffix | Blob at `origin/main` / M1 |
| --- | --- |
| `.openspec.yaml` | `f774115be73dd8f01a23e4a77304e2ce5c0e136c` |
| `assessment.json` | `ba1023265ae321b0a32496bcb5b4f6cfa3527c1f` |
| `design.md` | `425362c3adb6318461e7e06fbcba07850aaf898c` |
| `proposal.md` | `225a2c8c952a023d2faf729f504a5af9a5ef723d` |
| `specs/security-audit-sdk-core/spec.md` | `27a6a77a6f267846003e4e17afa58fbaa760c377` |
| `tasks.md` | `6af003fd6e9c26d6a7f64896fbaa793ee2f4e8b4` |

Canonical SDK spec blob at M1: `fd303b8f141d7d15bf86c38e2d8acfb176dc9b76`.

---

## Sequence and stop boundaries

1. Fold the canonical requirement **while the change is active** (verified mechanic 1). Relocating first fails closed.
2. Fold, closure, and archive are three separate stages. Proposal/implementation, spec fold, and archive stay in separate identity-preserving owner-merged PRs.
3. **Close #69 after M2 and before building the archive candidate**, so the archive lands 13/13 in one commit. Post the archive permalink as a follow-up comment on the closed issue after M3.
4. The agent never merges a PR and never deletes a branch.
5. Each candidate is verified in two stages (below). After the push, preserve it byte-for-byte: no generation, formatting, test reruns, or tidy-up.
6. Stage an explicit allowlist only. This plan file and every unrelated untracked path stay out of both candidates.
7. Hold PR #182 until M3.
8. Trailing documentation (two ADRs + this plan) lands in one `docs:` PR **after** M3, never inside a candidate.

### Verification is split in two — this is not optional

Two constraints pull opposite ways: `test:git` (inside `npm run validate`) requires an empty Git index, while the governance perimeter is vacuous without a commit (verified mechanic 5). Every candidate therefore runs:

- **Stage (a), pre-stage, empty index.** `check:generated`; `openspec validate --specs`; `openspec validate <change> --strict`; `openspec validate --all --strict`; `openspec validate --all --archived --strict`; `node --test openspec/tests/design-pattern-governance/*.test.mjs`; `npm run validate --prefix packages/security-audit-sdk-core`; `npm run validate --prefix contracts/security-audit`; `git diff --check`; exact `git status --porcelain=v1 --untracked-files=all`.
- **Stage (b), post-commit.** `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`; `node openspec/scripts/run-governance-dual-check.mjs`; and for the archive, `git show --name-status --no-renames HEAD`.

Green in (b) authorises the push. Red in (b) means `git reset --soft HEAD~1`, fix, and repeat — the candidate is not frozen until it is pushed. **Never record a pre-commit final-phase result as evidence.** No disposable clone is needed; reach for one only if a result looks install-state-dependent.

---

### Task 1: Re-freeze remote identity and fast-forward local main

**Files:** none.

```bash
git fetch --prune origin
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD main origin/main
git ls-remote --heads origin refs/heads/main refs/heads/feat/reject-undeclared-shipped-imports
gh pr view 190 --repo nandohdc/bloodtrail --json state,mergedAt,mergeCommit,headRefOid,baseRefOid,url
```

Expected: tracked worktree and index clean, only this plan untracked; feature HEAD and live feature ref both `d4085cb8…`; live `main` still `c98132c8…`; PR #190 `MERGED`.

Re-prove topology:

```bash
git cat-file -p c98132c89e928f8b59562a1344c342facbde465d
git merge-base --is-ancestor d4085cb89290ba3f8cddbd47966494fc337e32e4 origin/main
git rev-parse c98132c89e928f8b59562a1344c342facbde465d^{tree} d4085cb89290ba3f8cddbd47966494fc337e32e4^{tree}
```

Expected: exactly the two recorded parents, successful ancestry, equal trees.

Fast-forward:

```bash
git switch main && git merge --ff-only origin/main
git status --short --branch && git rev-parse HEAD origin/main
```

If `origin/main` moved beyond `c98132c8…`, inspect every intervening commit and active-change path before proceeding. Never assume the two-file scope is still governed by the same baseline.

---

### Task 2: Create the spec-fold branch

**Files:** none.

```bash
git switch -c docs/sync-shipped-import-verification-spec
git branch --show-current && git rev-parse HEAD
```

Expected: branch starts exactly at the verified `origin/main`. Do not delete or rewrite `feat/reject-undeclared-shipped-imports`.

---

### Task 3: Resolve OpenSpec sync inputs

**Files:** read-only.

```bash
openspec status --change reject-undeclared-shipped-imports --json
openspec instructions specs --change reject-undeclared-shipped-imports --json
```

Expected: schema `spec-driven`; all artifacts `done`; `artifactPaths.specs.existingOutputPaths` contains exactly `openspec/changes/reject-undeclared-shipped-imports/specs/security-audit-sdk-core/spec.md`; instructions return valid JSON.

Announce `Using change: reject-undeclared-shipped-imports`. Do not infer a second delta path.

---

### Task 4: Fold the ADDED requirement into the canonical SDK spec

**Files:**

- Modify: `openspec/specs/security-audit-sdk-core/spec.md` — insert after `Verification covers runtime, compile-time, package, and scope boundaries`, before `SDK approval and authorization remain exact-commit governed`.
- Read: `openspec/changes/reject-undeclared-shipped-imports/specs/security-audit-sdk-core/spec.md`.

Apply the `openspec-sync-specs` intelligent merge. Add the requirement under the existing single `## Requirements` section. **Do not copy the `## ADDED Requirements` header** — copying the delta file wholesale is invalid.

```markdown
### Requirement: Dependency verification inspects module imports in shipped artifacts
Dependency verification SHALL inspect every shipped JavaScript and TypeScript artifact and SHALL classify every module specifier the artifact references, in ESM import and export positions and in CommonJS `require()` position.

A specifier SHALL be permitted only when it is relative to the artifact, an approved Node built-in for that artifact's role, a declared runtime dependency of the package, or a self-reference whose subpath is a declared package export. Every other specifier SHALL fail verification, including a specifier that is not a literal string and a Node built-in referenced without its `node:` prefix.

Verification SHALL fail when it inspects no shipped artifact, SHALL fail when a shipped artifact cannot be read, and SHALL fail when the parser cannot return a syntax tree. A returned syntax tree is error-tolerant and does not establish syntax validity; syntax validation remains the responsibility of the build, typecheck, and runtime gates.

Diagnostics SHALL name the artifact path, the module specifier, and the violated class, SHALL be bounded in count and length, and SHALL NOT include artifact source content.

#### Scenario: Approved shipped output passes
- **WHEN** dependency verification inspects the built package whose shipped artifacts reference only approved Node built-ins, declared package exports, and relative modules
- **THEN** verification passes and reports the number of artifacts and specifiers inspected

#### Scenario: Undeclared external module is rejected
- **WHEN** a shipped artifact requires `ajv/dist/runtime/ucs2length` while the package declares no runtime dependencies
- **THEN** verification fails and the diagnostic names that artifact and that module

#### Scenario: Declared runtime dependency is accepted
- **WHEN** a shipped artifact imports a module whose package is declared in the package manifest's runtime dependencies
- **THEN** verification accepts that specifier as a declared dependency

#### Scenario: Bundled module contributes no specifier
- **WHEN** a shipped artifact embeds third-party code instead of importing it
- **THEN** the artifact contributes no external specifier and verification passes

#### Scenario: Unprefixed or unapproved built-in is rejected
- **WHEN** a shipped artifact references a Node built-in without the `node:` prefix, or references a built-in that is not approved for that artifact's role
- **THEN** verification fails and names the artifact and the module

#### Scenario: Dynamic specifier is rejected
- **WHEN** a shipped artifact calls `import()` or `require()` with an argument that is not a literal string
- **THEN** verification fails and reports the artifact and the unclassifiable import form

#### Scenario: Empty inspection set fails closed
- **WHEN** dependency verification finds no shipped JavaScript or TypeScript artifact to inspect
- **THEN** verification fails rather than reporting a pass
```

Expected after the edit: canonical count 48; target requirement exactly once; seven target scenarios; zero delta operation headers; all 47 prior requirements byte-preserved outside the insertion point.

---

### Task 5: Reconcile landing tasks 3.1 and 3.2 only

**Files:** Modify `openspec/changes/reject-undeclared-shipped-imports/tasks.md`.

Replace only 3.1 and 3.2 with checked, evidence-bearing entries. Leave 3.3 and 3.4 unchecked and **do not renumber them** — the numbering must keep matching what PR #190's reviewers read, and completion order need not follow numbering.

```markdown
## 3. Landing (human-owned)

- [x] 3.1 Owner merges the implementation PR — done: PR #190 was merged by the project owner as `c98132c89e928f8b59562a1344c342facbde465d`, an identity-preserving two-parent merge of prior main `c08c45bd32473c767393c40b4a13507598fd3e6b` and exact implementation head `d4085cb89290ba3f8cddbd47966494fc337e32e4`; the merge tree equals the implementation-head tree.
- [x] 3.2 Fold the capability requirement into the canonical spec — done in this commit: `Dependency verification inspects module imports in shipped artifacts` is present once under `openspec/specs/security-audit-sdk-core/spec.md` with all seven scenarios and no delta operation header; the canonical spec now carries 48 requirements.
- [ ] 3.3 Archive the change as a complete relocation
- [ ] 3.4 Close #69 with evidence
```

Expected task state: 11 checked, 2 unchecked.

Do not edit the delta spec, proposal, design, assessment, implementation, test, package, governance-core, contract, generated, or plan files.

---

### Task 6: Semantic and scope verification of the fold

**Files:** read-only.

```bash
git status --porcelain=v1 --untracked-files=all
git diff --check
git diff --name-status
git diff --stat
git diff -- openspec/specs/security-audit-sdk-core/spec.md openspec/changes/reject-undeclared-shipped-imports/tasks.md
```

Expected tracked scope exactly `M openspec/specs/security-audit-sdk-core/spec.md` and `M openspec/changes/reject-undeclared-shipped-imports/tasks.md`. The plan file may appear untracked and stays excluded.

Assert mechanically, not visually — 48 canonical `### Requirement:` headers; target requirement exactly once; each of the seven target scenario names exactly once; zero `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` headers; tasks 11 checked / 2 unchecked; 3.1 and 3.2 checked, 3.3 and 3.4 unchecked.

Compare the delta requirement against the canonical block paragraph by paragraph and scenario by scenario: only the operation header is omitted. Confirm a second sync would produce no content change. Do not re-run a write-mode sync after this point.

---

### Task 7: Stage (a) — pre-stage validation with an empty index

```bash
node -v
npm run check:generated --prefix packages/security-audit-sdk-core
openspec validate --specs
openspec validate reject-undeclared-shipped-imports --strict
openspec validate --all --strict
openspec validate --all --archived --strict
node --test openspec/tests/design-pattern-governance/*.test.mjs
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
git diff --check
git status --porcelain=v1 --untracked-files=all
```

Expected: Node `24.x` or `26.x`; generated artifacts current; canonical specs valid at 48 SDK requirements; active and archived strict validation exit 0; governance suite green (201 tests at last run); SDK 19 gates pass with an empty index; contract 14/14; no generated or unexpected drift; scope still exactly two files.

**Do not run the governance final phase or the dual check here** — HEAD is still `origin/main`, so `base === head` and both would report a vacuous pass (verified mechanic 5).

If a gate is red, diagnose whether the delta, the canonical merge, the task ledger, or the gate is wrong before editing. Do not loosen a gate.

---

### Task 8: Stage, commit, then stage (b) — post-commit governance

**Step 1 — stage the explicit allowlist**

```bash
git add openspec/specs/security-audit-sdk-core/spec.md \
  openspec/changes/reject-undeclared-shipped-imports/tasks.md
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
git diff --name-only
git status --porcelain=v1 --untracked-files=all
```

Expected: exactly two staged files, no unstaged tracked remainder, plan untracked.

**Step 2 — commit**

```bash
git commit -m "docs(openspec): fold shipped-import verification into canonical SDK spec"
git rev-parse HEAD
git show --name-status --stat --oneline HEAD
```

Call this commit `F`.

**Step 3 — stage (b), now that a commit exists**

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main
node openspec/scripts/run-governance-dual-check.mjs
```

Expected: final phase inspects **exactly the two governed paths** and reports no findings; candidate and baseline agree. Confirm the output names the paths — a bare pass with no scope line means the range was empty and the run is void.

Red here: `git reset --soft HEAD~1`, fix, return to Task 6. The candidate is frozen only once pushed.

**Step 4 — push**

```bash
git push -u origin docs/sync-shipped-import-verification-spec
git ls-remote --heads origin refs/heads/docs/sync-shipped-import-verification-spec
git rev-parse HEAD
```

Expected: local and live remote both equal `F`. Do not amend or re-run local validation after this.

**Step 5 — open the PR**

Title: `docs(openspec): fold shipped-import verification into canonical SDK spec`

Body records: PR #190 / M1 identity and two-parent proof; one ADDED requirement folded into `security-audit-sdk-core` while the change remains active, with the `ownedPathsFor` basis; canonical count 47 → 48, target once, seven scenarios, zero delta headers; task state 9/13 → 11/13; exact two-file scope; every verification command actually run and its real result, with stage (a) and stage (b) distinguished; the explicit note that no pre-commit final-phase result is claimed; no implementation, contract, generated, dependency, API, production-authorization, governance-record, or archive change; owner identity-preserving merge required; AI analysis is not review, approval, or assurance. CI is phrased as a pre-merge requirement until it is green.

```bash
gh pr create --repo nandohdc/bloodtrail --base main \
  --head docs/sync-shipped-import-verification-spec \
  --title "docs(openspec): fold shipped-import verification into canonical SDK spec" \
  --body-file <body-file-outside-the-repo>
gh pr view --repo nandohdc/bloodtrail --json number,url,state,headRefOid,baseRefName,headRefName,body
```

Keep the body file outside the repository. Never add it to the candidate.

**Step 6 — require exact-F CI**

```bash
gh pr checks <FOLD_PR> --repo nandohdc/bloodtrail --watch
gh pr view <FOLD_PR> --repo nandohdc/bloodtrail --json state,mergeable,mergeStateStatus,headRefOid,statusCheckRollup
```

Require head `F`, all required contexts green, stable `MERGEABLE` / `CLEAN`. Report merge readiness; the owner merges.

---

### Task 9: Verify the fold merge

After the owner reports the merge:

```bash
git fetch --prune origin
gh pr view <FOLD_PR> --repo nandohdc/bloodtrail --json state,mergedAt,mergeCommit,headRefOid
git cat-file -p <M2>
git merge-base --is-ancestor <F> origin/main
git rev-parse <M2>^{tree} <F>^{tree}
git show <M2>:openspec/changes/reject-undeclared-shipped-imports/tasks.md
git show <M2>:openspec/specs/security-audit-sdk-core/spec.md
```

Expected: M2 has exactly two parents, prior main + exact F; F reachable; merge tree equals F tree; active change still present; canonical target requirement once with seven scenarios; tasks 11/13.

Fast-forward local `main`. Stop if any identity or content differs.

---

### Task 10: Close issue #69

**Runs before the archive candidate is built.** This is what lets the archive land 13/13 in one commit, and it follows the `record-validator-packaging-policy` precedent.

The evidence comment must begin exactly with:

```markdown
> *This was generated by AI during triage.*
```

It contains:

- PR #190 and implementation head `d4085cb89290ba3f8cddbd47966494fc337e32e4`, with the M1 two-parent and tree-equality proof;
- the canonical requirement permalinked **at M2** with a line range — M2, not F, so the link survives deletion of the fold branch and points at mainline state;
- the triage brief https://github.com/nandohdc/bloodtrail/issues/69#issuecomment-5356452683;
- each of the four acceptance criteria reconciled to a concrete artifact;
- #69's own assurance limitation restated verbatim: the gate proves declaration/bundling consistency, not dependency safety;
- no claim of independent assurance, certification, or production authorization.

```bash
gh issue edit 69 --repo nandohdc/bloodtrail --remove-label ready-for-agent
gh issue comment 69 --repo nandohdc/bloodtrail --body-file <reviewed-evidence-comment>
gh issue close 69 --repo nandohdc/bloodtrail --reason completed
gh issue view 69 --repo nandohdc/bloodtrail --json state,stateReason,closedAt,labels,comments,url
```

**Add no triage state role.** `wontfix` means "Will not be actioned" (`docs/agents/triage-labels.md`) and is false for completed work; #68 and #141 — the two most recent COMPLETED closures — carry no state role. Preserve `enhancement`, `area:core`, `security-audit-sdk`, `verification`. Leave the issue body untouched; reconcile the acceptance criteria in the comment only, so the original ask stays recoverable.

Require on readback: state `CLOSED`; reason `COMPLETED`; exactly one category role, `enhancement`; no state role; evidence comment present with the disclaimer and exact permalinks.

Record the closure timestamp — Task 12 cites it.

---

### Task 11: Create the archive branch and load inputs

```bash
git switch main && git merge --ff-only origin/main
git switch -c docs/archive-reject-undeclared-shipped-imports
git rev-parse HEAD origin/main
git status --porcelain=v1 --untracked-files=all
openspec instructions archive --change reject-undeclared-shipped-imports --json
openspec status --change reject-undeclared-shipped-imports --json
```

Expected: baseline equals M2 / current `origin/main`; all artifacts done; one delta spec, already fully synced with nothing left to apply; tasks 11/13.

Determine `ARCHIVE_DATE` with `date +%Y-%m-%d`. Target `openspec/changes/archive/<ARCHIVE_DATE>-reject-undeclared-shipped-imports/`. Fail if it already exists. Never stack a second date.

---

### Task 12: Relocate, prove byte identity, reconcile, write evidence

**Step 1 — capture pre-archive blobs at M2**

`git rev-parse "<M2>:openspec/changes/reject-undeclared-shipped-imports/<suffix>"` for all six files. The post-fold `tasks.md` blob differs from M1; the other five must still equal the frozen M1 blobs in the table above.

**Step 2 — move**

Use `openspec-archive-change` for the plain filesystem move. **Do not sync again** — the delta is already folded and verified; a second sync is the one operation that could corrupt the canonical spec. Keep the Git index empty. Do not hand-edit generated OpenSpec output.

**Step 3 — compare moved bytes to M2**

For each suffix: `git hash-object "openspec/changes/archive/<ARCHIVE_DATE>-…/<suffix>"` against `git rev-parse "<M2>:openspec/changes/reject-undeclared-shipped-imports/<suffix>"`. Before any edit, all six must match. A mismatch stops the archive; never normalize or regenerate to repair it.

Expected status: six active-path deletions plus six untracked archive-path files, index empty, nothing outside the active/archive roots and the untracked plan.

**Step 4 — reconcile tasks 3.3 and 3.4**

Both are checked in this candidate. Keep the existing numbering; the evidence lines carry the real order.

- 3.4 — closed, citing the #69 closure timestamp from Task 10, "closed before this commit, citing M1 and M2".
- 3.3 — "this commit contains the complete A/D relocation; the archive commit hash is reported after storage, not self-bound", following `cover-bundle-archive-spec-fold/tasks.md:2.2`.

Expected final task state: **13/13**.

**Step 5 — write `archive-evidence.md`**

Use the section names established by `2026-08-20-enforce-archive-relocation-completeness/archive-evidence.md`:

1. **Identities** — the seven PR #190 commits, M1, F, M2, and the archive commit as "this commit"; exact merge parents and tree equality; no signed governance record exists for this change and none is inferred; AI review, green checks, and merge state are not approval.
2. **Task completeness** — 13/13, with #69 closed before this commit and why that ordering was chosen.
3. **Canonical capability presence** — target requirement once in the canonical SDK spec, seven scenarios, 48 total, zero delta headers, folded at F/M2 while the change was active.
4. **Production / publication restrictions** — no transport, exporter, collector, storage, SIEM, analytics, detection, browser telemetry, audit chaining, real-user processing, publication, contract, generated, dependency, or API authorization.
5. **Immutable archive contents, exact changed paths, byte identity** — the five immutable artifacts retain their M2 blobs; `tasks.md` is the only modification and `archive-evidence.md` the only addition.
6. **Self-coverage of this relocation** — `carriesRelocatedArtifact` recognises this archive because `assessment.json` and `proposal.md` are the exact objects history carried at the active path, so `ownedPathsFor` grants the dated archive directory. No keeper change was needed, unlike `bundle-validator-runtime-helpers`, because the fold landed in its own range while the change was active.
7. **Active enforcement verified** — the RED run and mutation evidence from tasks 2.1–2.7; the complete relocation shown by seven `A` and six `D` entries under `git show --name-status --no-renames`; R25 checks committed-tree removal completeness, not prose.
8. **What is not verified** — dependency declaration/bundling consistency is not dependency safety; relative closure remains independently covered; TypeScript parsing is error-tolerant and a returned tree is not syntax validity; R25 is not proof of a well-formed archive; AI analysis is not approval or assurance.

Every command listed must be one actually run, with its real result. Phrase CI as a pre-merge requirement until it passes.

---

### Task 13: Verify the archive candidate

**Stage (a), pre-stage, empty index** — the full list from the "Verification is split in two" section, plus:

```bash
openspec list
```

Expected: `openspec list` reports no active changes; archived validation includes the new archive; SDK 19 gates and contract 14 tests pass; index clean throughout.

**Stage (b) is deferred to Task 14** — it needs the commit.

---

### Task 14: Stage, commit, verify committed geometry, push, open the PR

**Step 1 — stage the relocation allowlist**

```bash
git add -A -- openspec/changes/reject-undeclared-shipped-imports \
  "openspec/changes/archive/<ARCHIVE_DATE>-reject-undeclared-shipped-imports"
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
git status --porcelain=v1 --untracked-files=all
```

Expected: only active-path removals and dated-archive additions. No canonical spec change — the archive PR must not touch `openspec/specs/**`, or association fails (verified mechanic 1). No implementation change, no plan file.

**Step 2 — commit**

```bash
git commit -m "docs(openspec): archive reject-undeclared-shipped-imports"
git rev-parse HEAD
git show --name-status --no-renames HEAD
git ls-tree --name-only HEAD openspec/changes/
```

Call the head `A`. Require **seven `A` entries and six `D` entries**, and no active change path at HEAD.

**Step 3 — stage (b), post-commit**

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main
node openspec/scripts/run-governance-dual-check.mjs
```

Expected: final phase passes with no `archive-relocation-incomplete` and no association failure, naming the relocated paths; dual check agrees. A bare pass with no scope line means the range was empty and the run is void.

Red here: `git reset --soft HEAD~1`, fix, return to Task 12.

**Step 4 — push**

```bash
git push -u origin docs/archive-reject-undeclared-shipped-imports
git ls-remote --heads origin refs/heads/docs/archive-reject-undeclared-shipped-imports
git rev-parse HEAD
```

**Step 5 — open the PR**

Title: `docs(openspec): archive reject-undeclared-shipped-imports`

Body includes M1, F/M2, the #69 closure, A; task state 13/13 and why closure preceded the archive; the six byte identities; the seven-A/six-D tree proof; canonical presence; every stage (a) and stage (b) result actually obtained, distinguished from each other; the explicit note that no pre-commit final-phase result is claimed; authorization exclusions; owner identity-preserving merge required. It must not claim CI passed before it does.

Read the body back from GitHub and verify head `A`. Then watch checks; require every required context green, stable `MERGEABLE` / `CLEAN`, live head `A`. Report merge readiness. The owner merges.

---

### Task 15: Verify the archive merge and post the follow-up

```bash
git fetch --prune origin
gh pr view <ARCHIVE_PR> --repo nandohdc/bloodtrail --json state,mergedAt,mergeCommit,headRefOid
```

Call the merge `M3`. Verify: exactly two parents, prior main + exact A; A and all PR #190 and fold commits reachable from `origin/main`; M3 tree equals A tree; active path absent; dated archive present; canonical requirement still present once; local main fast-forwards exactly.

Then post one short follow-up comment on the closed #69 carrying the archive permalink at A or M3, and nothing else. Do not modify the landed archive. Do not reopen the issue.

---

### Task 16: Trailing documentation PR

**Only after M3.** One PR, two commits, both `documentation_only` paths needing no OpenSpec change (verified mechanic 6).

- `docs(adr): record the spec-fold and governance-verification decisions`
  - `docs/adr/0001-fold-canonical-spec-while-change-is-active.md` — fold while the change is active, versus the keeper-change pattern (`cover-bundle-archive-spec-fold`, which reproduced `openspec-association-unrelated` in a disposable worktree at `6056ded`), versus amending the perimeter (rejected there). Consequence: three PRs per capability-bearing change, and the archive becomes self-covering. Include the lifecycle vocabulary — *fold* vs *sync*, *archive* as directory vs act, *candidate* vs *change*, *coverage*, *freeze*, *identity-preserving merge*, *keeper change*.
  - `docs/adr/0002-verify-governance-post-commit.md` — verify the governance perimeter after committing, against CLAUDE.md's "verification runs before `git add`", with `check-design-pattern-governance.mjs:322` as the force and issue #191 as the tracked defect.
  - Reference source by `file:line` or indent snippets: `checkHiddenImplementation` fires on `documentation_only` paths for `export function …` at line start (verified mechanic 7).
- `docs(hermes): add the issue 69 lifecycle plan` — this file, per the batched convention (verified mechanic 8).

---

## Files likely to change

**Fold PR — exactly two tracked paths**

- Modify `openspec/specs/security-audit-sdk-core/spec.md`
- Modify `openspec/changes/reject-undeclared-shipped-imports/tasks.md`

**Archive PR — relocation only**

- Remove `openspec/changes/reject-undeclared-shipped-imports/`
- Add `openspec/changes/archive/<ARCHIVE_DATE>-reject-undeclared-shipped-imports/`
- Modify within the moved tree: `tasks.md`
- Create within the moved tree: `archive-evidence.md`

**Trailing docs PR** — `docs/adr/0001-*.md`, `docs/adr/0002-*.md`, this plan file.

**External state** — fold PR, archive PR, #69 evidence comment and closure, #69 follow-up comment, #191 (filed).

**Explicitly excluded from both candidates**

- this plan file; `packages/security-audit-sdk-core/**`; `contracts/security-audit/**`; `verification-lifecycle.json`; generated artifacts; manifests and lockfiles; `openspec/scripts/**`, `openspec/tests/**`, policies, registries, governance configuration; any #70, #71, or #191 implementation; branch deletion, merge execution, force-push, rebase, squash, amend, publication, production authorization.

---

## Risks and residuals

1. **`main` moving.** PR #182 is held for this reason. If anything else lands, re-fetch, classify every intervening commit, and re-run the relevant stage against the new baseline. Never rebase a pushed candidate.
2. **A vacuous governance run recorded as evidence.** The single most likely failure of this plan, and the one the previous revision made. Stage (b) exists only to prevent it; a final-phase pass whose output names no paths is void (issue #191).
3. **Post-fold archive ownership.** A relocated change loses canonical-spec ownership. The archive PR must not touch `openspec/specs/**`.
4. **Spec merge drift.** The sync must add the full requirement once and preserve every pre-existing scenario. Copying the delta file wholesale leaks `## ADDED Requirements` and is invalid. Re-syncing during the archive would compound it.
5. **Archive byte identity.** R25 proves source-removal completeness, not byte identity. Compare the five immutable blobs independently; `tasks.md` and `archive-evidence.md` are the only intended exceptions.
6. **No signed record.** Unsigned is the established state for this change. Do not fabricate owner approval or touch `verification-lifecycle.json` as incidental archive work.
7. **Analyzer authority.** CodeScene, Sonar, and other remote checks are authoritative only at the exact PR head. Never claim local substitution.
8. **Untracked plan contamination.** This file must never enter either candidate's allowlist.
9. **Archive date.** Compute at execution time; never stack a second date.
10. **Stop boundary.** After #69 is verified closed and M3 verified, report #70 as the next dependency-ordered item. Do not begin it.

---

## Completion report requirements

Report separately: implementation merge verification; fold commit/PR/merge identities and exact two-file scope; canonical semantic counts; issue #69 state, roles, and comment permalink; archive commit/PR/merge identities and the A/D tree proof; the six immutable blob comparisons; final task state 13/13; every stage (a) and stage (b) result actually obtained, with the two kept distinct; production/publication scope unchanged; what was not verified or not performed; branches left in place as owner-owned housekeeping.
