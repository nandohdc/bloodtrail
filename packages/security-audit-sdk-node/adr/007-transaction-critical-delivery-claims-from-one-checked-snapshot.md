# ADR-NODE-007: Transaction-critical delivery claims from one checked snapshot

- Status: Accepted for SDK-node implementation
- Date: 2026-11-10
- Decision source: owner decision, 2026-11-10, in the #913 triage grilling in Claude Code, accepting every
  recommended option. The decisions are recorded at
  https://github.com/nandohdc/bloodtrail/issues/913#issuecomment-6766470582. The OpenSpec change
  `correct-transaction-critical-commit-state-claims` made the choices that record left open, and this ADR is
  accepted when that change merges.

## Context

ADR-NODE-005 and #896 (#869) made the `transaction_critical` binding claim a commit only for a commit state that
attests one. A post-merge review (#913) found two ways it still claimed more than the occurrence attests. A script
run against the built binding at `main` `1a365e7` confirmed both:

- **A fall-through to a full commit claim.** Only `partially_committed` and `compensated` had their own status.
  Every other commit state fell through to `committed_and_durable`, including `pending`, `unknown`, `not_started`,
  `not_applicable` and an absent one, each after one run of the commit gate.
- **A status read from the caller's object.** The binding read the commit state again after the gate and the
  handoff had settled. A caller that changed its object during the exchange got a status that disagreed with the
  bytes made durable.

Designing the fix exposed a third fault. An occurrence the handoff cannot serialize, such as one holding a BigInt
or a cycle, ran the gate and then failed as `audit_durability_failed_after_commit`, after the business change had
committed.

sdk-core refuses such commit states and freezes every event it builds. So only an occurrence that sdk-core did not
build reaches these faults: one the host built itself, copied, or read back from storage, as #870's redelivery does.

## Decision

1. **Admission refuses a commit state that the occurrence's own catalog entry does not allow.** Before the probe
   runs, an occurrence whose commit state is absent, or is not in its event's catalog list, is refused as the new
   `commit_state_not_allowed`. The list is the event's own, read from sdk-core's exported catalog, never the union
   of every `transaction_critical` entry. `compensated` is therefore refused for every event except
   `bloodtrail.audit.data.sensitive_resource.modified`.
2. **One snapshot, taken first, is the JSON the handoff sends.** Admission first takes the occurrence's JSON
   serialization, parses it back, and freezes the result at every depth. The admission checks, the deduplication
   key, the occurrence handed off and the result all read only that snapshot. An occurrence with no JSON
   serialization is refused as the new `occurrence_not_serializable`. A snapshot that is not an occurrence object,
   such as `null`, is refused as `unknown_event_name`, where `deliver()` used to reject. A refusal reports its
   identifier through a read that cannot throw, or the empty string.
3. **Two new refusal codes widen `DeliveryClassRefusalCode` additively.** Each is decided before anything runs, so
   each is `refused`, never `failed_closed`.
4. **One table, total over the catalog, maps commit state to outcome.** `committed`, `partially_committed` and
   `compensated` run the gate and report `committed_and_durable`, `partially_committed_and_durable` and
   `compensated_and_durable`. `not_committed` skips the gate and reports `durable_without_commit`. The table has no
   default entry, and a test walks every `transaction_critical` catalog entry to show that it covers each allowed
   commit state.
5. **The admission checks run in a fixed order:** the snapshot, then the event name and class, then the
   transaction identifier, then the commit state, and only then the duplicate check and the reservation, in one
   synchronous step. A refusal is never recorded or reserved, so the corrected occurrence can still be delivered
   under the same pair.

## Alternatives rejected

- **Fail closed after the gate.** The business change could then commit for an occurrence that can never carry a
  commit claim.
- **The union of every `transaction_critical` entry's list.** It admits a commit state that the occurrence's own
  entry forbids.
- **Report an unlisted state as `durable_without_commit`.** That makes durable an occurrence the catalog forbids,
  and `pending` or `unknown` does not say that nothing committed.
- **Run sdk-core's full validation in the binding.** It would refuse occurrences for reasons #913 does not raise,
  and the other two bindings would need the same decision.
- **Capture only the commit state, or freeze the caller's object.** A change during the probe or the gate would
  still reach the durable bytes. Freezing caller data is also a side effect, a getter still answers differently
  on each read, and neither detects an occurrence that cannot be serialized.
- **`structuredClone` rather than JSON.** It copies a BigInt and a cycle without complaint, so those would still
  fail only after the commit. It also ignores `toJSON`, which the wire honors.
- **One shared code, or reusing `delivery_class_mismatch` or `unknown_event_name`.** A wrong claim and an
  occurrence that can never become durable need different host actions, and a reused code would misname the
  cause.

## Consequences

- An occurrence built by sdk-core gets the same result as before. The handoff receives a frozen copy of it
  rather than the object passed to `deliver()`, so a host handoff that keys anything on object identity no longer
  matches.
- A host that delivers occurrences it built, copied or reloaded gets a refusal where it used to get a claim, or a
  failure after the commit.
- Every delivery serializes the occurrence twice, once for the snapshot and once in the handoff, whose interface
  takes an occurrence rather than bytes.
- The deduplication key is now a JSON array of the identifier's type, the identifier and the transaction
  identifier. The snapshot can carry any JSON value as an identifier, and a template literal would throw on one
  that shadows `toString`. The array form cannot throw, and it is unambiguous without a separator.
- The handoff's size limit is still checked only after the commit. That is a separate decision (#945).
  ADR-NODE-008 makes it: admission now refuses an oversized occurrence before the probe.

## What changed in the surface

No export is added, removed or renamed. `npm run test:exports` stays at 19 value and 44 type-only exports.
`DeliveryClassRefusalCode` gains `commit_state_not_allowed` and `occurrence_not_serializable`, and only the
`transaction_critical` binding returns them. `compatibility.json` records the widening as a
`freezeRecord.amendments` entry with unchanged counts. A host that switches exhaustively over the code gets a type
error until it handles the two new values. The README's migration note lists them.

## Reversal

Reverting means:
- restoring the previous admission and pipeline in `delivery-classes.ts`;
- removing the two literals and the amendment;
- restoring the MODIFIED `security-audit-sdk-node` requirement.

Reverting reopens the full commit claim for `pending` and `unknown`, which the requirement now forbids. Prefer
correcting forward.
