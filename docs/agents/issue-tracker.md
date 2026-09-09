# Issue Tracker

The execution tracker for this repository is **GitHub Issues**, in the
`nandohdc/bloodtrail` repository.

Hermes Kanban is retained for fleet runs but is **not** authoritative for
execution state. An agent MUST NOT read the board to decide what is done.

`decision_source = "delegated to Claude by the owner, 2026-09-09; not a human
owner decision"`. This is a delegated operational decision recorded under #308,
and it is reversible in one edit — see *Reversing this* below.

## Why the previous statement was withdrawn

This document previously stated that Hermes Kanban was canonical and that GitHub
Issues were an intake surface only. Issue #308 recorded a working day in which
13 pull requests merged and 7 issues closed while the board stayed
byte-identical, and asked which of three readings was intended.

Five days later the gap is not an outage-shaped blip. Between `2026-09-04` and
`2026-09-09`:

| Measure | Count |
| --- | --- |
| Pull requests merged | 114 |
| Issues closed | 36 |
| Merged pull requests carrying a `Hermes-Task:` trailer | 1 |
| Net board movement | 1 card |

The board's `todo` column still holds cards for issues that are closed. A tracker
that recorded one of 114 merges is not drifting from canonical — the work is
somewhere else, and every agent that read this file was being pointed away from
it.

## Where execution state actually lives

- **What to work on**: the open issue set, ordered by the `Depends on #N` edges in
  each issue body. The roadmap tracker issue (#132) carries the wave checklists.
- **Whether something is done**: the issue's state. An issue is closed when its
  acceptance criteria are met, not when a pull request merges.
- **How it was done**: the pull request, its required checks, and the OpenSpec
  change under `openspec/changes/` (active) or `openspec/changes/archive/`
  (landed).

A pull request does not mean an issue is complete. Governed work completes across
several pull requests — proposal, implementation, canonical fold, archive — and
the issue closes after the last of them.

## Referencing

Reference the issue in the pull request body:

    Refs #112

Use `Fixes #N` only once the fix has actually landed: GitHub auto-closes on merge
with no lifecycle awareness, so `Fixes` in a *proposal* pull request closes the
issue while the work is still ahead of you.

Where a Hermes Kanban task does back a run, keep recording it:

    Hermes-Task: t_abcd1234

## Hermes Kanban

The board still exists and fleet runs still use it. Two rules keep it from
becoming misinformation:

- It is **not** evidence of execution state. Do not infer from a card's status
  that work is or is not done; read the issue.
- Workers running under Hermes Kanban MUST use the native `kanban_*` tools
  (`kanban_show`, `kanban_comment`, `kanban_create`, `kanban_link`, `kanban_block`,
  `kanban_request_review`, `kanban_request_changes`, `kanban_complete`) and MUST
  NOT shell out to `hermes kanban ...`.

Completion inside a fleet run still follows `docs/agents/orchestration.md`.

## Reversing this

If Hermes Kanban is meant to be canonical, the repair is operational rather than
documentary: reconcile the board against the closed-issue set — `~/.hermes/scripts/bloodtrail-kanban-sync.py`
exists for this — and then restore the previous statement here and in
`docs/agents/triage-labels.md`, `CLAUDE.md`, and `AGENTS.md`. Nothing else depends
on which tracker this file names.
