## MODIFIED Requirements

### Requirement: Node binding provides deadline-bounded delivery shutdown

The Node binding SHALL provide a shutdown module that gates admission to an injected asynchronous delivery operation with a lifecycle boundary, independent of what that operation is. Once shutdown has been initiated, every subsequent admission attempt SHALL be rejected immediately and synchronously with a `rejected_shutting_down` outcome, without invoking the wrapped operation, and with no window in which a concurrent admission attempt could be accepted after that boundary. Shutdown SHALL drain every operation admitted before the boundary against a configured deadline and SHALL return an exact accounting of how many operations were accepted, completed before the deadline, and abandoned at deadline expiry. An operation still outstanding when the deadline expires SHALL be counted as abandoned and SHALL never be reported delivered. Shutdown SHALL be idempotent: a repeated shutdown call SHALL return the same accounting without re-draining or double-counting.

The configured deadline, `deadlineMs`, is the delay the shutdown module SHALL pass to the injected timer provider when shutdown is initiated. The shutdown module SHALL read no clock or timer of its own, so when the deadline expires is the timer provider's timing. While any operation admitted before the boundary is still outstanding, the module SHALL NOT count any operation abandoned, and SHALL NOT resolve the shutdown report, before that timer fires. Once the timer fires with operations outstanding, the report resolves afterwards, and the binding states no bound on how long after: that depends on the timer provider and on the rest of the event loop. A composer with an outer deadline therefore cannot rely on the report returning by `deadlineMs`, and has to give the module a smaller deadline and keep the difference for the report.

Each admission SHALL be counted exactly once, so that in every report the number completed plus the number abandoned equals the number accepted. The admission SHALL be the unit counted, whatever its operation returns. Throughout this requirement, an admitted operation is outstanding until the module has observed it settle, and has completed once the module has; the module observes a settlement no earlier than one microtask turn after the operation's promise settles. The module SHALL take both counts in one synchronous step, at the first of: shutdown being initiated with no admitted operation outstanding, the timer provider calling the deadline callback, or the module observing the last outstanding operation settle. An admission SHALL count as completed if the module has observed its operation settle by that step, including a settlement whose observation is that step, and as abandoned otherwise. An operation that throws synchronously instead of returning a promise, and a submission that is not a function, SHALL be treated as an operation that rejected with the error that invoking it raised: the admission counts as accepted, the admission attempt rejects with that error as it does when an operation rejects asynchronously, and the operation is outstanding until the module observes that rejection. A shutdown initiated from inside an admitted operation SHALL count that operation as outstanding, like any other operation admitted before the boundary.

#### Scenario: New admission after shutdown is rejected deterministically
- **WHEN** an admission is attempted after shutdown has been initiated
- **THEN** the module immediately returns `rejected_shutting_down` without invoking the wrapped operation

#### Scenario: Concurrent admission cannot cross the shutdown boundary
- **WHEN** shutdown is initiated concurrently with an admission attempt
- **THEN** the admission boundary applies without a gap, so no admission attempted at or after the moment shutdown is initiated is ever accepted

#### Scenario: An empty or fully drained set of operations completes before the deadline
- **WHEN** shutdown is initiated with no admitted operations outstanding, or all admitted operations have already settled
- **THEN** shutdown resolves without waiting for the configured deadline and reports zero abandoned operations

#### Scenario: Deadline expiry marks outstanding work as abandoned with exact accounting
- **WHEN** shutdown's configured deadline expires while operations admitted before the boundary remain outstanding
- **THEN** shutdown returns the exact count of accepted, completed, and abandoned operations, and no abandoned operation is ever reported delivered

#### Scenario: Repeated shutdown is idempotent
- **WHEN** shutdown is called more than once, sequentially or concurrently
- **THEN** every call returns the identical accounting from the first shutdown, and no operation is drained or counted more than once

#### Scenario: The report is not available before the deadline timer fires
- **WHEN** shutdown is initiated with one admitted operation that has settled and one that never settles, and the injected timer provider has not yet fired the deadline timer
- **THEN** the shutdown report remains unresolved while other pending work runs, and once the provider fires the timer the report resolves with one accepted operation per admission, the settled operation counted completed, and the unsettled operation counted abandoned

#### Scenario: Both counts are taken together when the deadline timer fires
- **WHEN** the module has not observed an admitted operation settle by the time the timer provider calls the deadline callback, including an operation that settles in the same synchronous run as that callback or on the microtask chain the callback starts
- **THEN** the report counts that operation abandoned and not completed, and completed plus abandoned equals accepted

#### Scenario: A synchronous throw is counted as a rejected operation
- **WHEN** an admitted operation throws synchronously instead of returning a promise, or the submission is not a function, and shutdown then drains, with the module observing the rejection before the deadline timer fires
- **THEN** the admission attempt rejects with the thrown error, and the report counts that admission accepted and completed

#### Scenario: Admissions that share one pending promise are counted separately
- **WHEN** the operations of two admissions return the same promise, and it is still pending when the timer provider fires the deadline timer
- **THEN** the report counts two accepted, none completed and two abandoned

#### Scenario: Shutdown initiated from inside an operation waits for the deadline timer
- **WHEN** shutdown is first initiated from inside an admitted operation before that operation returns, and the operation never settles
- **THEN** the report stays unresolved until the timer provider fires the deadline timer, and then counts that operation abandoned
