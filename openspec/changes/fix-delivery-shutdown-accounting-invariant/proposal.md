# Proposal

## Why

The Node binding's `createDeliveryShutdown` promises "an exact accounting": every operation admitted before
shutdown is counted once, as completed or as abandoned. Four cases break that promise today (#957, #958). In one of
them, an abandoned admission drops out of the report entirely.

Measured on 2026-11-14 at `origin/main` `1ef08f0` against the built binding, with an injected timer fired by hand:

| Case | Report | What goes wrong |
|---|---|---|
| An operation settles exactly one microtask turn after the deadline timer fires (#957) | `{ accepted: 1, completed: 1, abandoned: 1 }` | counted twice |
| An operation throws synchronously (#958), or the submission is not a function | `{ accepted: 1, completed: 0, abandoned: 0 }` | counted zero times |
| Two admissions return the same pending promise | `{ accepted: 2, completed: 0, abandoned: 1 }` | one abandoned admission vanishes |
| `shutdown()` is called from inside an operation | resolves at once with `abandoned: 1`; the timer never fires | abandoned before the timer fires, which the requirement forbids |

All four come from one cause:
- the module counts promises, not admissions;
- an operation is tracked only after it returns;
- `abandoned` and `completed` are read one microtask turn apart.

The owner triaged both issues on 2026-11-14 as one change that fixes the invariant as a whole
(https://github.com/nandohdc/bloodtrail/issues/957#issuecomment-6886536030). Fixing each symptom on its own would
leave its neighbours to the next review.

## What Changes

- **Every admission is counted exactly once.** In every report, `completed + abandoned = accepted`. The admission is
  the unit counted, whatever promise its operation returns.
- **Both counts are taken in one synchronous step**, at the first of:
  - `shutdown()` being called with nothing outstanding;
  - the timer provider calling the deadline callback;
  - the module observing the last outstanding admission settle.

  An admission whose settlement the module has not yet observed by then counts as abandoned. The module observes a
  settlement at least one microtask turn after the operation's promise settles. So an operation that settles in the
  same synchronous run as the deadline callback, before or after it, now counts as abandoned. Today it counts as
  completed, and one that settles a turn later counts as both.
- **A synchronous throw is a rejection.** An operation that throws synchronously, or a submission that is not a
  function, counts as accepted and completed. `submit()` rejects with the error, as it already does when an operation
  rejects asynchronously.
- **A re-entrant `shutdown()` waits.** If `shutdown()` is called from inside an operation, that operation is already
  counted as outstanding. The report then waits for it, or for the deadline timer, like any other.
- **One table-driven test** asserts the identity, and the expected count, for every case in the table above. It also
  covers every way an admission can end that is correct today. In a disposable copy, it fails against a planted copy
  of each root cause.
- **Records.** The canonical requirement, the README section and the doc comments state the counting rule. The
  requirement gains one scenario per new case.
- **Unchanged:**
  - every export: `test:exports` stays at 19 value and 44 type-only exports, and no signature changes;
  - the admission boundary and idempotency;
  - the timing statements #932 added;
  - the module reads no clock of its own;
  - one deadline timer is still scheduled through the injected provider at every `shutdown()`, and cleared;
  - `compatibility.json`, and the contract, which is frozen at 2.1.0.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: "Node binding provides deadline-bounded delivery shutdown" gains:
  - the statement of the identity, the unit counted and when the counts are taken;
  - the statement that a synchronous throw counts as a rejection;
  - four scenarios.

  Its other text and scenarios are unchanged.

## Impact

- **Code:** `packages/security-audit-sdk-node/src/delivery-shutdown.ts`, the module's internals and doc comments only.
- **Tests:** the Node binding's delivery shutdown tests: the table-driven accounting test, and a test that pins when
  the report resolves against the last counted `submit()` call (design Decision 3). If the module stops naming
  `Set`, two pins on its names change with it: the source check's list of permitted globals, and the scope gate's
  null control count in `tests/scope-mutations.test.ts`, from 92 to 91 authored references.
- **Documentation:** the Node binding's README section "Deadline-bounded delivery shutdown".
- **Hosts:**
  - a host whose operation throws synchronously now sees it counted as completed. Its `submit()` rejects with the
    error, as before;
  - a host that shares one promise between admissions, or calls `shutdown()` inside an operation, now gets a report
    that counts every admission;
  - an operation that settles in the same synchronous run as the deadline callback now counts as abandoned instead of
    completed. Its own `submit()` still resolves with its result, as for any abandoned operation;
  - an operation that calls `shutdown()` and then awaits the report now waits for the deadline timer. The report waits
    for the operation, and the operation waits for the report, so only the timer ends the wait, after `deadlineMs`.
    Today that report resolves at once, wrongly counting the operation abandoned before the timer fires;
  - a host with `nodeTimers` and ordinary operations sees no difference.
- **Out of scope:**
  - a timer provider whose `setTimeout` throws: `shutdown()` then rejects. That is error containment, not accounting.
    It is recorded on #957 and not filed;
  - when the report returns against the deadline timer, which #932 settled, and any numeric bound or service level;
  - the HTTP audit sink's `shutdownTimeoutMs` and sdk-core's shutdown timeout;
  - Stage 2's results, expectations and ledger, and ADR 0015. No run is authorized.
