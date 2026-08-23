# Issue #169 — Retire Branch `chore/update-openspec`: Land the Four Latent Cleanups — Plan

> **For Hermes:** This is a **retirement record**, not a feature. The branch is gone and unrecoverable
> from `origin`; what keeps #169 open is four unlanded dead-symbol removals. The issue's own suggested
> disposition — "fold into the next change that already touches these files" — is correct and is the whole
> plan. **Do not open a standalone OpenSpec cycle for four dead identifiers**: each lands on a governed
> path and would otherwise cost a full exact-commit T/S cycle for a change with no behavioural content.
> One of the four now has a natural host: #201's retirement change already edits
> `tests/verification/mutations.test.mjs`. Match the folds to hosts, and close #169 only when all four are
> on `main`.

**Goal:** Land four dead-symbol removals as riders on changes that already touch their files, then close
#169 with the exact commit for each.

**Status at this baseline:** READY, but **deliberately blocked on hosts** — three of the four have no
scheduled host yet. This is a queue, not a task.

**Architecture:** None. Four deletions of one identifier each, none of which changes behaviour.

**Tech Stack:** `git`, `gh`, the SDK gate chain, `cs delta`.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #169, OPEN, **no labels at all** |
| Native GitHub blockers | `blocked_by` is `0` |
| Retired branch | `chore/update-openspec`, deleted 2026-08-17, commit `5f781a6c04846e1366280c1a35b12d4e6a2c09b3` |
| Branch absence | `origin` carries only `main` and `release-please--branches--main` plus in-flight PR branches |
| Already superseded | `review-freshness.mjs` → `byCodePoint`; `documentation.mjs` regex → `String.raw` (both landed with the archive-relocation repair) |
| Lifecycle mode | `archived` |

### The four cleanups, re-verified at this baseline

| # | Path | Symbol | Occurrences | Path class |
| --- | --- | --- | --- | --- |
| 1 | `packages/security-audit-sdk-core/scripts/check-coherence.mjs:4` | `assert` (import only) | 1 | `governed_implementation` |
| 2 | `packages/security-audit-sdk-core/tests/f08-retention.test.ts:27` | `AuditDeliveryResult` (type import only) | 1 | `governed_implementation` |
| 3 | `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs:1106` | `command()` (declaration only) | 1 | `governed_implementation` |
| 4 | `research/browser-telemetry/poc/run.mjs:2` | `readFile` (import only) | 1 | `governed_implementation` |

Each identifier occurs **exactly once** in its file, at the declaration or import, with no use anywhere in
that file. Verified by count, not by eye.

---

## Proven findings

### F1 — The record is accurate and #169 is not closeable as-is

The branch is confirmed absent, the two superseded hunks are confirmed on `main`, and all four latent
cleanups are confirmed present. Nothing has rotted since the 2026-08-22 refresh comment.

### F2 — Item 3 has a host **right now**

#201 (`retire-superseded-scope-regexes`) renames a test in
`tests/verification/mutations.test.mjs`. That change already pays the governance cost of touching that
file. Removing the dead `command()` helper in the same commit costs nothing extra and **reduces** the
file, which helps rather than hurts `codescene delta` on a known hotspot.

### F3 — Item 1 has a likely host, and it is not soon

`scripts/check-coherence.mjs` is edited whenever a pinned constant moves — ADR count, task count, engines,
catalog counts. The next such change is #76 (contract-version policy) or #83 (topology materialization),
both blocked on owner decisions. **Do not wait indefinitely**: if no host appears, item 1 may ride with
item 3 in #201's change, since both are in `packages/security-audit-sdk-core/` and #201 already carries
that path class.

### F4 — Items 2 and 4 have no scheduled host, and item 4 crosses a workspace

`tests/f08-retention.test.ts` changes when F-08 retention behaviour changes — nothing open touches it.
`research/browser-telemetry/poc/run.mjs` is in a different workspace with its own `lint`/`test`/`audit`
jobs; folding it into an SDK change means one PR touching two workspaces, which is legal but makes the
change's assessment span two areas. Prefer folding item 4 into a research-area change, or accept the
two-workspace assessment consciously.

### F5 — `mutations.test.mjs` is a hotspot; check the delta even for a deletion

A removal should improve the file's health, but `codescene delta` scores the whole file against
file-level rules, so it can fail for reasons unrelated to the edit. Check before assuming it is free.
Separately: **CodeScene silently skips any function whose parameter list uses the `readonly` type
modifier**, so a green delta is never proof a function is healthy — SonarQube is the complement.

### F6 — DeepScan and SonarQube both already pass with these four present

Neither analyser is currently failing on them, which is precisely why they have survived. **These are
cosmetic.** Do not let the cleanup grow into a lint sweep; four identifiers, no more.

### F7 — #169 is unlabelled, which makes it invisible to every triage query

Every other open issue carries a category and a state role. #169 carries none, so it appears in the
"Unlabeled — never triaged" bucket of any `/triage` sweep and gets re-triaged repeatedly. Label it
`chore`-shaped: the closest existing categories are the `documentation` label plus a state role of
`ready-for-agent`. **Fix this first** — it costs one command and stops the loop.

---

## Decisions taken

1. **No standalone OpenSpec change.** Four dead identifiers do not justify a governed cycle.
2. **Fold item 3 into #201's change.** It is the only fold available today, and it is strictly beneficial.
3. **Fold item 1 into #201's change too** if no closer host appears within that change's lifetime — same
   package, same class, same assessment.
4. **Items 2 and 4 wait for a genuine host** and are re-checked on every triage sweep.
5. **#169 closes only when all four are on `main`**, each with its landing commit named.
6. **Never revive the branch.** `5f781a6c` is unreferenced and the repository's history must not be
   rewritten to reach it — the governance gates derive anchors from `main`'s history.

---

## Task 0: Label the issue so it stops being re-triaged

- [ ] 0.1 `gh issue edit 169 --add-label "documentation" --add-label "ready-for-agent" --add-label "area:core"`
- [ ] 0.2 Post a one-line comment recording that #169 is a queue with four items and closes only when all
      four land. Carry `> *This was generated by AI during triage.*`.

## Task 1: Fold item 3 (and possibly item 1) into #201

- [ ] 1.1 In #201's implementation commit, delete the `command()` helper at
      `tests/verification/mutations.test.mjs:1106`.
- [ ] 1.2 Re-run `npm run test:verification --prefix packages/security-audit-sdk-core`. A helper with no
      callers cannot break a test; if something fails, it had a caller and F1's occurrence count was
      wrong — stop and re-measure.
- [ ] 1.3 `cs delta` — confirm the deletion does not trip a file-level rule (F5).
- [ ] 1.4 If item 1 rides along, delete the unused `assert` from `scripts/check-coherence.mjs:4` and re-run
      `npm run test:coherence`.
- [ ] 1.5 Mention both in #201's PR body under a "folded cleanups" heading, citing #169. **Do not** add
      them to #201's acceptance criteria — they are riders, not scope.
- [ ] 1.6 Comment on #169 with the exact commit for each item that landed.

## Task 2: Queue items 2 and 4

- [ ] 2.1 Record on #169: item 2 waits for a change touching `tests/f08-retention.test.ts`; item 4 waits
      for a change touching `research/browser-telemetry/`.
- [ ] 2.2 On every triage sweep, re-check whether a host has appeared, and re-verify the occurrence counts
      before folding — a symbol that gained a caller is no longer dead.

## Task 3: Close #169

- [ ] 3.1 Only when all four are on `main`.
- [ ] 3.2 Closing comment: a four-row table of item → landing commit → host change.
- [ ] 3.3 State that `chore/update-openspec` is retired permanently and `5f781a6c` will not be revived.
- [ ] 3.4 `gh issue close 169 --reason completed`.

---

## Validation matrix

| Item | Check | Passing condition |
| --- | --- | --- |
| 1 | `npm run test:coherence` | passes; all pinned rules still evaluated |
| 2 | `npm run test:runtime` | `f08-retention` suite passes |
| 3 | `npm run test:verification` | full suite passes; `cs delta` green |
| 4 | `npm run lint --prefix research/browser-telemetry` | syntax check passes |
| all | `npm run validate --prefix packages/security-audit-sdk-core` | full gate chain green on the host PR |

## Risks and open questions

- **The fold could be rejected as scope creep on its host PR.** Pre-empt it: name #169 in the PR body and
  keep the diff to one identifier per file.
- **Waiting forever.** If items 2 and 4 have no host after two more triage sweeps, ask the owner whether
  a single `chore:` PR carrying all remaining items is preferable to indefinite deferral. That is an
  owner call, not an agent call — it trades one governed cycle against carrying an open issue.
- **Do not expand into a lint sweep.** There is no ESLint or Prettier in this repository by design; strict
  `tsc`, SonarQube and CodeScene serve that role. Four identifiers is the whole scope.

## What this does not authorize

Reviving the deleted branch, rewriting `main`, opening a standalone governed cycle for cosmetic removals,
or any broader static-analysis cleanup.

## What this plan did not verify

Whether `cs delta` passes on a deletion inside `mutations.test.mjs` — measure it in Task 1.3, since the
hotspot could fail on file-level rules regardless of the edit.
