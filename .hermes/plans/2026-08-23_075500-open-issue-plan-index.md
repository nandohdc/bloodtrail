# Open-Issue Plan Index — Implementation Order — 2026-08-23

> **For Hermes:** One plan per open issue, all written read-only against
> `origin/main@1948f9f5d4a86471e7b8fba6cfb80268802cde9c` on 2026-08-23. **Filenames sort in implementation
> order**, so `ls .hermes/plans/2026-08-23*` gives you the execution sequence directly. This index is a
> routing table, not a plan.

**Scope:** 57 open issues, 57 plans, plus this index.

> **Revision — 2026-08-23, later the same day.** The table below is a snapshot against
> `1948f9f5` and is left intact; four things have changed since, and where they contradict the snapshot,
> this note wins:
>
> - **Three of the four owner decisions are answered** — #75 EXACT_ONE, #77 option C (bounded module-copy
>   scope with a single-copy Core), #80 ratify standalone against a declared four-package target. #117 is
>   still open and cannot be closed by a recommendation. See C2.
> - **#77's answer is not the one its packet recommended.** The packet said instance scope; the resolved
>   measurement showed that would break 35 exported constructors, and that #86's split forces a
>   single-copy Core rather than instance scope. #77, #78, #79 and #86 are all revised.
> - **#98 and #202 are CLOSED.** #191's implementation is merged (`main@9085dde`); its change is still
>   active and awaits archiving.
> - **#102 is startable now** despite sitting at position 11 — its own plan says READY, and it reads the
>   frozen contract rather than writing it.

---

## How the order was derived

A topological sort of the **declared** dependency graph, extracted from each issue body's `## Dependencies`
section, with dependencies on closed issues (#66, #68, #69, #70, #71, #93) dropped.

- **Primary key — depth.** The longest dependency path reaching an issue. Depth 0 means no *open* blocker.
  Because `depth(child) > depth(parent)` always holds, the result is a valid topological order:
  **every issue appears after all of its open dependencies. Verified mechanically: zero violations.**
- **Tie-break — leverage.** Within one depth, the issue that transitively unblocks the most comes first.
- **One deliberate override.** #132 is the roadmap tracker; its own acceptance criteria say it closes only
  when the lifecycle work does, so it sits last regardless of depth. Its *sync procedure* runs on every
  triage pass, not at position 57.

Depth is "when this can be worked", not "how hard it is". Position 1 is an unanswered owner decision, not
an agent task — and that is the point: **the first four items are the bottleneck for two-thirds of the
backlog.**

## The order

| # | Issue | Plan prefix | Depth | Unblocks | Open deps |
| --- | --- | --- | --- | --- | --- |
| 1 | #75 | `080000` | 0 | 36 | — |
| 2 | #77 | `080500` | 0 | 20 | — |
| 3 | #80 | `081000` | 0 | 20 | — |
| 4 | #117 | `081500` | 0 | 14 | — |
| 5 | #98 | `082000` | 0 | 3 | — |
| 6 | #202 | `082500` | 0 | 1 | — |
| 7 | #169 | `083000` | 0 | 0 | — |
| 8 | #191 | `083500` | 0 | 0 | — |
| 9 | #201 | `084000` | 0 | 0 | — |
| 10 | #76 | `084500` | 1 | 30 | #75 |
| 11 | #102 | `085000` | 1 | 20 | #75 |
| 12 | #78 | `085500` | 1 | 19 | #77 |
| 13 | #118 | `090000` | 1 | 13 | #117 |
| 14 | #82 | `090500` | 1 | 3 | #80 |
| 15 | #94 | `091000` | 1 | 2 | #75 |
| 16 | #99 | `091500` | 1 | 2 | #98 |
| 17 | #81 | `092000` | 1 | 1 | #80 |
| 18 | #203 | `092500` | 1 | 0 | #202 |
| 19 | #83 | `093000` | 2 | 17 | #76, #78, #80 |
| 20 | #107 | `093500` | 2 | 15 | #76, #102 |
| 21 | #119 | `094000` | 2 | 12 | #117, #118 |
| 22 | #95 | `094500` | 2 | 1 | #76, #94 |
| 23 | #100 | `095000` | 2 | 1 | #99 |
| 24 | #79 | `095500` | 2 | 0 | #77, #78 |
| 25 | #86 | `100000` | 3 | 13 | #76, #78, #83 |
| 26 | #120 | `100500` | 3 | 11 | #119 |
| 27 | #108 | `101000` | 3 | 8 | #107 |
| 28 | #85 | `101500` | 3 | 2 | #82, #83 |
| 29 | #84 | `102000` | 3 | 0 | #81, #83 |
| 30 | #96 | `102500` | 3 | 0 | #95 |
| 31 | #87 | `103000` | 4 | 11 | #86 |
| 32 | #121 | `103500` | 4 | 10 | #120 |
| 33 | #114 | `104000` | 4 | 2 | #108 |
| 34 | #101 | `104500` | 4 | 0 | #85, #100 |
| 35 | #122 | `105000` | 5 | 9 | #75, #121 |
| 36 | #103 | `105500` | 5 | 8 | #87, #102 |
| 37 | #105 | `110000` | 5 | 7 | #87, #102 |
| 38 | #115 | `110500` | 5 | 1 | #114 |
| 39 | #88 | `111000` | 5 | 0 | #85, #86, #87 |
| 40 | #123 | `111500` | 6 | 8 | #122 |
| 41 | #104 | `112000` | 6 | 7 | #103 |
| 42 | #106 | `112500` | 7 | 6 | #104, #105 |
| 43 | #125 | `113000` | 7 | 6 | #76, #123 |
| 44 | #124 | `113500` | 7 | 1 | #121, #123 |
| 45 | #109 | `114000` | 8 | 5 | #106, #108 |
| 46 | #126 | `114500` | 8 | 5 | #107, #125 |
| 47 | #127 | `115000` | 9 | 4 | #126 |
| 48 | #110 | `115500` | 9 | 2 | #109 |
| 49 | #111 | `120000` | 9 | 2 | #87, #109 |
| 50 | #116 | `120500` | 9 | 0 | #109, #115 |
| 51 | #128 | `121000` | 10 | 3 | #118, #127 |
| 52 | #112 | `121500` | 10 | 0 | #109, #110, #111 |
| 53 | #113 | `122000` | 10 | 0 | #102, #110, #111 |
| 54 | #129 | `122500` | 11 | 2 | #119, #128 |
| 55 | #130 | `123000` | 12 | 0 | #124, #129 |
| 56 | #131 | `123500` | 12 | 0 | #86, #123, #129 |
| 57 | #132 | `124000` | tracker | 0 | — (closes last, by its own criteria) |

## What the order shows

**Depth 0 is nine issues and they can all be worked in parallel.** Four are owner decisions an agent
cannot resolve (#75, #77, #80, #117); five are agent work available today (#98, #202, #169, #191, #201).
Ordering within depth 0 is by leverage, so the decisions lead — but the five agent items do not wait for
them.

**Positions 1–4 gate 36, 20, 20 and 14 issues respectively.** #75 and #77 have been `ready-for-human` with
briefs posted since 2026-08-16 and are unanswered; #80 likewise, and its four declared blockers (#68–#71)
all closed on 2026-08-22, so nothing but the answer is missing. #117 has no brief posted at all.

**#76 at position 10 unblocks 30 issues and will most likely close as already-implemented** — EXACT_ONE is
already enforced by four gates. That makes #75 → #76 the single cheapest way to unblock a third of the
backlog.

**Depth counts effort poorly.** #202 sits at position 6 with depth 0 because it is already implemented and
only needs its archive PR landed; #131 sits at 56 with depth 12 because it is the only Wave 5 item that
also depends on Wave 2. Read the depth column as sequencing, not size.

**#169 is a queue, not a position.** Its four cleanups fold into whichever change next touches each file.
Its label fix is available immediately; its first fold target is #201 at position 9.

## Deviations you may legitimately make

- **Run the depth-0 agent items first** (#202, #169, #191, #201, #98) while the four decisions wait. That
  reorders positions within depth 0 only and violates no dependency.
- **#203 before #201.** Both are depth ≤ 1 verification work; #203 needs #202's archive landed, #201 needs
  nothing.
- **#88 immediately behind #86** rather than at position 39. #86's fourth acceptance criterion ("neutrality
  mutations fail") is satisfied *by* #88, so the gap between them is a window where neutrality is claimed
  and unenforced. The #86 plan recommends landing the `core` role inside #86 and the cross-package movement
  arms in #88.
- **#101 does not need #85.** #101 adds a step to the existing workflow; #85 adds jobs for packages that do
  not exist. The declared edge is nominal and both plans say so, which would move #101 from 34 to
  immediately after #100 at 23.

---

## Cross-cutting findings (true for every issue)

### C1 — The dependency graph is prose, not a gate

`issue_dependencies_summary.blocked_by` is `0` for **all 57 open issues**. Every `Depends on #N` line lives
in an issue body as text, and this ordering was derived by parsing that prose. GitHub's native issue
dependencies — which `docs/agents/issue-tracker.md` documents as the canonical, UI-visible representation —
are unused.

Consequences: nothing mechanically prevents starting a blocked issue; the frontier query in the
issue-tracker doc returns everything and cannot be used to pick work; and #132's "dependency-ordered waves"
document an intention rather than a constraint. **Every plan's Task 0 is therefore a manual gate.**
Materializing the edges natively is proposed in the #132 plan and needs the owner's answer first.

### C2 — Four owner decisions blocked roughly two-thirds of the backlog; three are now answered

| Decision | Position | Unblocks | State (2026-08-23) |
| --- | --- | --- | --- |
| **#75** contract-version support policy | 1 | 36 | **DECIDED — EXACT_ONE** |
| **#77** sdk-core authority scope | 2 | 20 | **DECIDED — option C**, bounded module-copy scope + single-copy Core |
| **#80** multi-package topology | 3 | 20 | **DECIDED — ratify standalone**, four-package target |
| **#117** client-evidence purpose | 4 | 14 | **OPEN** — surface posted, owner record outstanding |

Plus **#114** (position 33) and **#129** (position 54) further out, both still open.

**Recording the three answers is now the critical path**, not taking them. Each needs an OpenSpec change
plus ADRs before its dependants may start: `ratify-contract-version-support-policy`,
`ratify-sdk-core-authority-scope`, `ratify-repository-topology`. All three hit the same trap — the SDK ADR
sequence is pinned at exactly 11 by `check-coherence.mjs:190`, so extend an existing SDK ADR and put the
options analysis in the unpinned root `docs/adr/` sequence.

**#77 did not go the way its packet recommended, and the reason generalises.** The packet said instance
scope, sized as "the registry moves into the instance". The registry does move — but the brand
constructors are **35 exported functions of the public API**, so instance scope is a break across the
whole authority surface. Once that was measured, the forcing function (#86's split) turned out to force a
*single-copy Core*, which module-copy scope satisfies for free. The general lesson: **a packet's
recommendation is only as good as the measurement it skipped.** #77's own Task 0.4 was the skipped
measurement, and it inverted the answer.

**#117 remains the one that cannot be shortcut.** It was retyped from `RESEARCH` to `GOVERNANCE` precisely
because a recommendation is the wrong artefact: only a named owner record, in the shape of
`research/browser-telemetry/reviews/final-project-owner-outcome.md`, can supersede the 2026-07-31
no-adoption decision. Adopting an agent recommendation here would reproduce the exact defect the
2026-08-10 correction fixed. NO-GO remains a clean outcome that closes fourteen issues.

### C3 — Two roadmap holes: authorization gates that exist in Wave 5 and not in Wave 4

Wave 5 has **#121** (position 32), an explicit owner-authorization gate between the proposal and any
implementation. Wave 4's transport / collector / storage chain has **no equivalent**, despite
`severity:high` labels and network trust boundaries. Separately, **#113 requires "an approved governed
inventory" of adapters that does not exist and has no issue.** Both are flagged on their own plans and
recommended for escalation via #132.

### C4 — The repository's recurring defect class is the green that checked nothing

Documented instances: `codescene delta` exited 0 for its entire life because `cs delta` needs
`--error-on-warnings`; the governance perimeter silently skips everything when `base === head` (#191); a
probe's exit 1 turned out to be an `npm ls` harness artefact rather than detection. **Every plan therefore
requires a null control on every arm, and assertions on diagnostics rather than exit status.**

### C5 — `.hermes/plans/` is `documentation_only`

These files sit in the least-restricted governance class, so writing them fires no `governance_core` or
`governed_implementation` trigger and needs no OpenSpec association. `test:git` still applies repo-wide: no
trailing whitespace, no CR bytes, final newline on every file.

---

## Wave view (secondary — the roadmap's own grouping)

| Wave | Issues | Positions | State |
| --- | --- | --- | --- |
| Out of plan | #169, #191, #201, #202, #203 | 6–9, 18 | not in any #132 wave checklist, by convention |
| Wave 2 — version, authority, package, release, Core | #75–#88 | 1–3, 10, 12, 14, 17, 19, 24, 25, 28, 29, 31, 39 | opens on three owner decisions |
| Wave 3 — trust enforcement and governance | #94–#96, #98–#101 | 5, 15, 16, 22, 23, 30, 34 | #98 startable today |
| Wave 4 — delivery, collector, freeze, storage, pilot | #102–#116 | 11, 20, 27, 33, 36–38, 41–43, 45, 48–50, 52, 53 | #102 startable today |
| Wave 5 — client and mobile evidence | #117–#131 | 4, 13, 21, 26, 32, 35, 40, 44, 46, 47, 51, 54–56 | all NOT AUTHORIZED |
| Tracker | #132 | 57 | closes last |

## What every plan shares

A **For Hermes** preamble naming the traps; a Goal; a Status line; a **Known pins** table of read-only
measurements; **Proven findings** (F1…) separating what was verified from what was inferred; **Decisions
taken** so execution does not re-litigate; a task list whose Task 0 is a gate; a **Validation matrix**
mapping each acceptance criterion to a test arm; **Risks and open questions**; **What this does not
authorize**; and **What this plan did not verify**.

## What this plan set did not verify

- Any issue's implementation, because none was performed.
- The contents of artefacts that do not exist yet — every blocked plan reasons from its dependency's issue
  body, not from that dependency's output.
- Whether the declared dependency edges are *correct*. The order is a faithful sort of what the issue
  bodies say; two edges are flagged as nominal (#101→#85, and #127's missing edge to the #94/#95/#96
  chain), and correcting them is issue-body work, not sorting work.
- Whether the four owner decisions have answers the owner already holds but has not recorded.
