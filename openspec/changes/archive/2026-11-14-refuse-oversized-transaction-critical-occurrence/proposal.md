# Proposal

## Why

The Node binding's `transaction_critical` delivery runs the business commit gate for an occurrence that can never
become durable because it is too large (#945).

The binding runs the durability probe, then the commit gate, then the HTTP delivery handoff. The handoff serializes
the occurrence and only then compares the body with its 65,536-byte limit. An occurrence over that limit therefore
commits the business change first. The handoff then returns `non_retryable` / `request_too_large` without an
exchange, and the binding reports `failed_closed` / `audit_durability_failed_after_commit`. The business change has
committed, no audit record is durable, and the result does not say that size was the cause. A redelivery cannot
repair it, because the occurrence is still too large.

Measured on 2026-11-13 through the built binding's public entry, at `main` `c4bfa75`, which already holds #913's
implementation. The binding's source has not changed since:

| Serialized occurrence | `deliver()` result | Probe runs | Gate runs | Exchanges |
|---|---|---|---|---|
| 3,709 bytes (control) | `committed_and_durable` | 1 | 1 | 1 |
| 65,536 bytes (at the limit) | `committed_and_durable` | 1 | 1 | 1 |
| 65,537 bytes | `failed_closed` / `audit_durability_failed_after_commit`, `commitGateInvoked: true` | 1 | 1 | 0 |
| 73,700 bytes | `failed_closed` / `audit_durability_failed_after_commit`, `commitGateInvoked: true` | 1 | 1 | 0 |

sdk-core refuses an event over 65,536 bytes when it builds one, so only an occurrence that sdk-core did not build
reaches this: one the host built itself, copied, or read back from storage. That is the same reach as #913.

Since #913, admission already serializes the occurrence once, before the probe, to take its snapshot. It does not
measure that serialization. The limit itself is written three times: in sdk-core, in the Node binding's handoff and
in the collector. Only the collector's value is generated from the contract's `event_max_bytes`, and no test ties
the Node binding's value to it.

The owner settled the fix in the #945 triage
(https://github.com/nandohdc/bloodtrail/issues/945#issuecomment-6843783279).

## What Changes

- **Admission checks the size.** Before the durability probe runs, the binding refuses an occurrence whose JSON
  serialization is larger than the contract's event size limit, 65,536 bytes, counted in UTF-8. The refusal carries
  a new code, `occurrence_too_large`. The probe, the commit gate and the handoff do not run, and nothing is recorded
  or reserved for deduplication. An occurrence of exactly 65,536 bytes is still delivered.
- **Every commit state.** The refusal applies whatever the commit state is, including `not_committed`, which runs
  no commit gate. An oversized occurrence cannot become durable in either case.
- **Measured once, from the snapshot's serialization.** Admission measures the string it already produces for the
  snapshot, with the same byte count the handoff uses. The handoff serializes the snapshot again into a body of
  the same size, so an occurrence that passes admission is not refused by the Node binding's own handoff for its
  size.
- **One constant.** Admission and the handoff read one constant inside the Node binding. It is not exported from
  the package entry.
- **Tied to the contract.** The size tests read `event_max_bytes` from the contract source and build their
  occurrences from that number. They fail if admission or the handoff applies any other limit.
- **Order.** The size refusal is decided after the serialization refusal and before every other admission check.
  Like the other admission refusals, it is decided before the duplicate check.
- **Surface.** `DeliveryClassRefusalCode` gains one literal. No export is added, removed or renamed, so
  `test:exports` stays at 19 value and 44 type-only exports. `compatibility.json` records the widening as a
  `freezeRecord` amendment, and a new ADR-NODE-008 records the decision.
- **Records:**
  - the README's transaction-critical table gains a row for `occurrence_too_large`, and its migration section gains
    the new code;
  - ADR-NODE-007 lists this size case as out of scope, and gains a pointer to ADR-NODE-008.
- **Tests:**
  - an occurrence one byte over the limit and one well over it, each refused with zero probe, gate and handoff
    runs;
  - an occurrence of exactly the limit, delivered with one probe, one gate run and one exchange;
  - an occurrence with fewer characters than the limit but more UTF-8 bytes, refused;
  - an oversized `not_committed` occurrence, refused;
  - a refused oversized occurrence whose pair is delivered once corrected;
  - the place of the size refusal among the other refusals;
  - an oversized input that another refusal would also match, refused as too large;
  - the handoff's own `request_too_large` result for a direct caller, unchanged, and an exchange exactly at the
    limit;
  - every size above taken from the contract's `event_max_bytes`, not from a literal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`: "Transaction-critical delivery orders durability after the business commit and fails
  closed before it" gains the size refusal at admission, the statement that admission and the HTTP delivery handoff
  apply one limit equal to the contract's, the place of the size refusal among the other refusals, and four
  scenarios. Its other text and scenarios are unchanged.

## Impact

- **Code:** `packages/security-audit-sdk-node/src/delivery-classes.ts` and
  `packages/security-audit-sdk-node/src/http-handoff.ts`.
- **Tests:** the Node binding's transaction-critical claims tests and its handoff tests. The scope gate's null
  control pins how many platform references the binding's source makes, so its baseline moves if the count does.
- **Records:**
  - the Node binding's README and `compatibility.json`;
  - ADR-NODE-007, and a new ADR-NODE-008.
- **Hosts:**
  - A host that delivers sdk-core-built occurrences gets the same results, because sdk-core never returns an event
    over the limit.
  - A host that delivers an oversized occurrence now gets a refusal before its business change commits, where
    today the change commits and the delivery fails afterwards.
  - A host that switches exhaustively over `DeliveryClassRefusalCode` gets a type error until it handles the new
    code.
- **Out of scope:**
  - the contract, which is frozen at 2.1.0, the catalog and sdk-core, including exporting sdk-core's own limit;
  - the `best_effort` and `policy_critical` bindings, which run no commit gate;
  - the handoff's result codes and its interface, which still takes an occurrence and not bytes;
  - sdk-core's depth, array-length and string-length limits, and schema validity. The binding does not check
    them, so a host-built occurrence that the collector rejects for one of them still commits first and fails
    afterwards (see `design.md`, Risks);
  - generating the binding's constant from the contract, as the collector does;
  - the assessment-ordering trust gap (#943).
