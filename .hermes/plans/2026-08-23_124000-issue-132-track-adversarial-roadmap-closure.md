# Issue #132 — Track the Adversarial Architecture Roadmap to Lifecycle Closure — Maintenance Plan

> **For Hermes:** This is a **coordination tracker**, not work. Its own rules forbid it from changing any
> atomic issue's scope, and its acceptance criteria stay unticked until the lifecycle work is done. The
> only legitimate edits are checkbox characters on wave lines and appended status comments. The last sync
> (2026-08-22) reconciled all 74 entries; this plan defines the recurring sync procedure, records what has
> changed since, and states the one structural gap the tracker cannot see. **Do not close #132.** Waves 2,
> 4 and 5 are entirely open and Wave 3 is partial.

**Goal:** Keep the wave checklists and PLAN coverage matrix truthful against live issue state, without
mutating a single atomic issue, and surface the decision surface the owner must act on.

**Status at this baseline:** OPEN by design — a tracker closes last.

**Architecture:** One GitHub issue body with six wave checklists (74 entries), a 92-row PLAN coverage
matrix, and obligation totals. Source of truth is live issue state plus governed OpenSpec evidence.

**Tech Stack:** `gh`, `jq`.

**Known pins (verified read-only on 2026-08-23):**

| Role | Value |
| --- | --- |
| Landing baseline (`origin/main`) | `1948f9f5d4a86471e7b8fba6cfb80268802cde9c` |
| Issue | #132, OPEN, labels `documentation` `openspec-change-needed` |
| Last sync | 2026-08-22, against `main@b8a54e8fe8dbdb0902f94f9f7d7d7b2addd9809d` — 22 entries ticked, none untucked |
| Checklist size | 74 entries, 74 distinct issue numbers |
| Source plan | `Bloodtrail architecture & roadmap — adversarial review`, SHA-256 `616c28f6732cd4dd7066ef4dfcf81ac28ec77d6083be674f4b49ad4dfc659811` |
| PLAN obligations | 92; CREATE_ISSUE 40, EXPLICITLY_DEFERRED 19, GOVERNANCE_REQUIRED 19, ALREADY_SATISFIED 9, NON_ACTIONABLE_CONTEXT 3, INVALID_AGAINST_REPOSITORY 2 |
| Wave state at this baseline | 0 complete · 1 complete · 2 **fully open** (14) · 3 partial (7 open: #94–#96, #98–#101) · 4 **fully open** (15) · 5 **fully open** (15) |
| Open issues total | 57 |
| Out-of-plan issues deliberately **not** in a wave | #169, #191, #201, #202, #203 |
| Native GitHub dependencies | **zero across all 57 issues** — see F2 |
| Lifecycle mode | `archived` |

---

## Proven findings

### F1 — Nothing has changed in the wave checklists since the 2026-08-22 sync

All 51 wave-tracked issues that were open then are open now. The only movement in the repository since is
out-of-plan: #202 implemented and archiving (PR #206), and #203 filed from its residual. **No checkbox
needs to move today.** Record that plainly rather than performing a sync that changes nothing.

### F2 — The tracker's dependency graph exists only as prose, and this is the tracker's biggest blind spot

`issue_dependencies_summary.blocked_by` is `0` for **every one of the 57 open issues**. Every "Depends on
#N" line is body text. GitHub's native issue dependencies — which `docs/agents/issue-tracker.md` documents
as the canonical, UI-visible representation for wayfinding — are unused here.

Consequences the tracker should say out loud:

- Nothing mechanically prevents an agent from starting #86 before #80 is decided.
- The "frontier query" described in the issue-tracker doc (drop anything with an open blocker) returns
  **everything**, so it cannot be used to pick work.
- A tracker that claims dependency-ordered waves while the dependency edges are absent is documenting an
  intention, not a constraint.

**Recommendation:** materialize the declared dependencies as native edges. It is mechanical — every issue
body already lists them — and it converts the wave ordering from prose into a gate. That is a real
improvement to this tracker's own stated purpose, and it is *coordination*, not scope change, so it is
inside #132's remit. Raise it with the owner before doing it: 57 issues × several edges each is a large
number of writes.

### F3 — The decision surface is three issues, and it has not moved since 2026-08-16

Wave 2 opens on #75 (contract-version support policy), #77 (sdk-core authority scope), and #80
(multi-package topology) — all `ready-for-human`, all with decision briefs posted a week ago, all
unanswered. #114 (collector storage semantics) is a fourth, further out. **Nine Wave 2 issues cannot start
until those three are answered**: #76, #78, #83, #84, #85, #86, #87, #88 all trace back to them, and #81
and #82 are themselves gated on #80.

#79 is the only Wave 2 item not gated by a decision — its body declares dependencies on #77 and #78, but
its actual content (a distinct diagnostic for a duplicate installed copy) is describable and testable
under either authority model. That is a judgement worth recording on the issue, not in the tracker.

### F4 — Wave 5 is 15 issues that are all explicitly NOT AUTHORIZED

Every #117–#131 body carries "Implementation is **NOT AUTHORIZED**" and `P3_DEFERRED`. The tracker's fourth
acceptance criterion asks that deferred issues stay visibly non-authorized; they do. **Do not promote any
of them to `ready-for-agent`** — the label would contradict the body.

### F5 — The out-of-plan issues have a settled convention: traceability note, no checklist entry

#132's own last comment established it for #201: "not a source-plan atomic issue and is deliberately not
added to a wave checklist; it is recorded here only so the follow-up is traceable". Apply the same to
#191, #202, and #203. #169 predates the convention and is a branch-retirement record; it too stays out.

### F6 — The PLAN matrix is stable and does not need re-derivation

92 obligations, unchanged across the corrections pass and both syncs. Re-deriving it costs a full read of
the source plan and has never yet found a discrepancy. **Verify totals, not rows**, unless an issue's scope
changes — and scope changes are exactly what this tracker is forbidden to make.

---

## Decisions taken

1. **Do not close #132** until every non-deferred authorized lifecycle item is resolved and every deferred
   item carries a current disposition.
2. **Sync = checkbox characters and appended comments only.** The summary, matrix, totals, acceptance
   criteria and issue titles stay byte-identical, exactly as the 2026-08-22 sync recorded.
3. **Out-of-plan issues get a traceability note, never a checklist row** (F5).
4. **Never promote a Wave 5 issue to `ready-for-agent`** (F4).
5. **Raise F2 with the owner before acting on it** — it is a large write, and it changes how the backlog
   behaves.

---

## The recurring sync procedure

Run this on each triage pass; it is the whole maintenance job.

- [ ] S1 `gh issue list --state open --limit 200 --json number,title,labels,state` — snapshot.
- [ ] S2 For each of the 74 wave entries, compare the checkbox against live state. **Only unticked → ticked
      is expected.** A ticked → unticked move means a completion regressed; stop and investigate before
      editing anything.
- [ ] S3 Verify the checklist still holds 74 entries and 74 distinct issue numbers — the "appears exactly
      once" criterion, checked mechanically.
- [ ] S4 Verify obligation totals unchanged (F6).
- [ ] S5 Append a status comment carrying `> *This was generated by AI during triage.*`, stating: the
      baseline commit, what moved, what did not, and the **next authorized step**.
- [ ] S6 State the current decision surface (F3) explicitly in every sync. It is the single most
      actionable line in the tracker.

## Task 1: This pass — record that nothing moved

- [ ] 1.1 Confirm F1 mechanically (S1–S3). Expect zero checkbox changes.
- [ ] 1.2 Append a sync comment recording: baseline `1948f9f`; no wave entry moved; #202 implemented and
      archiving via PR #206; #203 filed from its residual; both deliberately out of the wave checklists.
- [ ] 1.3 Restate the decision surface: **#75, #77, #80** — unanswered for one week, blocking nine issues.

## Task 2: Propose the dependency-edge materialization to the owner

- [ ] 2.1 Post the F2 finding: every declared dependency is prose; `blocked_by` is `0` everywhere; the
      frontier query is unusable as a result.
- [ ] 2.2 Ask whether to materialize the edges natively, and scope the cost: read each body's "Depends on"
      lines, resolve each blocker's numeric database id (`gh api repos/nandohdc/bloodtrail/issues/<n>
      --jq .id` — the **database id**, not the `#number` or `node_id`), and POST to the
      `dependencies/blocked_by` endpoint.
- [ ] 2.3 **Do not start the writes without an answer.** 57 issues of edges is not a reversible-by-accident
      operation.

## Task 3: Keep deferral visible

- [ ] 3.1 Spot-check three Wave 5 bodies per sync for the NOT AUTHORIZED framing. If one has lost it,
      that is a scope drift on an atomic issue and belongs on **that** issue, not here.
- [ ] 3.2 Confirm #112, #113, #114, #115, #116 still carry `P3_DEFERRED`.

---

## Validation matrix

| Acceptance criterion (#132) | How checked | State |
| --- | --- | --- |
| Every atomic issue appears exactly once in a wave checklist | S3, mechanical | ✅ 74/74 |
| Every PLAN identifier maps to an issue or an evidence-backed disposition | S4, totals | ✅ 92 obligations |
| Deferred issues labelled P3 and stating implementation is not authorized | Task 3 | ✅ spot-checked |
| Tracker updates change no atomic issue's scope or criteria | decision 2 | ✅ enforced by procedure |
| Tracker closes only when lifecycle work is resolved | — | ❌ 51 wave issues open |

## Risks and open questions

- **The tracker can drift into doing work.** Every sync is an opportunity to "just fix" an atomic issue.
  The rule exists because a tracker that edits scope destroys the traceability it is for.
- **Three unanswered decisions are the whole critical path.** If they stay unanswered, Waves 2, 4 and 5
  are frozen and this tracker will report "unchanged" indefinitely. That is worth escalating explicitly in
  each sync rather than reporting it neutrally.
- **F2's fix is large and one-way-ish.** Native edges are removable but tedious to undo. Get the answer.
- **Open question for the owner:** should out-of-plan issues (#169, #191, #201, #202, #203) get a seventh
  "out of plan" section in the tracker body? Today they exist only in comments and are therefore invisible
  to anyone reading the checklists. A section would make them visible without implying source-plan
  coverage. Recommend yes; it is coordination, not scope.

## What this does not authorize

Implementing any child issue. Treating tracker closure as evidence that an incomplete atomic issue is
complete. Authorizing deferred, release, publication, deployment, or production work.

## What this plan did not verify

The PLAN matrix row by row (F6 — totals only). And whether any Wave 5 body has silently lost its NOT
AUTHORIZED framing outside the three spot-checks.
