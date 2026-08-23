# Issue #202 — Classify Every Unclassified Repository Path — Closure Plan

> **For Hermes:** **Do not implement this issue. It is already implemented.** The nine classifications
> landed on `main`, the completeness requirement was folded into the canonical spec by PR #205, and the
> archive commit is sitting in open PR #206. What remains is landing one PR, confirming one CI result on
> a *different* PR, and closing the issue with evidence. If you find yourself opening an OpenSpec change
> for #202, you have misread the state — stop and re-read Task 0. Do **not** merge PR #206 yourself; the
> owner merges.

**Goal:** Land the archive, confirm the release PR is unblocked, and close #202 with a closing comment
that names the exact commits and the residual it does not cover.

**Status at this baseline:** CLOSURE — implementation complete, lifecycle tail open.

**Architecture:** Nothing to design. The change
`openspec/changes/archive/2026-08-23-classify-unclassified-governance-paths` is the whole artefact; the
policy edit is already merged; the canonical requirement is already folded.

**Tech Stack:** `gh`, `git`, `node openspec/scripts/check-design-pattern-governance.mjs`, openspec CLI 1.10.0.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #202, OPEN, labels `bug` `severity:medium` `verification` `openspec-change-needed` `area:core` `ready-for-agent` |
| Native GitHub blockers | `issue_dependencies_summary.blocked_by` is `0` |
| Spec fold | `fadb4e9` — `docs(openspec): fold path classification completeness into the canonical spec`, merged via PR #205 (`1948f9f`) |
| Release-PR evidence commit | `bad7d81` — `docs(openspec): record the release PR governance result for task 4.2` |
| Archive PR | **#206**, `docs/archive-classify-unclassified-governance-paths`, MERGEABLE, commits `d283e2d` + `9019d2f` |
| Archive directory | `openspec/changes/archive/2026-08-23-classify-unclassified-governance-paths` |
| Active OpenSpec changes | none — `openspec/changes/` contains only `archive/` |
| Release PR | **#182** `chore: release v0.4.0`, files `.release-please-manifest.json` `CHANGELOG.md` `version.txt` |
| Follow-on issue | #203 (R14 benign-widening enforcement), filed from this change's own residual |
| Lifecycle mode | `archived` |
| Required PR checks | `ci / lint`, `ci / test`, `ci / audit`, `sdk`, `contract`, `sonar`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |

---

## Proven findings

### F1 — Every one of the nine paths is classified on `main` today

Read directly from `openspec/governance/design-pattern-policy.json` at `1948f9f`:

| Path | Class today |
| --- | --- |
| `.codescene/custom-quality-gates.json` | `governance_core` |
| `.github/scripts/` | `governance_core` |
| `.gitignore` | `governance_core` |
| `codecov.yml` | `governance_core` |
| `openspec/config.yaml` | `governance_core` |
| `release-please-config.json` | `governance_core` |
| `sonar-project.properties` | `governance_core` |
| `.release-please-manifest.json` | `documentation_only` |
| `version.txt` | `documentation_only` |

That is exactly the split #202's "Required work" prescribes — seven raised to `governance_core`, two widened
to `documentation_only` beside `CHANGELOG.md`. No already-classified path moved class.

### F2 — The widening acknowledgement exists, and its gap is already a separate issue

`docs/adr/0005-classify-every-tracked-repository-path.md` records the `documentation_only` widening, and
`d283e2d` adds the acknowledgement to the assessment. The ADR says explicitly that no gate verified that
acknowledgement — which is #203, filed for exactly that residual. **#202's own acceptance criteria never
required the mechanical check**; its "Out of scope" excludes it by name. Do not hold #202 open for #203.

### F3 — The only unfinished acceptance criterion is #182's re-run, and it is in flight

`gh pr checks 182` at this baseline shows `design-pattern-governance` **pending**, on a run started after
the classification landed on the base. `sdk`, `contract`, `codescene delta`, `conventional-commits`,
`coverage` and both static analysers already pass. This is the criterion "PR #182 re-runs
`design-pattern-governance` green against the updated base" resolving in real time — read it, do not
re-trigger it.

### F4 — PR #206 is the last artefact, and it is documentation-only in class terms

Its two commits touch `openspec/changes/` (`governed_implementation`) and the archive move. The change
being archived is its own OpenSpec association, so the perimeter is satisfied by construction. Nothing in
it touches `governance_core`, so no fresh signed record is needed beyond what the change already carries.

### F5 — The dependency graph is documentary, not mechanical

`issue_dependencies_summary.blocked_by` is `0` for #202 — and for every other open issue in this
repository. "Depends on #N" lines in issue bodies are prose. Nothing will stop a premature start except a
person reading the body. Treat that as true for every plan in this directory.

---

## Decisions taken (settle these; do not re-litigate)

1. **#202 is not reopened for #203's gap.** The mechanical acknowledgement check is a named out-of-scope
   item in #202's body and has its own issue.
2. **Do not re-run or re-push #182.** It is a release-please branch under automation; rebasing or
   force-pushing it rewrites history under the bot. Read its check result only.
3. **The owner merges #206.** Report readiness; do not run `gh pr merge --admin`.
4. **The closing comment carries the AI-triage disclaimer** (`> *This was generated by AI during triage.*`)
   because it is posted during a triage-shaped pass.

---

## Task 0: Preflight — re-measure, do not assume

```bash
cd /Users/fernando.costa/Git/bloodtrail
git fetch origin --quiet
git log -1 --format='%H %s' origin/main
gh pr view 206 --json state,mergeable,statusCheckRollup
gh pr checks 182
gh issue view 202 --json state,labels
ls openspec/changes/                       # expect: archive
ls openspec/changes/archive/ | grep classify
```

- [ ] 0.1 `origin/main` is at or ahead of `1948f9f`.
- [ ] 0.2 PR #206 still OPEN and MERGEABLE. If it merged already, skip to Task 2.
- [ ] 0.3 Record #182's `design-pattern-governance` conclusion verbatim. If it **failed**, stop and treat
      that as a live defect in the classification, not a flake — read the diagnostic before doing anything
      else.
- [ ] 0.4 Confirm the nine classifications from F1 are present in the policy at `origin/main`.

## Task 1: Land the archive PR

- [ ] 1.1 Wait for all nine required checks on #206 to conclude. Do not merge on a partial rollup.
- [ ] 1.2 If `sonar` is red, re-read it before assuming code: the self-hosted server is the usual cause,
      the job already retries once, and its "Explain quality gate failure" step prints the failing
      conditions.
- [ ] 1.3 Report to the owner: "#206 is green and ready to merge with `gh pr merge --admin --squash`."
      **Do not merge.**
- [ ] 1.4 After the owner merges, `git fetch origin` and confirm
      `openspec/changes/archive/2026-08-23-classify-unclassified-governance-paths` is on `main` and
      `openspec/changes/` holds only `archive/`.

## Task 2: Confirm #182 and record the result

- [ ] 2.1 `gh pr checks 182` — capture the `design-pattern-governance` line with its run URL.
- [ ] 2.2 If green: that is the last acceptance criterion. If red: capture the diagnostic ids and **stop**;
      open a defect rather than closing #202.
- [ ] 2.3 Note that a green here proves the *release shape* passes governance. It does **not** authorize a
      release. `RELEASING.md` and the authorization boundary are untouched by a path classification.

## Task 3: Close #202 with evidence

- [ ] 3.1 Post the closing comment (below) with `gh issue comment 202 --body-file ...`.
- [ ] 3.2 `gh issue close 202 --reason completed`.
- [ ] 3.3 Remove `ready-for-agent`; the issue is done, not queued.
- [ ] 3.4 Post a one-line pointer on #132's tracker thread — #202 is explicitly *not* a wave item, so do
      **not** edit a wave checklist. #132's own last comment sets that precedent for #201.

### Closing comment

```markdown
> *This was generated by AI during triage.*

## Closed as implemented — `main@<merge-sha>`

**What landed.** All nine previously unclassified tracked paths now resolve to a declared class in
`openspec/governance/design-pattern-policy.json`: seven raised to `governance_core`
(`.codescene/custom-quality-gates.json`, `.github/scripts/`, `.gitignore`, `codecov.yml`,
`openspec/config.yaml`, `release-please-config.json`, `sonar-project.properties`) and two widened to
`documentation_only` beside `CHANGELOG.md` (`.release-please-manifest.json`, `version.txt`).

**Completeness control.** Folded into the canonical `software-design-pattern-governance` spec by
`fadb4e9` (PR #205) and archived as `2026-08-23-classify-unclassified-governance-paths` by PR #206.

**Release PR.** #182 re-ran `design-pattern-governance` against the updated base: <result + run URL>.
A green result proves the release *shape* passes governance. It authorizes no release.

**Acknowledged residual, tracked elsewhere.** R14's benign-widening scenario still has no mechanical
enforcement — the `documentation_only` widening here is acknowledged in the proposal, in
`docs/adr/0005-classify-every-tracked-repository-path.md`, and in the signed record, but no gate verified
that acknowledgement. That is #203, filed from this change and deliberately out of scope here.

**What this does not prove.** Completeness proves every tracked path carries a declared class. It does
not prove the class assigned to each path is the *correct* one.
```

---

## Validation matrix

| Criterion (from #202) | Where it is satisfied | State |
| --- | --- | --- |
| Every tracked path resolves to a declared class | policy at `1948f9f` (F1) | ✅ |
| Uncovered paths fail with a distinct diagnostic naming all of them | completeness control, archived change | ✅ |
| Removing a sole-covering pattern fails | mutation arm in the archived change | ✅ |
| New tracked path + classification in one commit passes | mutation arm | ✅ |
| Untracked/ignored files impose no obligation | mutation arm | ✅ |
| Emergency record does not satisfy completeness | mutation arm | ✅ |
| Enumeration failure fails closed | mutation arm | ✅ |
| No already-classified path changes class | F1 before/after diff | ✅ |
| PR #182 governance green | Task 2 | ⏳ in flight |
| Archive landed | Task 1 | ⏳ PR #206 |

## Risks and open questions

- **#182 could still fail.** If it does, the classification is wrong somewhere and #202 must stay open.
  The most likely candidate is a path the release bot writes that nobody enumerated — re-run the
  `longestMatch` sweep over `git ls-files` before concluding anything.
- **Merging #206 while #182 is mid-run** is harmless; #182's base is `main` and its next re-run picks up
  whatever is there.
- **`.gitignore` is now `governance_core`.** Routine edits to it now cost a full assessment. That is
  deliberate and recorded, but it will surprise the next person who adds an ignore line.

## What this does not authorize

A release, a publication, a tag, or any change to `RELEASING.md`'s boundaries. Classifying a release path
grants no publication authorization — #202's own body says so.

## What this plan did not verify

Whether each of the nine classes is the *right* class. The check is completeness, not correctness, and no
mechanism in the repository asserts correctness.
