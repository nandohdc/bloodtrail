# Tasks: Document what the delivery shutdown deadline bounds (#932)

## 1. Proposal

- [x] 1.1 Author the proposal, design, delta spec (`security-audit-sdk-node`) and tasks from the #932 decision
  record. Verify that `openspec validate document-delivery-shutdown-report-timing --strict` passes.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify that
  `node openspec/scripts/generate-assessment.mjs --change document-delivery-shutdown-report-timing --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change document-delivery-shutdown-report-timing`
  both pass, and that the proposal commit changes no path outside this change's directory.
- [x] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here. Merged by the owner: #959, proposal commit `eb0a889`,
  merge commit `23e7f76`.

## 2. Pin the order the requirement states

- [x] 2.1 Add two tests to the Node binding's delivery shutdown tests:
  - **the order test**, using the file's `fakeDeadlineTimer`: admit two operations, settle one, initiate shutdown,
    let pending work run for one macrotask turn and assert the report has not resolved, then fire the timer and
    assert the report is `{ accepted: 2, completed: 1, abandoned: 1 }`;
  - **the source check**: parse `src/delivery-shutdown.ts` with the TypeScript compiler API and assert two things:
    - no free identifier is `setTimeout`, `clearTimeout`, `setInterval`, `setImmediate`, `Date`, `performance`,
      `process` or `AbortSignal`. Property names such as `timers.setTimeout` do not count;
    - the module's only import is the type-only import of `AuditTimerProvider` from sdk-core.

  Verify that `npm test --prefix packages/security-audit-sdk-node` passes. Then, in a disposable copy, verify each
  plant below beside a null control, the unchanged source, that stays green:
  - `drain()` races a real `setImmediate`: the existing tests pass and the order test fails;
  - `drain()` races a real global `setTimeout(0)`: the existing tests and the order test pass, and the source check
    fails;
  - `drain()` resolves at a `Date.now()` deadline: the source check fails;
  - `drain()` races a `setTimeout` imported from `node:timers`: the source check fails on the import.

  The scope null control's reference count moves under every one of these plants. Record which other tests fail,
  so that the recorded catch is the intended test and not only that count.

  Record each plant and the test that fails.

  The two tests landed in the commit titled `docs(sdk-node): document what the delivery shutdown deadline bounds
  (#932)`. The implementation review in 4.4 then strengthened both, in the commit titled `test(sdk-node): pin the
  shutdown deadline delay and allowlist the module's globals (#932)`:
  - the order test also asserts that shutdown schedules exactly one provider timer, with `deadlineMs` as its delay,
    and has a 2 s test timeout, so a module that never schedules through the provider fails instead of hanging;
  - the source check uses the scope gate's own scope-aware `collectCouplingReferences` and requires the module's
    free identifiers to equal exactly `Number`, `Object`, `Promise`, `Set` and `TypeError`, instead of matching a
    list of clock globals. A clock or timer global, `globalThis` or `eval` cannot appear without that list changing.

  `npm test --prefix packages/security-audit-sdk-node` passes, 270 runtime tests. Measured with the final technical
  commit's tests, in disposable copies of the package, each beside a null control (the unchanged source) that
  passed all 270 tests and check-scope. Each result is from one full runtime run plus check-scope; "order test"
  counts are from a further 20 runs of that test alone, once on an idle workstation with the first commit's order
  test and once with the final one while the gate chain was running:
  - `drain()` races a real `setImmediate`: the order test fails 20 of 20 both times and the source check fails.
    Unlike the plan said, the scope gate also catches it: `setImmediate` is not an allowed global, so check-scope
    fails and so do seven scope-mutation tests besides the null control;
  - `drain()` races a real global `setTimeout(0)`: the source check fails and check-scope passes. The order test
    failed 14 of 20 idle and 20 of 20 under load, not 0 of 20 as planned: in the test runner the timer can run
    before the test's `setImmediate`, more often on a busy machine;
  - `drain()` resolves at a `Date.now()` deadline: the source check fails. The order test passed 20 of 20 idle; under
    load it failed 1 of 20, on the delay assertion, when a millisecond passed between the two clock reads;
  - `drain()` races a `setTimeout` imported from `node:timers`: the source check fails on the import and check-scope
    passes. The order test failed 18 of 20 idle and 20 of 20 under load;
  - added by the review: `createShutdownTimeout` passes 0 to the provider instead of `deadlineMs`: only the order
    test fails, on the delay assertion, 20 of 20;
  - added by the review: `drain()` reads `Temporal.Now`, or races a `MessageChannel` message. Each needs
    `@ts-ignore` to compile, and then fails the source check and check-scope (`undeclared-global`); the
    `MessageChannel` plant also fails the order test 20 of 20.

  Under every plant the seven earlier shutdown tests pass. Under every plant but the zero delay, the scope null
  control's test "unmutated sdk-node package passes the scope gate and reports declared coupling inventory" also
  fails, because the reference count moves. So the source check is the only deterministic catch for a clock reached
  through `setTimeout`, `Date` or `node:timers`, and the order test is a nondeterministic second catch for the
  timer plants.

## 3. Records

- [x] 3.1 Bring the doc comments in `src/delivery-shutdown.ts` into line with the MODIFIED requirement:
  - `DeliveryShutdownOptions.deadlineMs`;
  - `DeliveryShutdownReport.completed` and `abandoned`;
  - `DeliveryShutdown.shutdown()`.

  Verify that the edit changes comments only: `git diff` shows no line outside a comment changed.

  `git diff origin/main -- packages/security-audit-sdk-node/src` adds and removes only lines inside `/** ... */`
  blocks. The comments say that no admitted operation is counted abandoned before the deadline timer fires, and
  that `abandoned` counts operations still outstanding after it fired; neither names the turn at which they are
  counted (design Decision 3). The `shutdown()` comment says the report resolves after the timer only when work is
  still outstanding when it fires. It keeps the sentence "returns an exact accounting", which the canonical
  requirement also keeps; #957 and #958 own the two known exceptions.
- [x] 3.2 In the Node binding's README section "Deadline-bounded delivery shutdown", state:
  - that `deadlineMs` is the delay passed to the injected timer provider, and outstanding work is counted
    abandoned only once that timer fires;
  - that the report returns after that, with no stated bound;
  - that a composer with an outer deadline passes a smaller `deadlineMs` and keeps the difference for the report.

  Cite the Stage 2 reference composition (180 ms inside 200 ms, #899) as one workstation's observation. Verify
  three things:
  - no sentence states or implies a service level;
  - no numeric bound on the report's return is introduced;
  - the text agrees with the MODIFIED requirement.

  Two paragraphs after the section's existing text. The first says that `deadlineMs` is not a bound on when the
  report resolves, that the module reads no clock or timer of its own, and that with `nodeTimers` the report can
  resolve after `deadlineMs` or slightly before it. The second tells a host with an outer deadline to pass a smaller
  `deadlineMs`, and cites 180 ms inside 200 ms (#899), and reports 0.58 to 2.73 ms after the 180 ms, as one
  workstation's observation, not a recommended value or a bound. Neither states a frequency, a service level or a
  numeric bound on the report.

## 4. Integration checks

- [x] 4.1 Verify that `npm run validate --prefix packages/security-audit-sdk-node` passes, with `test:exports` at
  19 value and 44 type-only exports, and that `git diff --check` is clean.
  Passed on the final technical commit: 270 runtime tests, 19 value and 44 type-only exports, and a clean
  `git diff --check`.
- [x] 4.2 Verify that `git diff --exit-code origin/main...HEAD -- packages/security-audit-sdk-node/compatibility.json`
  is empty.
  Empty.
- [x] 4.3 Run `make governance-gates` on the implementation PR's final technical commit, then the post-commit
  governance battery (`--phase final`, the dual check, the governance tests). Verify that every step passes, and
  record the commit each ran on.
  On the commit titled `test(sdk-node): pin the shutdown deadline delay and allowlist the module's globals (#932)`,
  the final technical commit, every `make governance-gates` target passed. The first run stopped at
  `packages/client-evidence-browser`, whose dependencies were not installed in the worktree (`tsc: command not
  found`), after sdk-core and sdk-node had passed. Once they were installed, that workspace and every target after
  it passed on the same commit. The post-commit battery passed on the same commit:
  - contract version currency, and the repository script tests, 182 of 182;
  - the active change harness self-tests;
  - the final phase, and the dual check for candidate and baseline from `23e7f76`;
  - the contract reuse assessment for this change, its tests, 73 of 73, and the governance tests, 374 of 374.

  The ordering record and these ticks change planning files only. The final phase and the dual check passed again on
  the ordering record.
- [x] 4.4 Run `/code-review xhigh` on the implementation range. Verify two things:
  - no correctness finding is left open;
  - the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.

  Run on the implementation commit before the review fixes: 12 findings. Ten are fixed by the review-fix commit
  named in 2.1:
  - the `deadlineMs` and `abandoned` comments pinned the accounting to the moment the timer fires;
  - no test pinned `deadlineMs` as the delay passed to the provider;
  - the list of clock globals missed `Temporal`, `Intl`, `Atomics`, `MessageChannel`, `eval` and `Function`;
  - this task's planned plant outcomes did not match what ran (2.1 records the measured ones);
  - the `shutdown()` comment and the README dropped the "work still outstanding" condition;
  - the order test could hang;
  - the source check re-implemented the scope gate's collector;
  - the README stated timing frequencies from one workstation, and said "`shutdown()` returns" for the report;
  - the clock-globals list held the non-clock `require`.

  Two are left, neither an open correctness defect:
  - "returns an exact accounting" stays, as in the canonical requirement; #957 and #958 own its exceptions;
  - enforcing "reads no clock" as a per-file entry in the scope gate's policy would change a governed policy
    outside this change's owned paths. The source check reuses that gate's collector instead.

  The PR body discloses that Claude wrote the change and that independent review was `NOT_PERFORMED`.

## 5. Assessment ordering record

- [x] 5.1 After the implementation commits, and before the implementation PR merges, record in
  `assessment.source.json`'s `ordering` and regenerate:
  - `assessment_commit`, the proposal commit from 1.3;
  - `earliest_governed_implementation_commit`, found by walking the history forward from the proposal baseline;
  - `final_technical_commit`.

  Verify that the commit changes only `ordering` in the two assessment files, and that `--phase final` passes.
  Then, in disposable copies, verify two controls:
  - recording the earliest implementation commit as `assessment_commit` fails
    `assessment-shares-implementation-commit`;
  - recording the record's own commit as `assessment_commit` fails `assessment-follows-implementation`.

  If the branch is rebased, or a technical commit lands after this record, record the ordering again and run both
  controls again before the merge. Name branch commits here by their titles, not their hashes.

  Recorded in the commit titled `docs(openspec): record assessment ordering for
  document-delivery-shutdown-report-timing (#932)`, called the record commit below. The values:
  - `assessment_commit` `eb0a889`, the proposal commit;
  - `earliest_governed_implementation_commit`: the commit titled `docs(sdk-node): document what the delivery
    shutdown deadline bounds (#932)`, returned by `findEarliestGovernedImplementationCommit` walking forward from
    the proposal baseline `b3573b1`;
  - `final_technical_commit`: the commit named in 4.3.

  The record commit changes only `ordering` in the two assessment files. The checker passes in the final phase and
  the assessment phase, and the dual check passes. In disposable clones of the record commit:
  - with the earliest implementation commit as `assessment_commit`, both phases fail
    `assessment-shares-implementation-commit`;
  - with the record commit itself as `assessment_commit`, both phases fail `assessment-follows-implementation`, and
    also `assessment-unrelated`.

## 6. Merge, fold and archive

- [ ] 6.1 Verify two things on the implementation PR head:
  - every required context plus DeepScan is green;
  - the recorded ordering commits exist on that head.
- [ ] 6.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here.
- [ ] 6.3 In a separate fold PR, fold the delta into the canonical spec while the change is still active. Verify
  three things:
  - each scenario heading occurs once in the requirement;
  - no delta header survives;
  - the canonical file equals what `openspec archive` produces in a disposable copy.
- [ ] 6.4 In a separate archive PR, merged with a merge commit after the fold lands, archive the change. Verify that
  the archived directory carries the UTC date of the archive. The issue stays open for the owner.
