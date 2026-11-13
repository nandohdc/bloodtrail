# Design: Refuse an oversized transaction-critical occurrence before the commit

Decision source: the owner, 2026-11-13, answering triage questions in a Claude Code session and accepting each
recommended option. The decisions and the agent brief are recorded at
https://github.com/nandohdc/bloodtrail/issues/945#issuecomment-6843783279. Where the brief left a choice to this
proposal, this design makes it and says so:
- the refusal code's name;
- where the size is measured, and where the size check sits among the admission checks;
- which module holds the one constant;
- how the ordering record copes with a rebase.

## Context

See `proposal.md` - Why.

Since #913 (ADR-NODE-007), `deliver(event, transactionId, commitGate)` admits an occurrence in one synchronous
step, in this order:
1. it serializes the occurrence with `JSON.stringify`, and refuses it as `occurrence_not_serializable` when that
   fails;
2. it parses the string back and freezes the result at every depth. This is the snapshot;
3. it refuses a snapshot whose event name is not a `transaction_critical` catalog entry;
4. it refuses an empty transaction identifier;
5. it refuses a commit state the occurrence's own catalog entry does not allow;
6. it checks whether the pair is already settled or in flight.

It then runs the durability probe, the commit gate unless the commit state is `not_committed`, and the handoff.

The handoff the binding is given is any `HttpDeliveryHandoff`. The binding's own factory,
`createHttpDeliveryHandoff`, serializes the occurrence again and refuses a body over 65,536 UTF-8 bytes as
`non_retryable` / `request_too_large`, without an exchange. The `HttpDeliveryHandoff` interface takes an occurrence
and returns a result. It does not expose a limit.

Three places hold the number today:
- sdk-core's `MAX_EVENT_BYTES`, which is module-private;
- the handoff's `MAX_REQUEST_BODY_BYTES`, which is module-private;
- the collector's generated `EVENT_MAX_BYTES`, written from the contract's `bounds.event_max_bytes`.

## Goals / Non-Goals

**Goals:**
- An occurrence too large to become durable is refused before the durability probe, so no business change commits
  for it.
- The refusal names its cause.
- Inside the Node binding, the limit is written once, and a test ties it to the contract.
- Every occurrence at or under the limit gets the result it gets today.

**Non-Goals:**
- Changing the contract, the catalog or sdk-core.
- Changing the `HttpDeliveryHandoff` interface or the handoff's result codes.
- Applying sdk-core's other limits (depth, array length, string length) in the binding.
- The `best_effort` and `policy_critical` bindings.
- #943: the checker still takes recorded ordering commits as given.

## Decisions

### Decision 1: Admission refuses an occurrence larger than the contract's event size limit

Before the durability probe runs, `deliver()` refuses an occurrence whose JSON serialization is larger than 65,536
UTF-8 bytes. The result is `refused` with a new code. The probe, the gate and the handoff do not run, and the pair
is neither recorded nor reserved.

The limit is the contract's `bounds.event_max_bytes`, not a property of whichever handoff was injected. An event
over that limit is not a canonical event: sdk-core refuses to build one, and the collector refuses to admit one.
So the binding refuses it whatever handoff it holds.

The refusal applies to every commit state. A `not_committed` occurrence runs no commit gate, but it cannot become
durable either, and refusing it at admission gives one rule and one code.

*Alternatives considered:*
- *Keep the order and carry `request_too_large` in the failed-closed result.* Rejected by the owner in triage. The
  business change would still commit with no durable audit record.
- *Ask the handoff whether it would accept the occurrence, through a new method on `HttpDeliveryHandoff`.*
  Rejected. It changes a frozen interface that hosts implement, and the limit that matters is the contract's.
- *Refuse only occurrences whose commit state runs the gate.* Rejected. An oversized `not_committed` occurrence
  would still run the probe and fail at the handoff, with a different code for the same cause.

### Decision 2: The size is measured once, on the snapshot's serialization, in UTF-8 bytes

Admission already holds the string `JSON.stringify` returned. It measures that string with the binding's existing
byte count, the one the handoff uses for its body and its `content-length` header. It does not serialize again.

The handoff later serializes the frozen snapshot, which was parsed from that same string. That second
serialization has the same members and values as the first, each written the same way, so it has the same byte
count. Its keys can come out in a different order for an unusual caller object, such as a proxy that lists its
keys out of the usual order, but reordering keys does not change the length. For ordinary objects the two strings
are identical, which #913's tests pin for every contract example. So the size admission measured is the size the
Node binding's own handoff measures, and an occurrence that passes admission is not refused by that handoff for
its size. A test at exactly the limit checks this end to end: one exchange is made, with a body of that size.

The count is bytes, not characters. A string of 40,000 two-byte characters is under the limit in characters and
over it in bytes, and the handoff would refuse it.

### Decision 3: The size check comes right after the serialization check

The order of admission becomes:
1. no JSON serialization: `occurrence_not_serializable`;
2. serialization over the limit: `occurrence_too_large`;
3. the snapshot is parsed and frozen, and the existing checks follow unchanged: event name and class, transaction
   identifier, commit state;
4. the duplicate check.

The size check runs before the parse and the freeze. An oversized input then costs one serialization and one byte
count, and the binding never builds or walks a frozen copy of it.

Because the snapshot does not exist yet, the refusal reports the event identifier through the same guarded read of
the caller's object that `occurrence_not_serializable` uses: a string, or the empty string.

Like every other admission refusal, it is decided before the duplicate check. A repeat of a settled or in-flight
pair that is now oversized is refused as too large, not reported delivered.

The delta states this order, because an oversized input can also match another refusal. A 70,000-byte string is
both too large and not an occurrence object. It is refused as too large.

*Alternative considered: check the size last, after the cheaper field checks.* Rejected. The field checks need the
parsed snapshot, so the binding would parse and freeze an input of any size before refusing it.

### Decision 4: One constant in the Node binding, tied to the contract by a test

The limit stays where it is declared today, in `http-handoff.ts`, renamed `EVENT_MAX_BYTES` and exported from that
module. Admission imports it. It is not re-exported from the package entry, so the public surface gains no export.
`http-handoff.ts` already shares `BOUNDED_ABSOLUTE_PATH` with another module in the same way.

The tie to the contract is behavioural. The size tests read `bounds.event_max_bytes` from
`contracts/security-audit/source/contract.source.json` and build each occurrence from that number: exactly the
limit, and one byte over. They run through the public entry, for admission and for the handoff called directly.
If either applies another limit, a test fails. No test names the number as a literal, and none imports the
constant, so the tests do not reach past the public entry. The Node binding's tests already read contract rows
from that file.

*Alternatives considered:*
- *Generate the constant from the contract, as the collector does.* Not chosen now. It adds a generator and a
  drift gate to the Node binding for one number, and the test gives the same protection against drift. It remains
  open as a later change.
- *Import sdk-core's limit.* Out of scope. sdk-core does not export it, and its surface is frozen.
- *Keep two literals and a test that compares them.* Rejected. The owner decided on one source.
- *Declare the constant beside the byte count, in `byte-length.ts`.* Rejected. That module is a platform provider
  for sdk-core, and a contract bound does not belong in it.
- *A test that imports the constant and compares it with the contract.* Rejected. It would be the only test to
  import a module other than the public entry, and it would pass even if the handoff ignored the constant.

### Decision 5: One new refusal code widens `DeliveryClassRefusalCode` additively

The code is `occurrence_too_large`, beside `occurrence_not_serializable`. It is a new literal in an existing
exported union, so no export is added, removed or renamed, and `test:exports` stays at 19 value and 44 type-only
exports. The widening is recorded as one more `freezeRecord.amendments` entry in `compatibility.json` and in a new
ADR-NODE-008, as ADR-NODE-001 requires for a change to the frozen surface.

The handoff keeps `request_too_large` for a direct caller. The two codes differ because they belong to different
result types: one is a delivery-class refusal before anything ran, the other a handoff result.

### Decision 6: Where each statement lives

| Statement | Place |
|---|---|
| The size refusal, its timing and what it does not run | the MODIFIED requirement in this change's delta |
| The size refusal is decided before every refusal but the serialization one | the same requirement |
| Admission and the HTTP delivery handoff apply one limit, equal to the contract's | the same requirement |
| The decision, its alternatives and the surface widening | ADR-NODE-008 |
| The pointer from the size case that ADR-NODE-007 left out of scope | one line in ADR-NODE-007 |
| The new row and the migration note | the Node binding's README |
| The amendment | `compatibility.json` |

The canonical spec did not state the handoff's size limit before. This change states it only as far as the
binding's guarantee needs: the two limits are one value.

### Decision 7: This change records its own assessment ordering, before the merge

The checker still takes recorded ordering commits as given (#943), so this change records them itself, as #913
did. Since #948 the policy lists an assessment's generator source as a planning artifact, so the record no longer
fails for a generated assessment.

After the implementation commits exist, and before the implementation PR merges, a separate commit records in
`ordering`:
- `assessment_commit`, the proposal commit;
- `earliest_governed_implementation_commit`, derived by walking the history forward from the proposal baseline;
- `final_technical_commit`.

`main` requires an up-to-date branch. A rebase of the implementation branch changes the hashes of the last two, so
the record is made again after any rebase, and the PR is checked for this before it merges. `tasks.md` names
branch commits by their titles, not their hashes.

### Decision 8: The tests must be able to fail

The tests run through the public binding and use the contract's example events, padded to an exact serialized
size. Each new test is shown to fail, in a disposable copy, against a planted defect, beside a null control that
stays green:

| Test | Planted defect |
|---|---|
| One byte over the limit, and well over it, is refused with zero probe, gate and handoff runs | the size check removed |
| Exactly the limit is delivered, with one probe, one gate run and one exchange | the comparison changed to refuse the limit itself |
| One byte over the limit is refused | the comparison changed to allow one byte more |
| Fewer characters than the limit but more UTF-8 bytes is refused | the string's length used in place of its byte count |
| An oversized `not_committed` occurrence is refused | the check applied only when the gate runs |
| An oversized occurrence that is also of the wrong class is refused as too large | the size check moved after the class check |
| A refused oversized occurrence, corrected and offered again under the same pair, is delivered | the key reserved before the size check |
| A settled pair offered again oversized is refused as too large | the size check moved after the duplicate check |
| An oversized string, which is not an occurrence object, is refused as too large | the size check moved after the class check |
| Every size test, built from the contract's `event_max_bytes` | the constant changed |
| The handoff, called directly, still returns `request_too_large` over the limit and not at it | the handoff's use of the constant changed |

Changing a test's own fixture is not a control.

## Risks / Trade-offs

- **[Risk] A host delivering oversized occurrences it built gets a new refusal.**
  - *Mitigation:* each one previously committed its business change and then failed with no durable record. The
    README migration entry names the code.
- **[Risk] A host with its own `HttpDeliveryHandoff` that accepts larger bodies can no longer deliver them.**
  - *Mitigation:* such an occurrence is over the contract's event size limit, and the collector would not admit
    it. The limit is the contract's, not the transport's.
- **[Trade-off] The refusal reads the event identifier from the caller's object, not from a snapshot.**
  - The snapshot is not built for an oversized input. The read is guarded and yields a string or the empty string,
    as it does for `occurrence_not_serializable`.
- **[Trade-off] The constant is tied to the contract by tests, not generated from it.**
  - A contract version that changes `event_max_bytes` fails those tests, and the constant is then edited by hand.
- **[Known limit] Other occurrences that can never become durable still commit first.** The binding checks size
  and serializability, not sdk-core's depth, array-length and string-length limits or schema validity. A host-built
  occurrence that the collector permanently rejects for one of those runs the gate and then fails as
  `audit_durability_failed_after_commit`. Checking them at admission means validating the whole occurrence, which
  #913 set aside as a separate governed choice. ADR-NODE-008 names this limit.
- **[Known limit] An input too large to serialize at all gets the other code.** When `JSON.stringify` itself
  fails on a huge input, admission reports `occurrence_not_serializable`, not `occurrence_too_large`. Both are
  refusals before the probe.
- **[Risk] A rebase leaves a stale ordering record.**
  - *Mitigation:* Decision 7 makes re-recording after a rebase a task, and the planted controls are run on the
    final record.

## Migration Plan

- **A host that delivers sdk-core-built occurrences:** the same results. sdk-core never returns an event over the
  limit.
- **A host that builds, copies or reloads occurrences:** an occurrence over 65,536 UTF-8 bytes is refused as
  `occurrence_too_large` before the commit gate, where it used to fail as `audit_durability_failed_after_commit`
  after it.
- **A host that switches exhaustively over `DeliveryClassRefusalCode`:** it handles the new code.

The change lands as separate PRs:
1. the proposal;
2. the implementation, including the ordering record;
3. the fold;
4. the archive.

Each is merged with a merge commit. Each says `Refs #945` and uses no closing keyword. After the archive merges,
the issue stays open for the owner.
