# Design: Count every delivery shutdown admission exactly once

Decision source: the owner, 2026-11-14, answering triage questions in a Claude Code session and accepting each
recommended option. The decisions and the agent brief are recorded at
https://github.com/nandohdc/bloodtrail/issues/957#issuecomment-6886536030, with a pointer on #958
(https://github.com/nandohdc/bloodtrail/issues/958#issuecomment-6886536284).

The brief left some choices to this proposal. This design makes each one and says so:
- the module's internal state;
- that a timer is still scheduled when nothing is outstanding;
- the test's rows and its planted defects;
- the source check's identifier list;
- that no ADR is written.

## Context

See `proposal.md` - Why.

`createDeliveryShutdown` keeps three pieces of state:
- `accepted` and `completed`, as counters;
- `inFlight`, a `Set` of the promises the admitted operations returned.

`submit()` works in this order:
1. it increments `accepted`;
2. it calls the operation;
3. it adds the returned promise to `inFlight`;
4. on settlement, it deletes the promise and increments `completed`.

`shutdown()` schedules one timer through the injected provider and races it against `Promise.allSettled(inFlight)`.
`drain()` then returns `inFlight.size` as `abandoned`, and the report's `.then` reads `completed` one turn later.

Each defect in the proposal's table follows from one of three facts:
- a `Set` of promises counts shared promises once;
- an operation that throws, or a re-entrant `shutdown()`, runs before step 3;
- the two reads are a turn apart.

A scratch prototype of the design below was run against every case in the proposal's table. It also ran against
the existing tests in a disposable copy. Every case held the identity, and every existing behavioural test passed
except one: "an empty set of operations completes before the deadline" also asserts that a timer was cleared, which
Decision 5 keeps. The prototype is evidence for this design, not the implementation.

## Goals / Non-Goals

**Goals:**
- `completed + abandoned = accepted` holds by construction, not only in the cases a test thought of.
- The moment the counts are taken is one synchronous step, which the requirement states and a test can pin.
- Every way an admission can end that this design identifies is a row of one test, and each root cause has a planted
  defect that a row catches.

**Non-Goals:**
- When the report returns, which #932 settled.
- A throwing timer provider: recorded on #957, not filed.
- Any change to what `submit()` returns for an operation that resolves, or for a rejected admission attempt.

## Decisions

### Decision 1: One change for the invariant

The owner chose to fix the accounting invariant as a whole. This change covers:
- #957 and #958;
- the two cases the triage found: a shared pending promise and a re-entrant `shutdown()`.

The new cases are recorded on #957 and get no issues of their own.

**Rejected: one change per issue.** Each fix would leave its neighbours standing. A fix to #957 alone, reading both
counts in one turn, still undercounts a shared promise and still abandons on a re-entrant `shutdown()`.

### Decision 2: Count admissions, with counters that move together

The module keeps three counters: `accepted`, `outstanding` and `completed`.
- At admission, before the operation is called, `accepted` and `outstanding` each rise by one.
- When the module observes the operation settle, `outstanding` falls by one and `completed` rises by one, in the same
  synchronous step.

So `completed + outstanding = accepted` holds after every step, and a report taken at any one step is exact.
`abandoned` is `outstanding` at the moment the counts are taken.

`inFlight` and the `Promise.allSettled` race go away. Nothing is keyed by the promise an operation returns, so two
admissions that share one promise are two admissions.

The re-entrant case follows from the order. An operation that calls `shutdown()` has already been counted as
outstanding, so the report waits for it like any other.

**Rejected: keep the `Set`, keyed by a per-admission token.** It would fix the shared promise. But it keeps two
sources for the counts, the set and the counter, and those two would still have to be read in the same step.

### Decision 3: Both counts are taken in the timer callback, or when the last admission settles

The owner chose the timer callback as the counting instant. The module freezes
`{ accepted, completed, abandoned: outstanding }` in one synchronous step, the first of these to happen:
- `shutdown()` is called with `outstanding` already zero (Decision 5);
- the timer provider calls the deadline callback;
- the module observes the settlement that brings `outstanding` to zero.

That step also clears the timer, whichever trigger took it, as `drain()` does today. It then resolves the report with
the frozen object. Every later trigger is a no-op, and every later `shutdown()` returns the same promise.

An operation counts as completed if its settlement was observed by that step, including the settlement whose
observation is the step. The requirement defines "outstanding" and "completed" this way for all of its text, so the
existing "completed before the deadline" and "outstanding when the deadline expires" read the same way.

The module observes a settlement by awaiting the operation's promise, so it sees it at least one microtask turn after
the promise settles. That has a consequence the requirement states outright. An operation that settles in the same
synchronous run as the deadline callback is counted abandoned, whether it settles before the callback or after it:
- today it is counted completed;
- one that settles a turn later is counted both completed and abandoned (#957).

After this change, every such case counts abandoned. The abandoned operation's own `submit()` still resolves with its
result, as the requirement already says.

**Rejected: one read once the race resolves.** This is the minimal patch #957 proposed: keep the race, and read both
counts in the same turn when it resolves. It fixes #957 but leaves the counting instant at an internal promise
chain's mercy, so the requirement could not state it. The owner chose the callback.

### Decision 4: A synchronous throw is a rejection

The module calls the operation inside a `try`. A synchronous throw becomes a rejected promise carrying the thrown
value, and from there it is handled exactly like an asynchronous rejection:
- the admission counts as completed once it is observed;
- `submit()` rejects with the error, as it already does for an asynchronous rejection.

Because the rejection is observed a microtask turn after the throw, like any other, a deadline callback that runs in
the same synchronous run as the throw counts the admission abandoned, not completed (R14).

A submission that is not a function throws a `TypeError` when it is called, so it takes the same path. The owner
chose this over refusing non-functions before admission. It needs no new outcome, and the frozen surface (#111) stays
as it is.

`completed` keeps its present meaning: settled, whether resolved or rejected. That is the meaning the existing
"drains admitted operations" behaviour and the async-rejection case already use.

### Decision 5: One timer is still scheduled at every shutdown

`shutdown()` schedules one timer for `deadlineMs` through the provider, unconditionally, as it does today. If nothing
is outstanding, it then takes the counts at once, which clears that timer.

This keeps the provider's view of the module unchanged: one `setTimeout`, then one `clearTimeout` when the counts are
taken. Today `drain()` clears in its `finally`, even after the timer fired, and the step that takes the counts does
the same. It also keeps two existing tests unchanged:
- "an empty set of operations completes before the deadline", which asserts the clear;
- #932's order test, which asserts one scheduled delay of `deadlineMs`.

**Rejected: schedule no timer when nothing is outstanding.** It saves one call, but it would mean editing an existing
assertion and changing what a host's provider observes, for no gain in the accounting.

### Decision 6: The pins on the module's names follow the code

#932's source check pins the module's free identifiers to an exact list: `Number`, `Object`, `Promise`, `Set` and
`TypeError`. If Decision 2 removes the module's last use of `Set`, the list loses `Set`. The test's list changes in
the same commit, and the task records the change.

Any other change to the list fails the check, as #932 intended. The import check is unchanged: the module imports only
the timer provider's type.

A second pin follows from the same names. The scope gate's null control, in `tests/scope-mutations.test.ts`, pins
the package's platform coupling inventory, including its count of authored references. Measured on one base with only
`src/delivery-shutdown.ts` changed, the count is 92 with today's module and 91 once the module stops naming `Set`,
with no host coupling either way. The pinned count changes to 91 in the same commit as the module. It stays an exact
value, not a range, so a new reference still fails the gate.

The implementation found this second pin, and it was not in this change's owned paths. Task 1.4 brings it into the
plan in a separate planning PR, before any implementation commit, as #423 did for its own pinned count (#435).

### Decision 7: One table-driven test, with a planted defect for each root cause

`tests/delivery-shutdown.test.ts` gains one table. Each row drives one admission scenario through the public
`createDeliveryShutdown`, using the file's `fakeDeadlineTimer`. It asserts three things:
- the exact report;
- `completed + abandoned = accepted`;
- the `submit()` outcome, where the row names one.

| Row | Scenario | Expected report | Today |
|---|---|---|---|
| R1 | settles before `shutdown()` | completed | passes |
| R2 | settles after `shutdown()`, before the timer fires | completed; resolves without the timer | passes |
| R3 | never settles | abandoned | passes |
| R4 | settles in the same synchronous run, before the callback | abandoned | fails (Decision 3) |
| R5 | settles in the same synchronous run, after the callback | abandoned | fails (Decision 3) |
| R6 | settles `k` microtask turns after the callback, `k` = 1 to 6 | abandoned | fails at `k` = 1 (#957) |
| R7 | rejects asynchronously | completed; `submit()` rejects with the error | passes |
| R8 | throws synchronously | completed; `submit()` rejects with the error | fails (#958) |
| R9 | the submission is not a function | completed; `submit()` rejects with a `TypeError` | fails |
| R10 | two admissions share a pending promise | two abandoned | fails |
| R11 | two admissions share a promise that settles before the timer | two completed | passes |
| R12 | `shutdown()` is called inside the operation, which never settles | unresolved until the timer fires, then abandoned | fails |
| R13 | the operation returns a plain value, not a promise | completed; `submit()` resolves `admitted` with that value | passes |
| R14 | throws synchronously, and the deadline callback runs in the same synchronous run as `shutdown()` | abandoned; `submit()` rejects with the error | fails |

The rows run through one shared harness: a table of row definitions driven by one helper, not one hand-written `it()`
per row. #954's `codescene delta` check failed on six near-identical test functions, and was fixed with shared
helpers. This table is larger, so it starts that way.

Where needed, rows wait a macrotask turn (`setImmediate`) before firing the timer, as #932's order test does. Rows
that test a timing build it on the microtask chain the test controls, so each one is deterministic. The test carries
a bounded timeout, so a report that never resolves fails the row instead of hanging the run.

Planted defects run in a disposable copy, beside a null control that stays green. Each restores one root cause:

| Plant | Root cause restored | Row that must fail |
|---|---|---|
| P1 | `abandoned` is the size of a `Set` of the returned promises | R10 |
| P2 | `completed` is read one microtask turn after `abandoned` | R4 and R14 |
| P3 | `outstanding` rises only after the operation returns | R12 |
| P4 | the operation is called before `submit()`'s `try`/`finally`, so a synchronous throw never settles | R8 and R9, by timeout: the report never resolves |
| P5 | the counts are taken one microtask turn after the callback, not in it | R4 and R14 |
| P6 | the operation is called inside `submit()`'s `try`/`finally` without the `catch`, so a synchronous throw is observed in the same turn | R14 |

These catches were measured on 2026-11-14, for R1 to R13 and P1 to P5. The rows were run, as a scratch script, against
the scratch prototype and a copy of it per plant:
- the prototype passed every row;
- each plant failed exactly its rows above among R1 to R13, and no other;
- today's built binding failed R4, R5, R6 at `k` = 1, R8, R9, R10 and R12, as the table says;
- R13 passed against all three.

R14 and P6 were added on 2026-11-15, after review of the planning amendment found that no row caught P6: without R14,
a synchronous throw observed in the same turn passes every row. They were measured the same way. Today's source, from
`origin/main`, failed every row the table says it fails, R14 included. The prototype and the implementation's
uncommitted source passed every row. Each of P1 to P6 failed exactly the rows above, in the prototype and, for P4 and
P6, in the implementation's source too.

Of today's failures, R4 and R5 already sum correctly, as `{ accepted: 1, completed: 1, abandoned: 0 }`. They fail
because Decision 3 reclassifies a same-run settlement as abandoned. The other six rows fail because an admission is
miscounted.

P2 and P5 are both caught by R4, not R5. A late read lets the observation of a settlement queued before the callback
slip in, while one queued after it still runs later. R14 catches them for the same reason: the throw's observation is
queued before the callback. The implementation repeats these runs against the real module
and the real test, and records every test each plant fails, so the recorded catch is the intended row and not a
neighbour. Each plant and the null control run the package's whole runtime suite, so every pin sees the plant. In the
real module, P1 names `Set` again, so it also fails both pins of Decision 6. The other plants name no new global: P2
and P5 defer with a promise reaction, not `queueMicrotask`.

### Decision 8: Records

The records are brought into line with the MODIFIED requirement:
- **The README** section "Deadline-bounded delivery shutdown":
  - the identity;
  - that `completed` means settled, whether resolved or rejected;
  - when the counts are taken;
  - that a synchronous throw counts as a rejection;
  - that an operation awaiting its own `shutdown()` waits for the deadline timer;
- **the doc comments** on `DeliveryShutdownReport.completed` and `abandoned`, `DeliveryShutdown.submit()` and
  `DeliveryShutdown.shutdown()`.

No signature changes, and `test:exports` stays at 19 value and 44 type-only exports.

### Decision 9: No ADR

No surface, dependency or architecture changes, so this change writes no Node ADR:
- the canonical requirement records the counting rule;
- this design and the triage record the decisions.

### Decision 10: The assessment ordering is recorded, as in #932

`src/delivery-shutdown.ts` and its test are governed implementation paths. So, before it merges, the implementation
PR records three commits:
- `assessment_commit`;
- `earliest_governed_implementation_commit`;
- `final_technical_commit`.

It also runs the two planted ordering controls, and records the ordering again after any rebase. Tasks name branch
commits by title, not hash.

## Risks / Trade-offs

- **[A same-run settlement now counts as abandoned]** An operation that settles in the same synchronous run as the
  deadline callback was counted completed, and is now counted abandoned. → The requirement states it, R4 and R5 pin
  it, and the operation's own `submit()` still resolves with its result. With `nodeTimers`, microtasks drain between
  timer callbacks, so a settlement can share the callback's run only if the provider or the operation settles work
  inside that callback.
- **[The race goes away]** The report no longer resolves through `Promise.allSettled`. → #932's order test, its
  source check and the existing tests still pin when the report may resolve, and that the module reads no clock.
- **[A table of rows can still miss a case]** → The identity holds by construction (Decision 2), so a missed row can
  get a count's split wrong, but cannot break the sum. Each plant shows the table catches its root cause.
- **[An operation that awaits its own shutdown now waits for the deadline]** An operation that calls `shutdown()` and
  awaits the report deadlocks with it until the timer fires. The report waits for the operation, and the operation
  waits for the report, so the wait lasts `deadlineMs`, and the operation is counted abandoned. Today that report
  resolves at once, by counting the operation abandoned before the timer fires, which the requirement forbids. →
  The proposal states this under Hosts, and R12 pins the wait. A host that needs a prompt shutdown from inside an
  operation calls `shutdown()` without awaiting it there.
- **[`completed` includes rejected operations]** A reader may take "completed" as "succeeded". → This is the present
  meaning, and it is unchanged. The `DeliveryShutdownReport.completed` doc comment already says "settled". The README
  section does not define `completed`, so task 2.3 adds the same definition there.
