# Audit: open-issues plan vs actual execution, 2026-10-26 → 2026-10-27

This audit compares the owner's 10-26 plan, `open-issues-implementation-plan.md` (written as commit `719c988` on an unpublished branch and published beside this file as commit `6a20a44`, byte-identical; investigated baseline `main` at `7eede0e`), with execution up to `a2cdbc1` and GitHub state at about 2026-10-27T17:45Z. Sections 1–6 are that snapshot; their corrective-action citations were updated the same day with the owner's G46 decisions, and they are not rewritten after that. Section 7 records what moved afterwards and corrects errors found in sections 1–6.

## Context

The owner asked for a deviation audit of `docs/plans/open-issues-implementation-plan.md`, commit `719c988d`.
- **The plan:** committed 2026-10-26T19:59:49Z on the local branch `docs/open-issues-implementation-plan` and never pushed. Its investigated baseline is `main` at `7eede0e`.
- **Execution:** everything on `origin/main` up to `a2cdbc1` (2026-10-27T17:15:30Z), plus GitHub issue and PR state at about 17:45Z.
- **Second baseline:** the earlier approved 10-22 plan, Appendix A, is used where the 10-26 plan dropped one of its rules.

**Evidence labels:**
- **[F]** verified fact, from git, `gh` or a results file;
- **[C]** a claim made in a PR body or comment and not independently verified;
- **[I]** my inference.

No market or industry benchmark applies to an internal governance program. The external cross-references are official documentation only: GitHub on closing keywords, and Node.js on `listen(0)` and timers.

---

## 1. Executive summary

**Health score [I]: 55/100, Amber.** It is the plain average of four equally weighted dimensions:

| Dimension | Score | Why |
|---|---|---|
| Delivery progress | 7/10 | Blocks A, B and C are 100% done, and #838 is accepted. 8 of the 19 issues have reached their planned disposition. |
| Run budget | 4/10 | Projected 12 of 12 runs against the plan's 10 of 12. The two spare runs are gone. |
| Governance controls | 4/10 | Review was not recorded on 4 build or fix PRs. Two were verified on a head that wasn't merged. One merged without DeepScan. One issue was closed early. |
| Schedule | 7/10 | 9 PRs merged in 21 hours. 9.8 days remain in the window for #905, 3 builds and 6 runs. |

**The key deviations:**
1. **#839 overran its runs.** The plan gave it run 5. It has used runs 5 and 6, and neither was accepted.
   - Run 5 was invalidated: a control lacked `holds` (#902).
   - Run 6 matched 8 of 11: C-06 failed on the restart port and C-10 on the observer's field shape (#905).
   - A third run is needed, so every later probe moves two slots and **no spare run is left** [F].
2. **#839 shows CLOSED but its acceptance is unmet.** #901's body said `Fixes #839`, and GitHub closed the issue when that PR merged at 15:06:19Z [F].
3. **The plan's §4 verification and review controls were not applied** to the PRs that came after it [F]:
   - no PR records independent review, or `NOT_PERFORMED`;
   - no PR records a full `make governance-gates`;
   - #896 and #899 were verified on heads that were not the ones merged;
   - #903 merged with 17 of 18 contexts, DeepScan missing.
4. **Three of the six Stage 2 runs (3, 5 and 6) failed on harness defects** that only appear at runtime [F]. The 10-26 plan added no safeguard against this class of failure [I].

**What went well [F]:**
- Blocks A, B and C landed within about 8 hours of the plan.
- #869 went through implementation, fold and archive.
- #838 v2 passed with 17 of 17 cases matched on its first remeasurement.
- Frozen v1 artefacts and run 3 were preserved byte-for-byte.

---

## 2. Variance matrix

Times are UTC. The plan sets no dates except the G42 window, so a timeline variance is measured against run slots.

| Plan item | Planned | Actual | Deviation (direction, magnitude) | Evidence |
|---|---|---|---|---|
| **A**: #889, #891 | Acceptance records, close, run 3 unchanged | Closed 10-27 02:18Z and 02:19Z with records. `load-run-3.json` has had no commit since the plan | None | [F] |
| **A**: #877 | Acceptance record; keep task 3.2 unchecked | Closed 02:19Z. Archived task 3.2 is still `[ ]`, with its explanation | None. That the owner wrote the record is [C]: it was posted from the owner's account | [F] |
| **A**: #830 | Supersession record, then close | Closed 02:21Z, as superseded | None | [F] |
| **A**: #817 | Stays open, deferred | Open | None | [F] |
| **B**: #869 | Governed Node change: two `*_and_durable` statuses, no new exports or version, then fold and archive | #896 merged 22:49Z, #897 01:25Z, #898 01:59Z; closed 02:17Z. The statuses are at `delivery-classes.ts:227,237`. `package.json` and `src/index.ts` are unchanged | **Scope:** none. **Controls:** verification was on `3a8338f`, but `ce4a1b2` merged; no review record; no governance-gates | [F] |
| **C**: #890 remedy | 180 ms drain plus 20 ms reserve; `load.v2.json`; v1 kept; explicit version selection | #899 merged 03:40Z. v2 sets `drain_budget_ms` 180 and `report_reserve_ms` 20 on `abandon` and `retry_shutdown`. v1 is unchanged | **Scope:** none. **Controls:** verification was on `cc5cf15`, but `4f8e4a9` merged; `openspec@latest` without `--strict`; no review record | [F] |
| **C**: #838 run 4 | One v2 measurement after an exact-head S1 | S1 at 03:42Z. 17 of 17 matched, 1,456 calls. Evidence #900 at 04:06Z, then closed | None. It used run 4, as allocated | [F] |
| **D**: #839 | Run 5, then accept | Run 5 invalidated (#902). Run 6 matched 8 of 11, with C-11 not run (#905). Closed early by `Fixes #839` | **+1 run so far, +2 projected (200%).** Acceptance unmet. The tracker shows it done | [F] |
| **D**: #840 | Run 6 | Not started. Its slot was used by #839 | Slips 2 slots, to run 8 at the earliest | [F]/[I] |
| **D**: #842 | Run 7 | Not started | Slips 2 slots, to run 9 | [I] |
| **D**: #841 | Runs 8–10 | Not started | Slips 2 slots, to runs 10–12 | [I] |
| **D**: allocation | 10 of 12, with 2 spare | 6 used. Projected 12 of 12, with 0 spare | **+20% runs; spare −100%** | [F]/[I] |
| **D**: SDK calls | No plan figure; at most 50k per run | 2,203 recorded. Run 5 is entered at its `call_bound` of 145 | Well within the per-run cap | [F] |
| **E**: #870, #843–#846, #833 | After #842 / after D | Not started | On sequence | [F] |
| **F**: normative prerequisites | May proceed alongside Stage 2 | No commits to `define-normative-precedence-lifecycle` since the plan | Not started. It was optional for now, but it is #863's critical path | [F] |
| **§3**: #863 | After F and Stage 2 | Open and blocked | On sequence | [F] |
| **§4**: controls | Full governance-gates; independent review bound to the final commit, else `NOT_PERFORMED`; all contexts plus DeepScan | None recorded on #896, #899, #901 or #904. #903 merged without DeepScan, with 17 contexts against 18 elsewhere | **Control gap on 5 of 9 PRs** | [F] |
| **Scope growth** | — | #902 (closed) and #905 (open), both harness defects. The #905 fix sits uncommitted in the primary checkout | +2 issues | [F] |

---

## 3. Deep-dive by category

### 3.1 Budget and run allocation (#839)

**What happened [F]:**
- **Run 5** (S1 at 15:09:32Z, on `e71716e`): the sender stopped before traffic with `planted-defect control failed before traffic: copies_checks`. `copiesControls` returned no `holds`, which `requireControls` in `lib/controls.mjs` requires.
- **Run 6** (S1 at 16:38:56Z, on `ac6c551`): two cases mismatched.
  - **C-06** observed `persisted_count_across_restart: 0`.
  - **C-10** observed `loopback_holds: false` and `permissions_hold: false`, although every real control in the observation carried `holds: true`.

**Root causes:**
1. **The observer for C-10 could never pass [F].** It required `guard_violations.length === 0`. But `plantedGuard` in `lib/controls.mjs` deliberately records exactly one violation before traffic, through `fired = violations.length === before + 1`. The observer also compared `write_outside_grant === true` against an object.
2. **#902 and C-10 are one defect fixed in one place [I].** Both are confusion over the shape `{holds}` versus a bare boolean. #904 fixed the producer, `copiesControls`, but not the consumer, `isolationControlsObserver`. That was a missed warning sign.
3. **The tests could not catch it [F].** The copies observer tests build their observations from hand-written literals (`controls: { write_outside_grant: true }`), not from the producer functions. Copies has only 15 tests across two files. The field-read parity check `tests/field-reads.mjs` (`dottedReads` and `resolves`), which load and outages use, was never applied to copies.
4. **C-06's restart changed port.**
   - `startIngress` always called `server.listen(0, "127.0.0.1")` [F]. Port 0 asks the OS for an arbitrary unused port; this comes from the Node.js `net` docs, read through a summary [I/doc].
   - So the restarted collector moved, and post-restart submissions were exhausted [C, #905]. The lookups were also reset [C, #905].
   - The fixture for the restart phase is hand-built, so no test exercised a real restart [F].
5. **The cycle was compressed with no review step [F].** Run 6's S1 was posted 51 s after #904 merged. #904 records no review, and only four verification commands.

### 3.2 Governance and verification controls

| Control (§4 of the plan) | Observed | Evidence |
|---|---|---|
| Independent final-commit review; both build axes; `NOT_PERFORMED` when missing | No PR body after the plan records review or `NOT_PERFORMED`. They carry only the "AI-produced analysis… is not review" disclaimer | [F] |
| Full `make governance-gates` | Recorded on none. The last full run on record is #887, before the plan | [F] |
| Verification bound to the final commit | #896 was verified on `3a8338f` and merged `ce4a1b2`. #899 was verified on `cc5cf15` and merged `4f8e4a9` | [F] |
| All declared contexts plus DeepScan | #903 merged with 17 contexts and no DeepScan | [F] |
| Pinned toolchain | #899, #901 and #904 run `npx @fission-ai/openspec@latest` (#899 without `--strict`). Strict `openspec` 1.14.1 has failed on `main` before | [F] |

**Root cause [I]:**
- **Speed:** 9 PRs merged in about 21 hours.
- **A lane switch:** a different authoring tool and PR template that does not carry the 10-22 review rule (Q12) or the TEST_CMD set.
- **No mechanical enforcement:** GitHub enforces no review gate here, and nothing checks the count of reported contexts against the declared set.

### 3.3 Issue-tracker integrity

- **#839 closed at 15:06:19Z,** one second after #901 merged, through `Fixes #839 (Task 5.1)` [F].
- **This is documented GitHub behaviour [doc]:** closing keywords in a PR that targets the default branch close the issue on merge.
- **The rule that prevents it was dropped [I].** The 10-22 standing rule "PRs say `Refs #N`, never Fixes" is absent from the 10-26 plan. The same failure was first recorded here in 2026-09.
- **#904's `Fixes #902`** was appropriate, because #902 was the fix's own issue.

### 3.4 Evidence and record accuracy (conflicting data)

| Conflict | Version A | Version B | Better supported |
|---|---|---|---|
| #839's case list | #901 body: C-01 "cross-tenant duplicate isolation"… C-10 and C-11 as planted controls | `copies.v1.json` and the run results: C-01 `byte_identity`… C-10 `isolation_controls`, C-11 `volume_duplicates` | The frozen expectations, which are sha-pinned and actually evaluated |
| Restart mechanism | #901 body: "process-level storage restarts" | `copies/ingress-process.mjs` `restart()` closes the server and reopens SQLite **in the same process** | The code |
| Run budget | Ledger header: "six single-run, three #841, three spare" (10-22) | 10-26 plan: runs 4–10, two spare | The 10-26 plan, which accounts for run 3. The ledger header is stale |
| Run 5's calls | 145 in the ledger | No traffic was sent; it failed before traffic | Both are true. 145 is the governed figure under the ledger rule for a null `occurrence_count` |

### 3.5 Baseline drift (10-22 plan → 10-26 plan)

| 10-22 rule | 10-26 plan | Effect |
|---|---|---|
| D1: Claude writes all code, AGY reviews | "Interchangeable authoring tools" | A legitimate owner re-baseline, but it opened the gap in §3.2 |
| Q12: AGY plus `/code-review high` on every build PR | "Independent final-commit review, both axes" | Same intent, not applied |
| `Refs #N`, never `Fixes` | Absent | Caused §3.3 |
| "A mismatch is reported, never fixed" | Fix forward with owner disposition (the #838 v2 precedent) | Consistent for #838. #839's run 6 had no recorded owner disposition [F/I] |

---

## 4. Impact assessment

- **Budget:** any failure in runs 7–12 forces one of three outcomes:
  - an authorization amendment;
  - #841 dropping below three runs, which weakens the spread evidence for criterion 4;
  - a probe going unmeasured, which leaves a gap in ADR 0015.
- **Schedule:** 9.8 days, to 2026-11-06T13:18:26Z. The work left is #905, three builds (#840, #842, #841) and six runs. That is feasible at the observed cadence, but only if nothing fails [I].
- **Evidence credibility:** ADR 0015 must disclose:
  - that runs 3, 5 and 6 failed on harness defects;
  - the review gaps;
  - #903's missing DeepScan;
  - that the restart is in-process.

  Without that, reviewers could read the outcome as stronger than it is [I].
- **Tracking:** #839 shows done. The parent #833's reconciliation and anyone reading the tracker will be misled until it is reopened.
- **Downstream:** #870 waits on #842 and ADR 0015 waits on D, so any further slip in D moves both. F is untouched, so #863 cannot start before the program's other work ends [I].

---

## 5. Corrective action plan and re-baselining

**P0, before any further run:**
1. **Reopen #839** with a note on the early close. Correct #901's case list in a PR comment. Close #839 only after a passing evidence PR is MERGED.
2. **Owner disposition for run 7.** The 10-26 plan says "spare capacity does not authorize automatic retries", and run 6 had no recorded disposition.
3. **Re-baseline the budget**, choosing one option:
   - **Option A, recommended:** amend G42's run cap from 12 to 16 and keep the window. The amendment goes through the change's `proposal.md`, with a decision record on #833, because #795 is closed.
   - **Option B:** keep 12, and commit in advance that a further failure cuts #841 to two runs, with the gap disclosed.
   - **Option C:** amend the window as well. Not needed yet.
4. **Fix #905 properly.**
   - The observer reads `.holds === true` only. Remove the draft's fallbacks for bare `true` and `undefined`, which fail open.
   - Restart on the same port, and invalidate the run if the port differs.
   - Accumulate lookups across restarts.
   - Apply `field-reads.mjs` parity to the copies observers.
   - Build observer fixtures from `guardControls`, `writeControls` and `copiesControls`, not from literals.
5. **Reinstate the review gate.** Claude Code runs `/code-review xhigh` on the **whole copies harness** (it never had a recorded review), bound to the final head. AGY writes the fixes (Q87). Run the full TEST_CMD, including `make governance-gates`. Record the review status in every PR body.

**P1:**

6. **Mechanical checks before each merge:**
   - `gh pr view --json closingIssuesReferences` is empty on probe build and fix PRs;
   - the verification SHA equals the head being merged;
   - the reported contexts equal the 18 declared ones, DeepScan included;
   - `openspec` is pinned.
7. **Publish the 10-26 plan and this audit** by pushing the branch or opening a PR, so the baseline can be reviewed.
8. **Draft ADR 0015 disclosures** as the evidence lands: the failed runs, the review gaps and the in-process restart.

**P2:**

9. **Decide when workstream F starts.** It is #863's critical path and has had no activity.
10. **Keep #870 after #842,** as the 10-26 plan says. This supersedes my earlier recommendation to park it.

**Early warning indicators to track from now on:**
- runs used per probe, against plan (trigger: more than 1);
- spare runs against probes remaining;
- days left in the window, against the remaining builds plus runs times the median cycle time;
- a non-empty `closingIssuesReferences` on a build PR;
- a verification head that differs from the merge head;
- fewer reported contexts than 18;
- observer tests built on literal fixtures;
- an S1 less than one hour after a fix merges with no review record;
- a PR description whose case IDs differ from the frozen expectations.

**Warning signs that were missed:**
- Run 3's #889 was a runtime-only harness defect, and the plan did not generalize from it.
- #901 stayed open 10.5 hours with no review record.
- #902 and C-10 share a root cause, and #904 fixed only the producer.

---

## 6. Unanswered questions and risk register

**Questions for the owner:**
1. **Run 6's disposition:** was the rerun after run 5 disposed of off GitHub? Does G44's delegated S1 cover reruns after harness defects?
2. **Unrecorded reviews:** was any review done on #896, #899, #901 or #904 but not recorded? If not, they are recorded as `NOT_PERFORMED` in ADR 0015.
3. **Restart semantics:** is an in-process restart (server closed, SQLite reopened) enough for #839's "durable restart"? A process-level restart would need `copies.v2.json`.
4. **The other lane:** does it continue on this change? Two concurrent writers collide.
5. **Publication:** why is the 10-26 plan unpushed, and should it be published?
6. **#905's uncommitted draft:** whose is it, and should it move to a worktree?
7. **Still pending from the last grilling round:** Q1–Q4 (Q5 is resolved by item 10 of section 5).

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | A further harness defect exhausts the budget | High (3 of 6 runs failed) | High | CAP 3–5 | Owner, then Claude |
| R2 | The window lapses before #841's third run | Medium | High | CAP 3; check before each S1 | Owner |
| R3 | ADR 0015 overstates evidence through undisclosed gaps | Medium | High | CAP 8 | Claude, then owner approval |
| R4 | The tracker misreports progress (#839) | Certain now | Medium | CAP 1 | Claude |
| R5 | A merge without the full context set or review recurs | High | Medium | CAP 5–6 | Whoever merges |
| R6 | Concurrent lanes overwrite each other | Medium | Medium | Question 4 | Owner |
| R7 | The in-process restart is challenged as insufficient | Medium | Medium | Question 3 | Owner |
| R8 | #863 stalls because F never starts | High | Low (outside Stage 2) | CAP 9 | Owner |

---

## 7. Status since the audit (2026-10-28)

Verified with `gh` and `git` on 2026-10-28. This section covers the main snapshot items that have moved; it is not exhaustive. Each entry supersedes the snapshot statements it names. In sections 1–6, `[doc]` marks a fact from official external documentation; §3.1's `[I/doc]` fact was read through a summary.

### 7.1 Items that moved

| Snapshot item | Status on 2026-10-28 | Evidence |
|---|---|---|
| #839 closed early by `Fixes #839` (§3.3); #901's case list (§3.4, §5 item 1) | #839 was reopened at 2026-10-27T17:58Z and closed at 2026-10-28T10:57Z, after run 7 matched all 11 cases of `copies.v2.json`. #901's case list and restart description were corrected in a comment | #839 issuecomment-6449678473; run 7's S1, #839 issuecomment-6465595030; evidence PR #911, merge `4a8507a`; #901 issuecomment-6449679547 |
| #905's two harness defects and copies' test strength (§3.1); the uncommitted #905 draft (§2, §6, open question 6) | G47 amended G46 Q47 and reversed Q51's "No `copies.v2.json`". The copies probe was rebuilt under `copies.v2.json`, with an in-process session rehearsal, field-read parity and producer-built fixtures, while `copies.v1.json` and runs 5 and 6 stayed unchanged. The draft moved to its own worktree and branch, and the rebuild merged after eleven `/code-review xhigh` rounds | G47, #833 issuecomment-6450406225 (Q98); PR #908, merge `707b1dc`; #905 closed at 2026-10-28T09:36Z |
| Run budget: no spare run left (§1 deviation 1, §2 "D: allocation" and "D: SDK calls", §4); stale ledger header (§3.4) | G46 Q48 decided to amend the limit to 16 runs. PR #912 made the amendment, effective from its merge head; runs 1–7 ran under 12. The ledger header now states the 16-run limit and the slot map (8 #840, 9 #842, 10–12 #841, 13–16 reserve under an owner disposition), which the harness enforces. 7 of 16 runs and 2,350 SDK calls are used | G46, #833 issuecomment-6449640834; PR #912, merge `efdf42a`; #833 issuecomment-6473743084; `harness/run-ledger.md` at `efdf42a` |
| No full `make governance-gates` and no exact-head verification recorded (§1 deviation 3, §3.2) | PRs #908, #911 and #912 each record the full TEST_CMD, with strict `openspec validate` and `make governance-gates`, run on the head that merged | PR bodies of #908, #911 and #912 |
| No review recorded on build or fix PRs (§3.2) | PRs #908 and #912 merged after a `/code-review xhigh` round on a tree identical to the merged head; their merged commits differ from the reviewed ones only by a squash or by commit-message wording. PR #911's review ran at `16c48de`; its second commit, `5feff15`, applied that review's disclosure findings and merged without a review round of its own | PR bodies of #908, #911 and #912 |
| Unrecorded reviews of #896, #899, #901 and #904 (§3.2, §6 open question 2) | G46 Q50 decided that they are recorded as review `NOT_PERFORMED` in ADR 0015, and that #896 and #899 get a post-merge `/code-review xhigh`. Both reviews were done and their findings filed | G46 Q50; #913 (of #896); #914 (of #899) |
| Publication (§5 item 7, §6 open question 5) | G46 decided that the audit is published in a docs PR (its Context: "The audit will be published in a docs PR (Q52)"). The pull request that adds this file also publishes the 10-26 plan | G46; this file's commit |
| §6 open questions 1, 3 and 4 | Open question 1: G46 Q68 says that G44 delegates the S1, not a rerun's disposition, and G46 Q47 disposed one rerun, as run 7; run 6 still has no recorded disposition. Open question 3: G46 Q51 kept the in-process restart, and G47's rebuild kept it in-process. Open question 4: G46 Q91 says no other lane works on `verify-fraud-evidence-delivery` or `docs/fraud-evidence/` while this work runs | G46, G47 |
| Workstream F (§2, §5 item 9) | At the snapshot F could proceed alongside Stage 2; G46 Q54 then deferred it until the last Stage 2 run | G46 Q54; #863 open |
| ADR 0015 disclosures (§5 item 8) | Pending with #843. They include:<br>- runs 5 and 6 lost to harness defects (#902, #905);<br>- run 3's L-11 harness defect (#889), beside its genuine shutdown-timing failures (#890);<br>- run 6's C-04 and C-07 false positives;<br>- the in-process collector restart (G46 Q51);<br>- run 4's shutdown primitive overrunning its 180 ms drain budget within the 200 ms outer deadline (#914);<br>- copies' accounting identity reported for `consumer_restart` only (#910);<br>- the S1 hash of runs 5 and 6 covering a trailing newline (#907);<br>- review `NOT_PERFORMED` for #896, #899, #901 and #904;<br>- the sdk-node commit-claim findings, if Stage 2 relies on transaction-critical claims (#913) | #843, #889, #890, #902, #905, #907, #910, #913, #914 |

Open follow-ups from execution since the snapshot: #907, #909 (copies robustness and test strength), #910, #913 and #914. The G42 window still closes 2026-11-06T13:18:26Z.

### 7.2 Errata to sections 1–6

- §1 item 4 and §4 say runs 3, 5 and 6 failed on harness defects. Runs 5 and 6 did (#902, #905). Run 3's L-11 mismatch was a harness defect (#889), but its L-04, L-07 and L-10 shutdown-timing failures were genuine measurements (#890), as the records already said at the snapshot.
- §3.4 attributes "cross-tenant duplicate isolation" to C-01 in #901's body. #901 lists it as C-03.
- §2 reports a "Control gap on 5 of 9 PRs". For the review and full governance-gates controls, §3.2's finding applies to all nine PRs merged after the plan.
- §5 item 5 cites Q87 for "AGY writes the fixes". The authoring rule is G46 Q45 and Q83. Q87 is the review rule, and it also says that Claude never edits code itself.
