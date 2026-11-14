# Design: Document what the delivery shutdown deadline bounds

Decision source: the owner, 2026-11-13, answering triage questions in a Claude Code session and accepting each
recommended option. The decisions and the agent brief are recorded at
https://github.com/nandohdc/bloodtrail/issues/932#issuecomment-6843785112. On 2026-11-14 the owner also chose to
keep the accounting defect found while writing this proposal out of this change, filed as #957.

Where the brief left a choice to this proposal, this design makes it and says so:
- the exact wording, and where the composer's obligation is stated;
- whether the doc comments change;
- the test's shape and its planted defect;
- that no ADR is written.

## Context

See `proposal.md` - Why.

`createDeliveryShutdown({ deadlineMs, timers })` validates `deadlineMs` as a non-negative integer. At `shutdown()`
it does four things in order:
1. it stops admitting new work;
2. it calls `timers.setTimeout(callback, deadlineMs)` once;
3. it races that timer against `Promise.allSettled` over the admitted operations still in flight;
4. when either wins, it reads how many are still in flight as `abandoned`, cancels the timer, and resolves the
   report with `accepted`, `completed` and `abandoned`.

It never reads a clock. Every statement about time that the binding can make is a statement about when the
provider calls the callback.

The report therefore resolves some microtask turns after the timer's callback runs. On a real event loop it also
waits for whatever else is queued. The #932 triage found two things:
- with `nodeTimers`, 77 of 80 reports returned after `deadlineMs`;
- 3 of 80 returned up to 0.70 ms before it, because a Node timer can fire slightly early.

So the binding cannot promise either "by" or "after" `deadlineMs` measured on a clock. It can promise only an order
of events: no report before the provider's timer fires while work is outstanding.

The 2026-11-14 check for this proposal found #957: the two counts are read one microtask turn apart. An operation
that settles in that turn is counted both completed and abandoned.

## Goals / Non-Goals

**Goals:**
- The canonical requirement and the README say what `deadlineMs` bounds and what it does not.
- A composer with an outer deadline is told to reserve time for the report.
- One test pins the order the spec states, and can fail.

**Non-Goals:**
- Changing when the report returns, or adding a reserve option (the brief's rejected remedy).
- Fixing #957, or stating at which turn the counts are taken.
- Any numeric bound or service level.
- The HTTP audit sink's `shutdownTimeoutMs`, sdk-core's shutdown timeout, Stage 2 and ADR 0015.

## Decisions

### Decision 1: Document the bound; the primitive's behaviour does not change

The requirement gains a paragraph:
- `deadlineMs` is the delay passed to the injected timer provider;
- the shutdown module reads no clock or timer of its own;
- while operations are outstanding, nothing is counted abandoned and the report does not resolve before the timer
  fires;
- once it fires, the report resolves afterwards, and no bound is stated on how long after.

The paragraph says "the shutdown module", not "the binding". The binding as a whole reads clocks: the fetch exchange
uses `AbortSignal.timeout`, and `nodeTimers` wraps the global `setTimeout`.

The "before the timer fires" clause is conditioned on operations being outstanding. The unchanged scenario for an
empty or fully drained set still resolves without the timer.

**Rejected: return the report by `deadlineMs`.** That would mean firing the timer early by some reserve, and it
has three costs:
- it abandons work sooner than configured;
- it needs a reserve policy;
- it still could not hold on a busy event loop, since the primitive sees only the injected timer.

The owner rejected it in triage.

**Rejected: a reserve option on the primitive.** It widens the frozen surface (#111) for something a composer can
already do by passing a smaller `deadlineMs`.

### Decision 2: The requirement states order, not time

The new paragraph says "never before the provider's timer fires", not "after `deadlineMs` milliseconds". A Node
timer can fire early, so a statement measured on a clock would be false on the binding's own default provider.

The new scenario is written as an order of events (before fire / after fire). A test with an injected timer can
check it exactly, with no clock.

### Decision 3: The accounting moment is not stated (#957)

The scenario uses one operation that settled before the timer fired and one that never settles. Both are counted
the same whichever turn the counts are read at. Neither the paragraph nor the doc comments say "counted at the moment the
timer fires", because #957 shows the two counts are not read in one turn. This change neither pins that defect nor contradicts
the existing "exact accounting" scenario, which #957's fix restores for that window. #958, an operation that
throws synchronously and is counted accepted only, is a second accounting defect, also out of scope.

### Decision 4: The composer's reserve is guidance, stated where composers read it

The requirement closes with a non-normative sentence: a composer with an outer deadline cannot rely on the report
by `deadlineMs`, and gives the binding a smaller one. The binding's spec binds the binding, so it does not lay a
SHALL on a host.

The README says the same in plain terms and gives one measured example:
- Stage 2's reference composition passed 180 ms inside a 200 ms outer deadline (#899), and its reports returned
  0.58 to 2.73 ms after the 180 ms;
- it is labelled as one workstation's observation, not as a recommended value or a bound.

### Decision 5: Doc comments are brought into line; no statement changes

The comments on these are reworded to match the requirement:
- `DeliveryShutdownOptions.deadlineMs`: the delay passed to the timer provider, after which outstanding work is
  counted abandoned;
- `DeliveryShutdownReport.completed`: admitted operations counted as settled. `abandoned`: admitted operations
  counted as outstanding once the deadline timer fired. Neither names the turn at which it is read (Decision 3);
- `DeliveryShutdown.shutdown()`: the report resolves after the decision, with no bound on when.

These are comment-only edits in `src/delivery-shutdown.ts`:
- no statement, expression, type or signature changes;
- the built `.d.ts` changes only in comments;
- `test:exports` is unaffected.

### Decision 6: Two tests, each with a planted defect the existing tests miss

Both are added to `tests/delivery-shutdown.test.ts`.

**The order test** uses that file's `fakeDeadlineTimer`, whose timer fires only when the test calls `fire()`:
1. admit two operations, settle one, and initiate shutdown;
2. let pending work run with a macrotask turn (`setImmediate`), and assert the report has not resolved;
3. fire the timer, await the report, and assert `{ accepted: 2, completed: 1, abandoned: 1 }`.

**The source check** parses `src/delivery-shutdown.ts` with the TypeScript compiler API and asserts two things:
- no free identifier names a clock or timer global: `setTimeout`, `clearTimeout`, `setInterval`, `setImmediate`,
  `Date`, `performance`, `process` or `AbortSignal`. The injected provider's members, reached as
  `timers.setTimeout`, are property names and do not count;
- the module's only import is the type-only import of `AuditTimerProvider` from sdk-core, so no clock can arrive
  through `node:timers`, `node:perf_hooks` or any other module.

The order test alone cannot pin "reads no clock". Measured on 2026-11-14 against the built binding, a `drain()` that
also races a real `setTimeout(0)` passes three things:
- the seven existing tests;
- a script that replays the order test's steps, 20 of 20 runs, because on Node a timers-phase callback can run after the test's `setImmediate`;
- `check-scope.mjs`, which allows `setTimeout` as a language global. It also passes a module that imports
  `node:timers`. The only gate that moves is the scope null control's reference count, which catches any added
  reference anywhere in the binding, not a clock in particular.

In production that module resolves the report about a millisecond after `shutdown()`.

Plants, run in a disposable copy beside a null control that stays green:
- `drain()` races a real `setImmediate`. The existing tests pass; the order test fails;
- `drain()` races a real global `setTimeout(0)`. The existing tests and the order test pass; the source check fails;
- `drain()` resolves at a `Date.now()` deadline. The source check fails;
- `drain()` races a `setTimeout` imported from `node:timers`. The source check fails on the import.

A `drain()` that returns without waiting for the race is not used as a plant, because the existing test "drains
admitted operations that settle before the deadline" already fails against it.

### Decision 7: No ADR

No behaviour, surface or architecture changes, so this change writes no Node ADR:
- the canonical requirement is the record of what `deadlineMs` means;
- the rejected remedy is recorded in this design and in the triage.

ADR 0015 is unchanged.

### Decision 8: The assessment ordering is recorded, as in #945

The comment edits under `src/` and the new test are governed implementation paths. So the implementation PR
records `assessment_commit`, `earliest_governed_implementation_commit` and `final_technical_commit` before it
merges, and runs the two planted ordering controls. If the branch is rebased, it records them again. Tasks name
branch commits by title, not hash.

## Risks / Trade-offs

- **The order test sees only what resolves within one macrotask turn.** A module that waits on a real timer can
  resolve later than that, which is why the source check exists. The source check in turn sees only free
  identifiers and imports. A clock reached through an injected value other than the timer provider is out of its
  reach, and the module has none: its options are `deadlineMs` and `timers`.
- **A reader may still take `deadlineMs` as a wall-clock bound.** The README states the reverse in its first
  sentence on the subject, and the composer guidance follows directly.
- **#957 and #958 stay open.** Until their fixes land, the "exact accounting" scenario does not hold for an
  operation that settles in the one-turn window, or for one that throws synchronously. This change says nothing
  that depends on either case.
