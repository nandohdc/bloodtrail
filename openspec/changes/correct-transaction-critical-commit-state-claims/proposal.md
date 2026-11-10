# Proposal

## Why

The Node binding's `transaction_critical` delivery can still claim more than an occurrence attests (#913, a
post-merge review of #896). On 2026-11-10 a script ran against the built binding at `main` `1a365e7`, and it showed
two defects:

- **A fall-through to a full commit claim.** `deliver()` maps `partially_committed` and `compensated` to their own
  statuses and every other commit state to `committed_and_durable`. An occurrence whose commit state is `pending`,
  `unknown`, `not_started` or `not_applicable`, or is absent, runs the commit gate once and is reported committed and
  durable.
- **A status read from the caller's object, not from what became durable.** The binding reads the commit state again
  after the gate and the handoff have settled. A caller that changes a non-frozen occurrence during the exchange
  gets a status that disagrees with the durable bytes. A record made durable as `partially_committed` can be
  reported `committed_and_durable`.

sdk-core refuses such commit states when it builds an event, and it freezes every event it returns. So only an
occurrence that sdk-core did not build reaches either defect: one the host built itself, copied, or read back from
storage. The redelivery route that #870 documented relays occurrences from the host's own store, which is one such
path.

The owner settled the fix in the #913 triage
(https://github.com/nandohdc/bloodtrail/issues/913#issuecomment-6766470582).

## What Changes

- **Admission checks the commit state.** Before the durability probe runs, the binding refuses an occurrence whose
  commit state is absent or is not one that the occurrence's own catalog entry allows. The refusal carries a new
  code, `commit_state_not_allowed`. The probe, the commit gate and the handoff do not run, and nothing is recorded
  for deduplication.
- **One table from commit state to status.** `committed` maps to `committed_and_durable`, `partially_committed` to
  `partially_committed_and_durable`, `compensated` to `compensated_and_durable`, and `not_committed` to
  `durable_without_commit` with no gate run. No commit state reaches a commit claim by default.
- **One snapshot.** At admission the binding takes one snapshot of the occurrence: its JSON serialization, parsed
  back and deeply frozen. Every later step reads only the snapshot: the admission checks, the deduplication key,
  the bytes handed off and the reported status. An occurrence that cannot be serialized is refused before the
  probe with a second new code, `occurrence_not_serializable`. Today such an occurrence runs the gate and then
  fails as `audit_durability_failed_after_commit`, after the business change has committed. A value that is not an
  occurrence object, such as `null`, is refused as `unknown_event_name`, where today it makes `deliver()` reject.
- **Refusals come first.** These refusals, like the transaction identifier refusal, are decided before the
  duplicate check, so a refused repeat of a settled or in-flight pair is refused, not reported delivered.
- **Surface.** `DeliveryClassRefusalCode` gains the two literals. No export is added, removed or renamed, so
  `test:exports` stays at 19 value and 44 type-only exports. `compatibility.json` records the widening as a
  `freezeRecord` amendment, and the new ADR-NODE-007 records the decision.
- **Records corrected:**
  - the canonical scenario "Durability follows a successful commit", qualified to an occurrence whose commit state
    is `committed`;
  - ADR-NODE-005's #869 known limit, pointed at #896 and ADR-NODE-007;
  - the "Commit claim" entry in the Node binding's `CONTEXT.md`, which names only `committed_and_durable`;
  - the README's transaction-critical table, whose row says "commit state is `committed`" although the code does
    not check it. The README's migration section gains the #913 values and a warning that, since #869, an equality
    check on `committed_and_durable` no longer matches partial or compensated occurrences.
- **Tests:**
  - every commit state outside an event's catalog entry, including absent ones, and one allowed only for another
    event;
  - the mapping, which must cover every commit state that any `transaction_critical` catalog entry allows;
  - the order probe → gate → handoff;
  - a caller's change during the probe, the gate and the exchange;
  - an occurrence that cannot be serialized, a value that is not an occurrence object, and an identifier that
    cannot be read;
  - a snapshot frozen at every depth, and handed-off bodies byte-identical to today's for the contract examples;
  - a refused occurrence whose pair stays deliverable once corrected;
  - a duplicate pair that runs no gate;
  - a contract-row conformance arm that counts every durable status as delivered.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: "Transaction-critical delivery orders durability after the business commit and fails
  closed before it" gains the snapshot, the commit-state admission check, the order of the refusals before the
  duplicate check, and the explicit mapping. Two existing statements are qualified:
  - the scenario "Durability follows a successful commit", to an occurrence whose commit state is `committed`;
  - the sentence on what each failure records, to failures after admission.

  It gains five scenarios. Its other text and scenarios are unchanged.

## Impact

- **Code:** `packages/security-audit-sdk-node/src/delivery-classes.ts`.
- **Tests:** the Node binding's transaction-critical claims tests, and its class conformance tests. The scope
  gate's null control pins how many platform references the binding's source makes. The snapshot adds the `JSON`
  language global, which raises that count from 90 to 91 with no host coupling, so its baseline moves too.
- **Records:**
  - the Node binding's README, `CONTEXT.md` and `compatibility.json`;
  - ADR-NODE-005, and a new ADR-NODE-007.
- **Hosts:**
  - A host that delivers sdk-core-built occurrences sees no runtime change.
  - A host that delivers an occurrence with an unlisted or absent commit state now gets a refusal, not a commit
    claim.
  - A host that switches exhaustively over `DeliveryClassRefusalCode` gets a type error until it handles the two
    new codes.
- **Out of scope:**
  - the contract, which is frozen at 2.1.0, the catalog and sdk-core;
  - the `best_effort` and `policy_critical` bindings, which make no commit claim;
  - new statuses, and any change to #870's redelivery guidance;
  - editing archived OpenSpec changes, whose errors `design.md` names instead;
  - the assessment-ordering gap (#943);
  - a request that exceeds the handoff's size limit, which also fails only after the commit (see `design.md`).
