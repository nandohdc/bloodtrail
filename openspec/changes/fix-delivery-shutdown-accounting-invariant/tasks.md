# Tasks: Count every delivery shutdown admission exactly once (#957, #958)

## 1. Proposal

- [x] 1.1 Author the proposal, design, delta spec (`security-audit-sdk-node`) and tasks from the #957 decision
  record. Verify that `openspec validate fix-delivery-shutdown-accounting-invariant --strict` passes.
  Passed on the proposal commit `584289e`.
- [x] 1.2 Author `assessment.source.json`, then generate `assessment.json` from it. Verify three things:
  - `node openspec/scripts/generate-assessment.mjs --change fix-delivery-shutdown-accounting-invariant --check`
    passes;
  - `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-delivery-shutdown-accounting-invariant`
    passes;
  - the proposal commit changes no path outside this change's directory.

  On the proposal commit `584289e`, `--check` and the assessment phase passed, and the commit changed only this
  change's directory.
- [x] 1.3 Once every required context plus DeepScan is green, merge the proposal PR as a merge commit. Verify by
  recording the proposal commit and the merge commit here.
  Proposal commit `584289e`, merged in #964 as the merge commit `7671049`, with every required context plus DeepScan
  green.
- [x] 1.4 Before any implementation commit, bring the scope gate's null control into the plan in a separate planning
  PR (design Decision 6). `tests/scope-mutations.test.ts` pins the package's authored-reference count, and the
  module moves it when it stops naming `Set`. Add the file to `owned_paths`, then regenerate `assessment.json`.
  Verify four things:
  - the count, measured on one base with only `src/delivery-shutdown.ts` changed: 92 references with the module at
    the proposal's merge, 91 with the module from the implementation's technical commit, and no host coupling in
    either. When recording this task, name that commit by its title and repeat the measurement against it;
  - `generate-assessment.mjs --check` and `--phase assessment` pass;
  - the planning commit changes no path outside this change's directory;
  - once every required context plus DeepScan is green, the planning PR merges as a merge commit.

  Record the planning commit and the merge commit here.
  Recorded: planning commit `43d10aa`, merged in #968 as the merge commit `f24e726`, with every required context plus
  DeepScan green. On the planning commit, `--check` and the assessment phase passed, and it changed only this
  change's directory. The measurement, repeated on `f24e726`'s tree with only `src/delivery-shutdown.ts` changed:
  - 92 references with the module at the proposal's merge, which is unchanged at `f24e726`;
  - 91 with the module from the commit titled `fix(sdk-node): count every delivery shutdown admission exactly once
    (#957, #958)`;
  - 91 with the module from the final technical commit named in 3.3.

  No host coupling in any of the three.

## 2. Count every admission exactly once

- [x] 2.1 Add the accounting table of design Decision 7 to the Node binding's delivery shutdown tests: rows R1 to R14,
  with R6 for `k` from 1 to 6, driven through one shared harness. Each row asserts three things:
  - the exact report;
  - `completed + abandoned = accepted`;
  - the `submit()` outcome, where the row names one.

  The test has a bounded timeout. Before changing the module, verify that against today's source it fails at R4, R5,
  R6 with `k` = 1, R8, R9, R10, R12 and R14, and at no other row. Record the rows that fail.

  Against today's source, the module at `f24e726`, with this test file and the source check's list at its value on
  `main`, the table failed exactly R4, R5, R6 with `k` = 1, R8, R9, R10, R12 and R14:
  - R4 and R5 reported `{ accepted: 1, completed: 1, abandoned: 0 }`;
  - R6 with `k` = 1, R8, R9, R10 and R14 broke the identity, at 2, 0, 0, 1 and 0 against 1, 1, 1, 2 and 1;
  - R12's report resolved before the deadline timer fired.

  Every other row, every existing test and the order test of Decision 7 passed.
- [x] 2.2 Change `src/delivery-shutdown.ts` as design Decisions 2 to 5 describe:
  - admissions are counted with `accepted`, `outstanding` and `completed`;
  - both counts are taken in one synchronous step, in the deadline callback or on the settlement that brings
    `outstanding` to zero;
  - the report resolves four promise reactions after that step, and a test pins the order of Decision 3;
  - the operation is called inside a `try`;
  - one deadline timer is still scheduled at every `shutdown()`, and cleared.

  Verify three things:
  - `npm test --prefix packages/security-audit-sdk-node` passes, including every row of 2.1 and the order test;
  - the existing tests pass, including #932's order test. None of them changes, except the two pins that follow the
    module's names (Decision 6): the source check's list of permitted globals, and the scope gate's null control
    count;
  - the source check and the scope gate pass, and the scope gate reports no host coupling. Any change to either pin
    is one Decision 6 allows, and is recorded here.

  On the final technical commit, `npm run validate`, which runs every step of `npm test`, passed with 290 runtime
  tests, every row and the order test included. The existing tests are unchanged apart from the two pins: the source
  check's list lost `Set`, and the scope gate's null control moved from 92 to 91 authored references (1.4). The
  source check and the scope gate pass, and the scope gate reports no host coupling.
- [x] 2.3 Bring the records into line with the MODIFIED requirement:
  - the doc comments on `DeliveryShutdownReport.completed` and `abandoned`, `DeliveryShutdown.submit()` and
    `DeliveryShutdown.shutdown()`;
  - the README section "Deadline-bounded delivery shutdown": the identity, what `completed` means (settled, whether
    resolved or rejected), when the counts are taken, that a synchronous throw or a non-function submission counts as
    a rejection, that a caller awaiting the last counted `submit()` call directly sees its outcome before the report
    resolves, and that an operation awaiting its own `shutdown()` waits for the deadline timer.

  Verify that the text agrees with the MODIFIED requirement, and that no sentence states or implies a service level or
  a numeric bound on when the report returns.

  The doc comments and the README section state the identity, what `completed` means, when the counts are taken,
  the synchronous-throw rule, the order against the last counted `submit()` call, and the re-entrant `shutdown()`.
  They agree with the MODIFIED requirement, and no sentence states a service level or a numeric bound on when the
  report returns.
- [x] 2.4 In a disposable copy, plant each defect of design Decision 7 (P1 to P8) in `src/delivery-shutdown.ts`, beside
  a null control, the unchanged source, that stays green. Each plant and the null control run the package's whole
  runtime suite, `npm run test:runtime`. Verify that each plant fails the tests the design names:
  - P1 fails R10;
  - P2 fails R4 and R14;
  - P3 fails R12;
  - P4 fails R8 and R9;
  - P5 fails R4 and R14;
  - P6 fails R14;
  - P7 fails the order test at 0 layers, and no row;
  - P8 fails the order test at 1 layer, and no row.

  P1 names `Set` again, so it is also expected to fail the source check and the scope gate's null control. The
  other plants name no global the source check does not permit: P2 and P5 defer with a promise reaction, not
  `queueMicrotask`. Record every test each plant fails, so that the recorded catch is the intended row and not a
  neighbour.

  Each plant was generated as exact edits of the final source, and run in a disposable clone with `.git` removed.
  The null control passed all 290 runtime tests. Every test each plant failed:
  - P1: R10, the source check, and the scope gate's null control, at 92 against 91;
  - P2: R4 and R14;
  - P3: R12;
  - P4: R8 and R9, each timed out after 2,000 ms;
  - P5: R4 and R14;
  - P6: R14;
  - P7: the order test, at 0 layers;
  - P8: the order test, at 1 layer.

## 3. Integration checks

- [x] 3.1 Verify that `npm run validate --prefix packages/security-audit-sdk-node` passes, with `test:exports` at
  19 value and 44 type-only exports, and that `git diff --check` is clean.
  Passed on the final technical commit: 290 runtime tests, 19 value and 44 type-only exports, and a clean
  `git diff --check` against `f24e726`.
- [x] 3.2 Verify that `git diff --exit-code origin/main...HEAD -- packages/security-audit-sdk-node/compatibility.json`
  is empty.
  Empty: `compatibility.json` is unchanged.
- [x] 3.3 Run `make governance-gates` on the implementation PR's final technical commit, with every workspace's
  dependencies installed. Then run the post-commit governance battery:
  - `--phase final`;
  - the dual check;
  - the governance tests.

  Verify that every step passes, and record the commit each ran on.

  On the commit titled `docs(sdk-node): state how delivery shutdown counts admissions (#957, #958)`, the final
  technical commit, with every workspace's dependencies installed: `make governance-gates` passed across every
  workspace, in 1,246 s. Two earlier runs on the same commit stopped
  before the end and are not counted:
  - the first, when `node` aborted inside macOS LaunchServices while npm set its process title, in an evaluation kit
    control's nested build. The same control passed in `validate` on the same commit;
  - the second, at `packages/client-evidence-browser`, whose dependencies were not yet installed.

  On the same commit, the final phase passed from base `f24e726`, the dual check passed for candidate and baseline,
  and the governance tests passed 374 of 374. Each later commit changes planning files only, and the final phase and
  the dual check passed again on each.
- [x] 3.4 Run `/code-review xhigh` on the implementation range. Verify two things:
  - no correctness finding is left open;
  - the PR body discloses its authorship and that independent review was `NOT_PERFORMED`.

  Run twice. On the range before the order fix: 6 findings. Three are fixed: the report resolving before the last
  counted `submit()` call (now Decision 3), R12 checking a placeholder, and a wrong line in the fix commit's message.
  Three are left, none an open correctness defect:
  - a throwing `clearTimeout` leaves the report unresolved: the design's throwing-provider non-goal;
  - the harness attaches its rejection handlers after a row's drive returns, which no current row reaches;
  - the counter object's `close()` relies on its one caller for idempotency.

  On the final range: 5 low findings. Two are fixed in the plan text: the `.catch()` layer, and the proposal's Impact
  and the design's non-goal. Three are left, none a correctness defect:
  - the order test pins depths 1 to 3, which the docs do not promise, on purpose (Decision 3);
  - the module's `void` is the first in any package source, which Sonar may flag once it is required again;
  - the reaction helper treats 0 and 1 alike, and is called only with 4.

  The PR body discloses its authorship and that independent review was `NOT_PERFORMED`.

## 4. Assessment ordering record

- [x] 4.1 After the implementation commits, and before the implementation PR merges, record in
  `assessment.source.json`'s `ordering` and regenerate:
  - `assessment_commit`, the planning commit from 1.4, the last commit to change the assessment before the
    implementation;
  - `earliest_governed_implementation_commit`, found by walking the history forward from the implementation branch's
    merge base with `main`, which descends from the planning PR's merge commit from 1.4. Not from the proposal
    baseline: #963's commits landed after it, and the walk would stop at the first of them to change a governed path,
    `ci: skip sonar analysis when SONAR_ANALYSIS is disabled (#963)`, which is not this change's implementation;
  - `final_technical_commit`.

  Verify that the commit changes only `ordering` in the two assessment files, and that `--phase final` passes.
  Then, in disposable copies, verify two controls:
  - recording the earliest implementation commit as `assessment_commit` fails
    `assessment-shares-implementation-commit`;
  - recording the record's own commit as `assessment_commit` fails `assessment-follows-implementation`.

  If the branch is rebased, or a technical commit lands after this record, record the ordering again and run both
  controls again before the merge. Name branch commits here by their titles, not their hashes.

  Recorded in the commit titled `docs(openspec): record assessment ordering for
  fix-delivery-shutdown-accounting-invariant (#957, #958)`, called the record commit below. The values:
  - `assessment_commit` `43d10aa`, the planning commit from 1.4;
  - `earliest_governed_implementation_commit`: the commit titled `fix(sdk-node): count every delivery shutdown
    admission exactly once (#957, #958)`, returned by `findEarliestGovernedImplementationCommit` walking forward from
    the merge base `f24e726`;
  - `final_technical_commit`: the commit named in 3.3.

  The record commit changes only `ordering` in the two assessment files. On it, the checker passes in the final phase
  and the assessment phase, and the dual check passes. In disposable clones of the record commit:
  - with the earliest implementation commit as `assessment_commit`, both phases fail
    `assessment-shares-implementation-commit`;
  - with the record commit itself as `assessment_commit`, both phases fail `assessment-follows-implementation`.

## 5. Merge, fold and archive

- [ ] 5.1 Verify two things on the implementation PR head:
  - every required context plus DeepScan is green;
  - the recorded ordering commits exist on that head.
- [ ] 5.2 Merge the implementation PR as a merge commit. Verify by recording the merge commit here.
- [ ] 5.3 In a separate fold PR, fold the delta into the canonical spec while the change is still active. Verify
  three things:
  - each scenario heading occurs once in the requirement;
  - no delta header survives;
  - the canonical file equals what `openspec archive` produces in a disposable copy.
- [ ] 5.4 In a separate archive PR, merged with a merge commit after the fold lands, archive the change. Verify that
  the archived directory carries the UTC date of the archive. Both issues stay open for the owner.
