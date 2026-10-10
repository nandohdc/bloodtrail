# Design

## Context

See `proposal.md` for #744's defect and #747's settled boundary. #642 already provides a fail-closed entry parser, git resolver, REST description client, and required check on release ranges. This change reuses those seams; it does not replace them or change workflow wiring.

Today `cleanSection` returns the original text early when there are no duplicates, CLI `processCleanResults` writes only when duplicates were dropped, and `cleanPullRequestBody` returns early on a zero drop count. All three gates must allow keyword-only content changes. Current checks derive cleanliness from the drop count; cleaning first would hide the very directive they must reject.

## Goals / Non-Goals

**Goals:** Keep each issue link while removing its closing semantics, retain the existing de-duplication invariants, and independently reject dirty original inputs. Repeated cleaning is a no-op on already neutralized text.

**Non-Goals:** A general Markdown parser or arbitrary GitHub closing-syntax support. The bounded grammar is Release Please's lowercase `closes [#digits]` form. No changes to commit classification, release configuration, credentials, permissions, workflows, historical notes or package identity. Do not collapse distinct non-merge identical-subject entries or intermediate commits.

## Decisions

### D1. Neutralize in the existing cleaner after identifying duplicate lines

Add `neutralizeClosingKeywords(text)` in `clean-release-changelog.mjs`, converting `closes` to `refs` for linked numeric references, preserving the link and every other byte. The proposed replacement is `text.replaceAll(/([,\s])closes(\s+\[#\d+\])/g, "$1refs$2")`, or an equivalent that also handles the form at the start of a description line.

`cleanSection` parses and resolves entries using the existing fail-closed logic, identifies duplicate merge lines, then neutralizes kept lines even when no duplicate was found. `cleanChangelog` receives that output through `cleanSection` only for selected sections: default latest, explicit target, all, or standalone snippet. Unselected historical text is unchanged. `cleanPullRequestBody` uses the same cleanup and neutralizes the description, including closing text outside recognised commit bullets.

Extend `ENTRY_REGEX` from `closes` to `(?:closes|refs)` while preserving its multiple-linked-reference grammar. Subject extraction excludes the suffix in both forms. The separate ratified distinct-non-merge rule stays untouched: only duplicate merge twins are removed, never distinct branch entries with identical subjects.

### D2. Persist actual text changes, not only duplicate removals

CLI `processCleanResults` compares original content against cleaned content before writing. `cleanPullRequestBody` compares the GET body against cleaned text before PATCHing, even if `droppedEntries.length` is zero. Retain GET/PATCH response verification, line-ending normalization, injectable fetch, existing credentials, and all fatal REST error paths. An already neutralized body causes no PATCH and an unchanged file causes no write.

### D3. Check original selected text independently of the neutralizer

Before cleaned output can mask a directive, check for `/\bcloses\s+\[#\d+\]/` in raw selected lines and report the offending entry or line. Apply this through `checkChangelog`, ordinary CLI `--check`, `verifyChangelogSectionClean`, and `verifyEventDescriptionClean` / `checkReleaseRange`. Check mode never writes or calls REST. Description validation covers the whole input body, not just parsed commit bullets.

Keep missing-section, malformed-entry and unresolvable-commit failures. The release-range path still skips all section/description work when `version.txt` is unchanged. Closing-keyword checks share the same section selection as cleaning; historical unselected sections cannot fail unrelated work.

### D4. Prove behavior through existing entry points

Use the existing `.github/scripts/clean-release-changelog.test.mjs` exported-function and subprocess seams, not internal regex-shape tests. Cover linked keyword-only neutralization, refs merge-twin parsing, targeted/snippet cleanup and idempotency, actual CLI writes, mocked REST GET/PATCH/verification and no-op, raw section and description check failures with named input, refs success, and unchanged fixture files under checks.

For the planted control, copy the module to an external disposable fixture and replace only the neutralizer implementation with identity, asserting exactly one mutation matched. Cleaning must then emit `closes`, and that mutant's real check-mode command must exit nonzero naming the directive and entry. Exercise the release-range/event-description path in disposable git repositories with resolvable commits and version history. Never mutate the live worktree or add production test hooks. Keep all existing preservation and failure cases.

### D5. Reject alternatives against the forces

- **Custom Release Please plugin / configuration changes:** rejected because the allowed boundary excludes Release Please config, manifest and release workflow while a release PR is open, and a plugin increases dependency surface for a one-word output correction.
- **Drop issue suffixes entirely:** rejected because traceability links are valuable and must remain intact; deletion destroys provenance beyond the closing semantics being removed.
- **Allow GitHub auto-close and reopen post-merge:** rejected because GitHub Issues is the authoritative tracker; reopening is unreliable, creates tracker churn and notifications, and leaves release history falsely claiming closure. Prevention plus an independent required check avoids that side effect.

## Risks / Trade-offs

- A new generator shape escapes the bounded rewrite → raw checks fail closed for the supported closing form; unknown linked entry shapes retain existing fatal parsing. Extend support only through a governed change, not an arbitrary trailing-text parser.
- A no-duplicate early return silently bypasses neutralization → test keyword-only writes/PATCHes explicitly, and disable the neutralizer in the planted control to prove the independent checker detects the defect.
- Automation regenerates the release output → reuse the existing cleanup and edited-description required check, with no workflow changes; this run does not claim live regeneration evidence.
- A check blocks a release before cleanup finishes → expected fail-closed behavior; only the cleaned head and description may pass.

## Migration Plan

1. Commit the seven-file proposal packet with only task 1.1 checked, after strict delta validation and assessment-phase governance.
2. In a separate implementation commit, modify only the cleaner, its existing tests, and task completion state; run focused and all-script tests, typecheck/syntax checks, OpenSpec and final/dual governance gates, and `make runtime-gates` against the fixed baseline.
3. Owner/mainline integration must land the fix before the release after v0.22.0 merges. v0.22.0 remains as generated; no live release or tracker mutation occurs here. Observe regeneration and GitHub closure-link removal there, not as local proof.
4. Fold #751 and archive #754 are separate tickets and PRs. Canonical specs and archive paths remain untouched in this run.

Rollback is a revert of the implementation, not rewriting published notes. It restores the hazard, so a release must not merge with closing directives pending a corrected governed fix.
