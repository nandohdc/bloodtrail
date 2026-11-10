# Design: Correct transaction-critical commit-state claims

Decision source: the owner, 2026-11-10, in the #913 triage grilling in Claude Code, accepting every recommended
option. The decisions and the agent brief are recorded at
https://github.com/nandohdc/bloodtrail/issues/913#issuecomment-6766470582. Where the brief left a choice to this
proposal, this design makes it and says so:
- the two refusal codes' names;
- the snapshot's form;
- the refusal of a value that is not an occurrence object;
- the order of the admission checks.

## Context

See `proposal.md` - Why.

`createTransactionCriticalDelivery(...).deliver(event, transactionId, commitGate)` admits an occurrence in one
synchronous step. That step checks the occurrence's catalog class and its transaction identifier, then whether the
pair is already settled or in flight. It then runs a fixed order:
1. the durability probe;
2. the business commit gate, unless the commit state is `not_committed`;
3. the durability handoff, which serializes the occurrence with `JSON.stringify`.

Every step reads the caller's object. After the gate and the handoff settle, the binding reads
`event.commit_state` again to choose the status. Only `partially_committed` and `compensated` have their own
branches. Every other value falls through to `committed_and_durable`.

On 2026-11-10, at `main` `1a365e7`, scratch scripts ran through the built binding's public entry. Each started from
the contract's committed `transaction_critical` example. The probe returned `true`, the gate returned `"committed"`
and the exchange acknowledged, except where a row says otherwise.

| Case | Result | Gate runs | Handed-off `commit_state` |
|---|---|---|---|
| `pending`, `unknown`, `not_started`, `not_applicable` | `committed_and_durable` | 1 | the same value |
| `commit_state` absent | `committed_and_durable` | 1 | absent |
| `partially_committed`, changed by the caller to `committed` during the exchange | `committed_and_durable` | 1 | `partially_committed` |
| `committed`, changed by the caller to `compensated` during the exchange | `compensated_and_durable` | 1 | `committed` |
| a BigInt or a cycle in the occurrence | `failed_closed` / `audit_durability_failed_after_commit` | 1 | nothing; no exchange was made |
| frozen `committed`, `partially_committed`, `compensated` | the documented status | 1 each | the same value |
| frozen `not_committed` | `durable_without_commit` | 0 | `not_committed` |

The BigInt and cycle row shows a related fault: a failure the binding could decide before the commit is reported
only after it. The handoff cannot serialize the occurrence, so it returns `request_serialization_failed` without an
exchange. The business change has already committed by then.

sdk-core's semantic validation refuses an absent commit state, or one outside the event's catalog entry, and it
deep-freezes every event it returns. Every row above therefore needs an occurrence that sdk-core did not build.

## Goals / Non-Goals

**Goals:**
- No commit claim for a commit state that the occurrence's own catalog entry does not allow.
- The reported status, the deduplication key and the durable bytes all describe the same occurrence: the one
  admitted.
- Every refusal that can be decided before the business commit is decided before it.
- Make the four live records that misstate the binding accurate, and test each fault so that the test can fail.

**Non-Goals:**
- The contract (frozen at 2.1.0), the catalog and sdk-core.
- The `best_effort` and `policy_critical` bindings. Neither makes a commit claim, and neither reads the
  occurrence again after the handoff.
- Shape validation beyond what admission reads. Admission reads only the event name, the event identifier, the
  commit state and the transaction identifier. Decision 2 covers a value that is not an occurrence object.
- A new status, or any change to #870's redelivery guidance.
- The handoff's size limit (see Risks).
- The assessment-ordering gap, #943.

## Decisions

### Decision 1: Admission refuses a commit state that the occurrence's own catalog entry does not allow

Admission reads the occurrence's catalog entry, which the class check already resolves. It refuses the occurrence
when its commit state is absent or is not in that entry's list of allowed commit states. The result is
`{ status: "refused", code: "commit_state_not_allowed", event_id }`, the same shape as the existing transaction
identifier refusal. The probe, the gate and the handoff do not run, and nothing is recorded or reserved.

The check is per event. `compensated` is allowed for `bloodtrail.audit.data.sensitive_resource.modified` and for
no other `transaction_critical` event, so it is refused for, for example,
`bloodtrail.audit.account.registration.completed`. That is the rule
sdk-core's semantic validation applies, and the binding reads the same list from sdk-core's exported catalog rather
than keeping a copy.

*Alternatives considered:*
- *Fail closed after the gate.* Rejected: the gate would already have run, so a business change could commit for an
  occurrence that can never carry a commit claim.
- *The union of every `transaction_critical` entry's list.* Rejected: it admits a commit state that the
  occurrence's own entry forbids, and sdk-core's rule is per event.
- *Report an unlisted state as `durable_without_commit`.* Rejected: it makes durable an occurrence the catalog
  forbids. And `pending` or `unknown` does not say the commit did not happen, which `durable_without_commit` is for.
- *Run sdk-core's full validation on every occurrence.* Rejected for this change: it would refuse occurrences that
  pass today for reasons #913 does not raise, and the other two bindings would need the same decision. It is
  a decision of its own, and this change makes no such proposal.

### Decision 2: One snapshot, taken first, is the JSON the handoff sends

The first thing admission does is snapshot the occurrence: `JSON.stringify`, then `JSON.parse`, then a deep freeze.
Every later step reads only the snapshot:
- the class check, the commit-state check and the transaction identifier check;
- the deduplication key;
- the occurrence handed to the durability point;
- the event identifier and status in the result.

Serialization is synchronous, so admission stays one step with no `await` between the duplicate check and the
reservation. Any getter or `toJSON` that runs during serialization finishes before that step.

An occurrence that cannot be serialized gets `{ status: "refused", code: "occurrence_not_serializable", event_id }`.
That covers a serialization that throws, such as a BigInt, a cycle or a throwing `toJSON`, and one that does not
return a string, such as `undefined` or a function. The probe, the gate and the handoff do not run.

The snapshot is plain JSON, so admission reads it with guarded property access that cannot throw. A snapshot that
is not an occurrence object, such as `null` or a number, has no event name, so it is refused as
`unknown_event_name`. Today such a value makes `deliver()` reject; afterwards no input does.

Every refusal reports its `event_id` through a guarded read that yields the empty string when the read throws or
does not give a string. For a serialization refusal the read is of the caller's object, and otherwise of the
snapshot. An admitted occurrence's identifier is used as it is today, in both the deduplication key and the
result. A fallback value there would let two distinct occurrences share one key. The snapshot can hold any JSON
value as that identifier, and a template literal throws on one that shadows `toString`. So the key is encoded as
JSON, which cannot throw on the snapshot's data and needs no separator.

*Why JSON rather than `structuredClone`:*
- **The snapshot is what the wire carries.** The handoff serializes with `JSON.stringify`. So the status and the
  bytes made durable come from the same value, and serializing the snapshot again gives the same bytes.
- **It catches the failures the handoff would hit.** `structuredClone` copies a BigInt and a cycle without
  complaint, and those would still reach the gate and fail after the commit. It also ignores `toJSON`, keeps a
  `Date` as an object, and throws on a function value that the wire would simply drop.

*Alternatives considered:*
- *Capture only the commit state, as #913 suggested.* Rejected: a caller's change during the probe or the gate
  would still reach the durable bytes, and the event identifier and deduplication key would still be read
  repeatedly.
- *Freeze the caller's object.* Rejected: it is a side effect on caller data, a getter on a frozen object still
  answers differently on each read, and it detects no serialization failure.

### Decision 3: Two new refusal codes widen `DeliveryClassRefusalCode` additively

`DeliveryClassRefusalCode` gains `commit_state_not_allowed` and `occurrence_not_serializable`. Both are returned as
`refused`, never as `failed_closed`, because each is decided before anything runs.

Two codes rather than one shared code: the requirement gives each failure a distinct outcome, and a host acts
differently on each. The first is a wrong claim in the occurrence; the second, an occurrence that can never become
durable. Reusing `delivery_class_mismatch` or `unknown_event_name` would misname the cause.

No export is added, removed or renamed, so `test:exports` stays at 19 value and 44 type-only exports. As #860 and
#869 did, `compatibility.json` records the widening as a new `freezeRecord.amendments` entry with unchanged counts,
leaving earlier entries byte-identical. ADR-NODE-007 records Decisions 1 to 5.

The union is shared by all three bindings, so a host that switches exhaustively over it gets a type error until it
handles the two codes. Only the `transaction_critical` binding returns them.

### Decision 4: One table, total over the catalog, maps commit state to outcome

A frozen table maps each commit state that some `transaction_critical` catalog entry allows to its outcome:

| Commit state | Gate | Status once acknowledged |
|---|---|---|
| `committed` | runs | `committed_and_durable` |
| `partially_committed` | runs | `partially_committed_and_durable` |
| `compensated` | runs | `compensated_and_durable` |
| `not_committed` | never runs | `durable_without_commit` |

The pipeline looks the snapshot's commit state up in the table once, after admission, and both the gate decision
and the status come from that entry. There is no default branch. A test walks every `transaction_critical`
catalog entry and asserts that the table covers each allowed commit state, so a catalog change cannot add a state
that falls through.

### Decision 5: The order of admission checks

Admission runs, and reports the first refusal it reaches:
1. the snapshot (`occurrence_not_serializable`);
2. the event name and class (`unknown_event_name`, `delivery_class_mismatch`);
3. the transaction identifier (`transaction_id_required`);
4. the commit state (`commit_state_not_allowed`);
5. the duplicate check and the reservation (`already_delivered`, `duplicate_transaction_delivery`), in one step.

Every occurrence refused today by the class or transaction identifier check gets the same code it gets today,
unless it also cannot be serialized.

The repeat of a settled or in-flight pair with a disallowed commit state is now refused as
`commit_state_not_allowed`. Today a settled repeat is reported `already_delivered`, and an in-flight one is refused
as `duplicate_transaction_delivery`. None of these outcomes runs the gate. The refusal is the accurate one: within a
binding instance, a pair settles only with an allowed commit state, so a repeat with a disallowed state is a
different occurrence carrying the same identifiers.

The canonical deduplication requirement says that "a repeat of the same pair SHALL be reported as already
delivered". The class and transaction identifier refusals already come before that check. The MODIFIED requirement
states that the new refusals come before it as well, so the two requirements agree.

### Decision 6: Where each statement lives

- **The binding's behaviour.** The `security-audit-sdk-node` requirement "Transaction-critical delivery orders
  durability after the business commit and fails closed before it", MODIFIED:
  - It gains the snapshot, the commit-state refusal, the serialization refusal, the order of these refusals
    before the duplicate check, and the explicit mapping.
  - Its scenario "Durability follows a successful commit" is qualified to a `committed` occurrence. As written,
    its WHEN clause and those of the #869 scenarios all match a `partially_committed` occurrence.
  - Its sentence "Each failure SHALL … record whether the commit gate was invoked" becomes "Each failure after
    admission", because a refusal has run neither the gate nor the durability point.
  - It gains five scenarios.

  Its other text and scenarios are unchanged.
- **Guidance.** The Node binding's README:
  - its transaction-critical table gets two refusal rows, and its committed row is qualified;
  - a sentence states the snapshot;
  - the migration section gains the #913 entries and a #869 warning: since #869, an equality check on
    `committed_and_durable` no longer matches a `partially_committed` or `compensated` occurrence.
- **Vocabulary.** The `CONTEXT.md` entry "Commit claim" names all three statuses that make one. Each makes it only
  for the commit state it names.
- **Records:**
  - ADR-NODE-007 records Decisions 1 to 5;
  - ADR-NODE-005's #869 known limit gets a one-line pointer to #896 and ADR-NODE-007;
  - `compatibility.json` gets a `freezeRecord` amendment.
- **Archived records stay as they are.** Archived OpenSpec changes are immutable, so these errors in
  `2026-10-26-correct-transaction-critical-partial-and-compensated-claims` are named here instead:
  - Its proposal says "Non-breaking extension", and its design says "a non-breaking union". Neither is true at
    runtime: an equality check on `committed_and_durable` stopped matching partial and compensated occurrences. The
    README warning above states this.
  - Its assessment says `authority_provenance` "trusts no caller claims". In fact the commit state is a caller
    claim at `deliver()`. After this change it is a checked claim, refused unless the catalog allows it.
  - The assessment did not precede the implementation. #896's assessment commit `3a8338f` descends from its
    implementation commit `d1a875e`, and #896's description says otherwise. The gate could not see this, because no
    assessment commit was recorded (#943).
  - Its proposal's Impact names `tests/delivery-classes.test.ts`, but its tests are in
    `transaction-critical-claims.test.ts`.

### Decision 7: This change records its own assessment ordering

Because of #943, this change does not rely on the gate to establish ordering. The assessment is committed in the
proposal PR, before any implementation. After the implementation commits exist, a separate commit records three
values in `ordering`:
- `assessment_commit`, the proposal commit;
- `earliest_governed_implementation_commit`, derived by walking the history forward from the proposal baseline,
  not chosen by hand;
- `final_technical_commit`.

That commit regenerates `assessment.json` and changes nothing else. The existing checker then verifies that the
assessment commit carries no implementation and is an ancestor of both commits. If a technical commit lands after
the record, for example a review or CI fix, the record is made again before the merge, so that
`final_technical_commit` names the head that was reviewed.

### Decision 8: The tests must be able to fail

The tests go in the transaction-critical claims tests and the class conformance tests. They run through the public
binding and use the contract's example events. Each new test is shown to fail, in a disposable copy, against a
planted defect:

| Test | Planted defect |
|---|---|
| Each of `pending`, `unknown`, `not_started`, `not_applicable` and an absent commit state is refused with zero probe, gate and handoff calls | the commit-state check removed, with the table defaulting to `committed_and_durable` |
| A commit state allowed only for another event is refused | the check replaced by the union of every `transaction_critical` entry's list |
| The table covers every allowed commit state, and each maps to its documented status and gate behaviour | one table entry removed |
| A caller's change during the probe, the gate and the exchange reaches neither the handed-off body nor the status | the pipeline reading the caller's object instead of the snapshot |
| An occurrence with a BigInt, and one with a cycle, is refused with zero gate runs, and `deliver()` resolves | the serialization check removed |
| `null` and a number are refused as `unknown_event_name`, and `deliver()` resolves | an unguarded read of the snapshot |
| An occurrence whose `event` getter throws is refused with an empty `event_id`, and `deliver()` resolves | an unguarded read of the caller's identifier |
| The occurrence handed off is frozen at every depth | a freeze of the top level only |
| A refused occurrence, corrected and offered again under the same pair, is delivered | the key reserved before the commit-state check |
| Each contract example's handed-off body equals `JSON.stringify` of the example | a snapshot that reorders keys |
| The probe, the gate and the handoff run in that order | the gate run before the probe |
| A duplicate pair runs no gate | the settled check moved after the gate |

The conformance arm's "delivered" predicate becomes "reached any durable status". It is shown to fail against a
binding that reports `failed_closed` for the class's own example. Changing a test's own fixture is not a control.

## Risks / Trade-offs

- **[Risk] A host delivering occurrences it built gets new refusals.**
  - *Mitigation:* each refused occurrence previously received a claim it should not have, or failed only after
    the business commit. The README migration entry names both codes.
- **[Trade-off] Every delivery serializes the occurrence twice: once for the snapshot, once in the handoff.**
  - *Mitigation:* the cost is one `JSON.stringify`, one `JSON.parse` and one deep freeze, against a network
    exchange. The snapshot runs before any size limit, so an oversized occurrence pays the full round trip and the
    handoff still refuses it, after the commit, as the next item describes. The second serialization stays in the
    frozen handoff interface, which takes an occurrence and not bytes.
- **[Out of scope] The handoff's size limit is checked only after the commit.** The handoff refuses a body above
  its limit as `request_too_large`, so an oversized occurrence runs the gate and fails as
  `audit_durability_failed_after_commit`. The binding cannot see that limit through the `HttpDeliveryHandoff`
  interface, so checking it before the gate is a separate decision. It needs an issue of its own, which the
  proposal PR asks the owner to file.
- **[Risk] Recording the ordering amends the assessment after implementation begins.**
  - *Mitigation:* the recording commit changes only `ordering`, and the PR shows the diff. The values it records
    are derived from history, and the checker verifies them.

## Migration Plan

- **A host that delivers sdk-core-built occurrences:** no runtime change. The type-level change below still applies.
- **A host that builds, copies or reloads occurrences:** it gets `commit_state_not_allowed` or
  `occurrence_not_serializable` where it used to get a claim, or a failure after the commit.
- **A host that switches exhaustively over `DeliveryClassRefusalCode`:** it handles the two new codes.

The change lands as separate PRs:
1. the proposal;
2. the implementation, including the ordering record;
3. the fold;
4. the archive, merged with a merge commit.

Each PR says `Refs #913` and uses no closing keyword. After the archive merges, the owner closes the issue by hand.
