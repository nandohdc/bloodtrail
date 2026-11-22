# Tasks: Derive R10 assessment ordering from Git history (#943, #974)

## 1. Proposal

- [x] 1.1 Author the proposal, design, R10 delta spec (`software-design-pattern-governance`) and tasks from the #943
  triage and the #974 spec. Verify that `openspec validate derive-assessment-ordering-from-history --strict` passes.
  Passed on the proposal commit titled `docs(openspec): propose derive-assessment-ordering-from-history (#943, #974)`.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. The assessment is full and
  matches `governance_core_path`, `canonical_capability_requirement` and `security_sensitive_behavior`. Verify three
  things:
  - `node openspec/scripts/generate-assessment.mjs --change derive-assessment-ordering-from-history --check`
    passes;
  - `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change derive-assessment-ordering-from-history`
    passes;
  - the proposal commit changes no path outside this change's directory.

  On the proposal commit titled
  `docs(openspec): propose derive-assessment-ordering-from-history (#943, #974)`, `--check` and the assessment phase
  passed, and the commit added seven files, all in this change's directory.
- [x] 1.3 Re-run the one-off, read-only audit of design §"Audit of the ranges since activation" against the
  proposal's base, with every change active on that base. Verify that it reports 28 historical findings and none in an
  active change, and record the base, the range count and the active set in the design. If any active change has a
  finding, stop and report it to the owner before the proposal PR opens.

  Re-run on 2026-11-19 at `8d4e411`, with `add-collector-live-poc-deployment` and the three dependency changes active:
  545 ranges, the same 28 findings as the 2026-11-18 run, none in an active change. Re-run again at `bdd4c47`, after
  #991 archived the three dependency changes: 546 ranges, the same 28 findings, none in the three changes still
  active. The design records all three runs.
- [x] 1.4 Once the Track 1 archive PR (#991, tracked by #990) has merged and every required context plus DeepScan is
  green, the owner merges the proposal PR as a merge commit. Record the proposal commit and the merge commit here.
  #991 merged as `bdd4c47`. Proposal commit `ef8bc73`, merged in #992 as the merge commit `c1ee9f8`, with every
  required context plus DeepScan green. The merge was made under the owner's delegation of 2026-11-19 to merge a PR
  whose CI is fully green.

## 2. Real-history tests, red first

Every test in this group builds a disposable real-history repository seeded from the live governance artifacts, runs
the checker as a process in the assessment phase or in the final phase with an explicit base, and asserts only
diagnostic identifiers and the exit status. Commit the tests before any checker or policy change, run them against
the unchanged checker, and record here which ones fail and with what.

- [x] 2.1 History A, implementation before the assessment. Baseline C0, C1 changes an owned governed path, C2 adds
  the assessment, C3 changes the governed path again; final phase with base C0. Every variant must fail
  `assessment-follows-implementation`:
  - nothing recorded;
  - `assessment_commit` C2 and earliest C1 (the truth);
  - `assessment_commit` C2 and earliest C3 (a later commit);
  - `assessment_commit` C2 and earliest omitted;
  - `assessment_commit` C0, which adds no assessment, and earliest C1.

  The four variants that record a commit must also fail `assessment-ordering-record-inconsistent`, because history
  contradicts each record: C2 does not precede C1, C1 does not follow C2, C1 precedes C3, and C0 adds no assessment.
  Null control: the same commits in the correct order (assessment, then C1, then C3) pass in both phases, with
  nothing recorded and with every field recorded consistently.

  Red on the unchanged checker, at the commit titled
  `test(governance): add real-history R10 ordering tests (#943, #974)`. Every variant failed:
  - nothing recorded, earliest C3 and earliest omitted reported no diagnostic at all;
  - earliest C1 reported `assessment-follows-implementation`, from the recorded relation, but no
    `assessment-ordering-record-inconsistent`;
  - assessment C0 reported only `assessment-shares-implementation-commit`, because C0 also changes the policy.

  The null control passed.
- [x] 2.2 One commit adds the assessment and changes an owned governed path, with nothing recorded: the final phase
  fails `assessment-shares-implementation-commit`. Red on the unchanged checker: no diagnostic.
- [x] 2.3 Stub, then rewrite. A placeholder assessment, then an owned governed commit, then a commit that rewrites the
  assessment's decision content, all in one range, fails `assessment-amended-after-implementation`. Null controls
  pass:
  - the same history where the later commit edits only `ordering`, `invariant_evidence`, `verification_task_ids` or
    `owned_paths`;
  - a decision-content edit in a later range that holds none of the change's governed commits (the disclosed limit);
  - an archive move of the change, which deletes the active assessment.

  Red on the unchanged checker: the rewrite reported no diagnostic. All six null controls passed.
- [x] 2.4 History B. The change's assessment lands, another change then lands a governed commit on the shared line
  that only it owns, and the first change then lands its implementation. Both changes' ranges pass with nothing
  recorded. A null control: it passed on the unchanged checker for both ranges, and the baseline walk the design
  rejects would fail it.
- [x] 2.5 Shared owners. A governed commit owned by two changes passes when one owner's assessment strictly precedes
  it, and fails `assessment-follows-implementation` when neither does. Both assessments land on side branches
  merged after the shared commit, so neither the amendment rule nor a merge commit's paths decide the result. Red on
  the unchanged checker: the neither-precedes case reported no diagnostic; the one-precedes case passed.
- [x] 2.6 No anchor. A change that owns a governed commit in the range and has no committed assessment fails
  `assessment-anchor-missing`, also when another change that owns the same commit has an assessment that precedes
  it (design D2). Red on the unchanged checker: no diagnostic in either case.
- [x] 2.7 Contract-reuse planning artifact. A proposal commit that adds `contract-reuse.json` beside the assessment,
  followed by implementation, passes in both phases. With `openspec/changes/*/contract-reuse.json` removed from the
  fixture's planning patterns, the same history fails `assessment-shares-implementation-commit`. The proposal commit
  is recorded as `assessment_commit`, so the assessment phase judges it too. Red on the unchanged checker: the
  accepting test failed in the assessment phase with `assessment-shares-implementation-commit`; the null control
  passed.
- [x] 2.8 Recorded fields. Each inconsistent recorded field fails `assessment-ordering-record-inconsistent`, and each
  consistent one passes:
  - `assessment_commit` that does not change the assessment, that precedes the anchor, or that changes an owned
    governed path;
  - `earliest_governed_implementation_commit` that is not an owned governed commit, or that has an owned governed
    commit in the range before it;
  - `final_technical_commit` that does not descend from the anchor;
  - consistent: the anchor itself, a later pre-implementation edit (the #957 shape), and the true earliest commit.

  Red on the unchanged checker: none of the six reported `assessment-ordering-record-inconsistent`. The empty
  commit, the earliest commit that is not owned, the final technical commit and the earliest commit preceded by
  another reported nothing; the commit preceding the anchor and the commit carrying implementation reported only
  `assessment-shares-implementation-commit`. Both consistent null controls passed.

## 3. Implementation

- [x] 3.1 Add `openspec/changes/*/contract-reuse.json` to `planning_artifact_patterns` in
  `openspec/governance/design-pattern-policy.json`, beside the assessment patterns, and name it in
  `planning_artifact_note` (design D7). Done in the commit titled `fix(governance): classify the contract-reuse
  record as a planning artifact (#943)`. The pattern sits right after the two assessment patterns, and the note names
  the contract-reuse record.
- [x] 3.2 In `openspec/scripts/design-pattern-governance/ancestry.mjs`, derive each change's anchor from history and
  check its owned governed commits, the amendment rule and the recorded fields (design D1–D6). Remove
  `findEarliestGovernedImplementationCommit` (D8). Done in the commit titled `fix(governance): derive R10
  assessment ordering from Git history (#943)`. A missing anchor fails whatever the commit's other owners show
  (D2). `findEarliestGovernedImplementationCommit` no longer appears under `openspec/` outside this change's own
  documents.
- [x] 3.3 In `openspec/scripts/check-design-pattern-governance.mjs`, run the derived check in the final phase after
  association, from the range and the changes' owned paths that the perimeter already collected, and run the
  recorded-field checks wherever an anchor exists (D2, D6). No assessment schema, generator or rule-registry change
  (D9). Done in the same commit: `checkAssessments` passes the change id and its owned paths, and `checkPerimeter`
  runs the derived check at the final phase with the range, the changes and the reader association used. The commit
  changes only `ancestry.mjs` and `check-design-pattern-governance.mjs`.
- [x] 3.4 Verify that every test of group 2 passes, and that `node --test openspec/tests/design-pattern-governance/*.test.mjs`
  and `node --test openspec/tests/contract-reuse/*.test.mjs` pass. On the implementation commit, all 29 group-2
  tests, the 403 governance tests and the 73 contract-reuse tests passed.

  The implementation's `/code-review xhigh` added three tests, in the commit titled `test(governance): cover review
  findings on derived R10 ordering (#943)`: a recorded assessment commit with no derivable anchor, an unresolvable
  final technical commit with no assessment commit recorded, and an assessment commit carrying implementation beside
  an unresolvable earliest commit. The last failed until the commit titled `fix(governance): keep every
  recorded-ordering diagnostic and derive each anchor once (#943)`. With it, all 32 tests in the file, the 406
  governance tests and the 73 contract-reuse tests pass. The design now states the review's three disclosures: the
  reused-id limit (D1), the D3 and D5 interplay, and the stricter resolution of recorded commits (D6).

## 4. Verification

- [x] 4.1 On the committed implementation head, run the final phase with the PR's merge base, the baseline and
  candidate dual check, the contract-reuse check for every active change, `openspec validate --all --strict`, `make`
  and `make governance-gates`. Verify each passes, and read the final phase's inspected counts.

  On the head before this record, the commit titled `docs(openspec): disclose the review's ordering limits (#943,
  #974)`, with base `c1ee9f8`:
  - the final phase passed, with 8 commits and 6 paths inspected;
  - both dual-check arms passed: the candidate checker blob `481ad7030cf4` and the baseline `57a7075c6e1f`;
  - the contract-reuse check reported an approved skip for each of the four active changes;
  - `openspec validate --all` passed 19 of 19. `--strict` failed only the 16 long-requirement items that fail on
    `main` too, with no errors, and this change passed;
  - `make` passed in 543 s, and `make governance-gates` in 1176 s, with `test:git` passing on an empty index.
- [x] 4.2 Replay the audit at the implementation head with the real checker's rules. Verify that it still reports the
  same 28 historical findings, plus #423's archived record inconsistency from the recorded-field checks (design D6),
  and none in an active change, and that every active change passes the final phase over its own ranges. Report any
  failure to the owner before the implementation lands; none is waived.

  Replayed on the same head over the 547 ranges from activation to `c1ee9f8`, through the checker's own
  derived-ordering function: the same 28 findings, plus #423's archived record inconsistency, and none in any of the
  four active changes, this one included. No active change has a finding over any of its own ranges, so there is
  nothing to report.
- [x] 4.3 Once every required context plus DeepScan is green, the owner merges the implementation PR as a merge
  commit. Record the implementation commits and the merge commit here.

  #993 merged as the merge commit `a0af595`, under the owner's delegation of 2026-11-19 to merge a PR whose CI is
  fully green: all nine required contexts, DeepScan, CodeScene and Codecov passed, and `sonar` was skipped. Its nine
  commits, in order: `f87890c` (tests), `125f2a6` (red record), `64c20ac` (policy), `e869290` (derived check),
  `d02e9df` (evidence), `0117f25` (review tests), `e80c986` (review fix), `9886887` (disclosures) and `956f637`
  (verification record).

## 5. Fold

- [x] 5.1 In a separate PR, fold the MODIFIED R10 into `openspec/specs/software-design-pattern-governance/spec.md`.
  Verify that every existing scenario name is kept, that `openspec validate --all --strict` passes, and that the
  owner merges it as a merge commit.

  Folded in the fold PR, from `a0af595`. The canonical R10 is byte-identical to the delta's and keeps all nine
  existing scenario names among its 16, with no duplicate heading. It occurs once among the spec's 26 requirements,
  and no delta header survives. The canonical file is byte-identical to what `openspec archive` produces from
  `a0af595` in a disposable copy. `openspec validate --all --strict` fails only the 16 long-requirement items that fail
  on `main` too, with no errors, and this change passes, so that clause is judged against `main` rather than met
  outright. The spec itself gives 16 long-requirement warnings, R10's among them, exactly as `main`'s copy does.

  The fold PR's review qualified one sentence of R10, in the delta and the canonical file alike, to match the merged
  checker: the assessment commit SHALL NOT change a governed path the change owns, subject to the several-owner rule,
  and a recorded assessment commit SHALL change no governed implementation path.

  The fold failed the required `design-pattern-governance` check on one test, F's `R3-T038`, which pinned this spec to
  its blob at F's base `49ab0c2` (design D10). On the owner's instruction, the test now expects the exact folded blob
  `54510e4` for this capability, and this change owns the test file too.

  #994 merged on the owner's go-ahead as the merge commit `a6f48e0`, with all nine required contexts, DeepScan,
  CodeScene and Codecov green and `sonar` skipped. The canonical spec on `main` is the folded blob `54510e4`.

## 6. Archive

- [x] 6.1 After the fold merges, archive the change in a separate PR with `TZ=UTC openspec archive`, staging both
  sides of the move. The owner merges it as a merge commit, and #943 and #974 stay open for the owner to close by
  hand.

  Archived from `a6f48e0` to `openspec/changes/archive/2026-11-22-derive-assessment-ordering-from-history/`;
  `TZ=UTC date +%F` gave `2026-11-22`, the archive day. The fold already carried R10 into the canonical spec, so
  `openspec archive` changed no canonical spec. Both sides of the move are staged, and this task is ticked in the same
  commit. #943 and #974 stay open for the owner to close by hand.
