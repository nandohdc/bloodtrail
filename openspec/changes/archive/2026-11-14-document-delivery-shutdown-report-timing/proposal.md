# Proposal

## Why

The Node binding's `createDeliveryShutdown` returns its report only after its deadline timer fires, which on the
default `nodeTimers` provider is almost always after its configured `deadlineMs`. Nothing in the binding's records
says so (#932).

At `shutdown()` the primitive schedules one timer for `deadlineMs` through the injected `AuditTimerProvider`. It
races that timer against the admitted operations settling. When the timer fires, it counts what is still
outstanding as abandoned, and the report resolves afterwards. The primitive reads no clock of its own. So
`deadlineMs` sets when abandonment is decided. When the report returns depends on the timer provider and on
whatever else the event loop is running.

Stage 2 observed this in every phase where shutdown abandoned work: all 10 reports returned 0.58 to 2.73 ms after
the configured deadline. The #932 triage, with `nodeTimers` on one workstation, measured 77 of 80 reports
after `deadlineMs` and 3 up to 0.70 ms before it, because a Node timer can fire slightly early. With an injected
timer fired by hand, the report had not resolved before the timer fired, and resolved only after it.

The canonical requirement "Node binding provides deadline-bounded delivery shutdown" and the README's
"Deadline-bounded delivery shutdown" section both say that shutdown drains "against the configured deadline" and
counts what is outstanding at expiry as abandoned. Neither says when the report returns, and neither tells a
composer to reserve time for it.
- A host that hands the primitive its whole outer deadline overruns that deadline. Stage 2 run 3's reference
  composition did this (#890).
- The composition met its 200 ms deadline only by giving the primitive 180 ms (#899). Nothing in the binding's
  documentation tells a composer to do that.

The owner settled the remedy in the #932 triage
(https://github.com/nandohdc/bloodtrail/issues/932#issuecomment-6843785112): document the bound, and change no code
behaviour.

## What Changes

- **The canonical requirement states what `deadlineMs` bounds.**
  - `deadlineMs` is the delay the shutdown module passes to the injected timer provider.
  - The module reads no clock or timer of its own, so the deadline's timing is the provider's.
  - While admitted work is outstanding, nothing is counted abandoned and the report does not resolve before that
    timer fires.
  - Once it fires, the report returns afterwards, and the binding states no bound on when.
- **A new scenario.** When the deadline expires with work outstanding, the report is not available before the
  provider's timer fires. Once the timer fires, the report resolves:
  - an operation that settled before the timer fired is counted completed;
  - an operation that never settles is counted abandoned.
- **The README section says the same in plain terms.** It tells a composer with an outer deadline to give the
  primitive a smaller `deadlineMs` and keep the difference as a reserve for the report. It cites the Stage 2
  reference composition (180 ms inside 200 ms) as one environment's observation, not as a recommended value.
- **Doc comments.** The comments on `DeliveryShutdownOptions.deadlineMs`, `DeliveryShutdownReport.completed` /
  `abandoned` and `DeliveryShutdown.shutdown()` are brought into line with the requirement. No signature changes.
- **Two tests:**
  - with an injected timer, the report is still unresolved once pending work has run before the timer fires. Once
    the timer fires, it resolves, counting the operation that settled earlier as completed and the one that never
    settles as abandoned;
  - a source check: the shutdown module's source references no clock or timer global (`setTimeout`,
    `setInterval`, `setImmediate`, `Date`, `performance`, `process`, `AbortSignal`), and imports nothing but the
    provider's type. A behavioural test cannot see a module that races a real `setTimeout(0)`, and the scope gate
    allows both that global and a `node:timers` import.

  In a disposable copy, each fails against its planted defect, which the existing tests do not catch.
- **No service level.** No text states or implies a service level, and no numeric bound on the report's return is
  introduced.
- **Unchanged:**
  - the primitive's behaviour, accounting, idempotency and admission boundary;
  - every export: `test:exports` stays at 19 value and 44 type-only exports;
  - `compatibility.json`, and the contract, which is frozen at 2.1.0.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: "Node binding provides deadline-bounded delivery shutdown" gains:
  - the statement of what `deadlineMs` bounds;
  - the statement that the report's return is unbounded;
  - the statement that the deadline's timing comes from the injected timer provider;
  - one scenario.

  Its other text and scenarios are unchanged.

## Impact

- **Code:** doc comments in `packages/security-audit-sdk-node/src/delivery-shutdown.ts` only. No statement,
  expression or signature changes.
- **Tests:** two cases in the Node binding's delivery shutdown tests.
- **Documentation:** the Node binding's README.
- **Hosts:** none changes behaviour. A host that gives the primitive its whole outer deadline overruns it, as it
  does today, and the README now says so.
- **Out of scope:**
  - #957: an operation that settles one microtask turn after the timer fires is counted both completed and
    abandoned. This change does not say at which turn the counts are taken, so it neither pins nor contradicts that
    defect;
  - #958: an operation that throws synchronously is counted accepted but neither completed nor abandoned;
  - making the report return by `deadlineMs`, or adding a reserve option to the primitive;
  - the HTTP audit sink's `shutdownTimeoutMs` and sdk-core's shutdown timeout;
  - Stage 2's results, expectations and ledger, the harness's composition parameters, and ADR 0015. No run is
    authorized.
