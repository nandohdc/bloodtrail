# ADR-NODE-008: Oversized occurrences are refused before the commit

- Status: Accepted for SDK-node implementation
- Date: 2026-11-13
- Decision source: owner decision, 2026-11-13, answering the #945 triage questions in Claude Code and accepting
  each recommended option. The decisions are recorded at
  https://github.com/nandohdc/bloodtrail/issues/945#issuecomment-6843783279. The OpenSpec change
  `refuse-oversized-transaction-critical-occurrence` made the choices that record left open, and this ADR is
  accepted when that change merges.

## Context

ADR-NODE-007 made `transaction_critical` admission take one snapshot of the occurrence before the durability probe
runs, and left one case out of scope: the handoff's size limit was still checked only after the commit.

The binding runs the probe, then the commit gate, then the handoff. The handoff was the first step to measure the
occurrence. An occurrence over 65,536 UTF-8 bytes therefore ran the gate, and the handoff then refused it as
`request_too_large` without an exchange. The binding reported `failed_closed` /
`audit_durability_failed_after_commit`. The business change had committed, no audit record could become durable,
and the result did not say that size was the cause. A redelivery could not repair it.

A script run through the built binding's public entry on 2026-11-13, at `main` `c4bfa75`, confirmed it: an
occurrence of exactly 65,536 bytes was delivered, and one of 65,537 bytes ran the gate once, made no exchange and
failed after the commit.

sdk-core refuses an event over that limit when it builds one. So only an occurrence that sdk-core did not build
reaches this: one the host built itself, copied, or read back from storage.

The limit was written in three places: sdk-core, this package's handoff, and the collector. Only the collector's
value is generated from the contract's `bounds.event_max_bytes`.

## Decision

1. **Admission refuses an occurrence larger than the contract's event size limit.** Before the durability probe
   runs, `deliver()` refuses an occurrence whose JSON serialization is larger than 65,536 UTF-8 bytes, as `refused`
   / `occurrence_too_large`. The probe, the gate and the handoff do not run, and the pair is neither recorded nor
   reserved. The refusal applies to every commit state, `not_committed` included. An occurrence exactly at the
   limit is delivered.
2. **The size is measured once, on the snapshot's serialization, in UTF-8 bytes.** Admission measures the string it
   already produces for the snapshot, with the byte count the handoff uses. The handoff later serializes the
   snapshot into a body of the same size, so this package's own handoff does not refuse an admitted occurrence for
   its size.
3. **The size check comes right after the serialization check.** It runs before the snapshot is parsed and frozen,
   and before every other refusal. An oversized input that is also not an occurrence object, of another class, or
   carrying a commit state its entry does not allow is refused as too large. Because no snapshot exists yet, the
   refusal reads the event identifier from the caller's object through a guarded read, as
   `occurrence_not_serializable` does.
4. **One constant.** The limit stays declared in `http-handoff.ts`, as `EVENT_MAX_BYTES`, exported from that module
   and read by admission. It is not re-exported from the package entry. The tests build their sizes from the
   contract source's `bounds.event_max_bytes` and run through the public entry, so a value that differs from the
   contract's fails them.
5. **One new refusal code.** `occurrence_too_large` joins `DeliveryClassRefusalCode`. The handoff keeps
   `request_too_large` for a direct caller.

## Alternatives rejected

- **Keep the order and carry `request_too_large` in the failed-closed result.** The business change would still
  commit with no durable record. The owner rejected it in triage.
- **Ask the handoff, through a new method, whether it would accept the occurrence.** It changes a frozen interface
  that hosts implement, and the limit that matters is the contract's, not the injected handoff's.
- **Refuse only occurrences whose commit state runs the gate.** An oversized `not_committed` occurrence would still
  run the probe and fail at the handoff, with another code for the same cause.
- **Check the size after the cheaper field checks.** Those checks need the parsed snapshot, so the binding would
  parse and freeze an input of any size before refusing it.
- **Two literals compared by a test.** The owner decided on one source.
- **Generate the constant from the contract, as the collector does.** Not chosen now: it adds a generator and a
  drift gate to this package for one number. It stays open as a later change.
- **A test that imports the constant and compares it with the contract.** It would be the only test to import a
  module other than the public entry, and it would pass even if the handoff ignored the constant.

## Consequences

- An occurrence too large to become durable no longer lets a business change commit.
- A host that delivers oversized occurrences it built gets a refusal where it used to get a failure after the
  commit.
- A host with its own `HttpDeliveryHandoff` that accepts larger bodies can no longer deliver them through this
  binding. Such an occurrence is over the contract's event size limit, and the collector would not admit it.
- A contract version that changes `event_max_bytes` fails the size tests, and the constant is then edited by hand.

**Known limits:**
- The binding checks size and serializability only. It does not check sdk-core's depth, array-length and
  string-length limits, or schema validity. A host-built occurrence that the collector permanently rejects for one
  of those still runs the gate and then fails as `audit_durability_failed_after_commit`. Checking them at admission
  means validating the whole occurrence, which ADR-NODE-007 set aside as a separate governed choice.
- When `JSON.stringify` itself fails on a huge input, admission reports `occurrence_not_serializable`, not
  `occurrence_too_large`. Both are refusals before the probe.

## What changed in the surface

No export is added, removed or renamed. `npm run test:exports` stays at 19 value and 44 type-only exports.
`DeliveryClassRefusalCode` gains `occurrence_too_large`, and only the `transaction_critical` binding returns it.
`compatibility.json` records the widening as a `freezeRecord.amendments` entry with unchanged counts. A host that
switches exhaustively over the code gets a type error until it handles the new value. The README's migration note
lists it.

## Reversal

Reverting means:
- removing the size check from admission in `delivery-classes.ts`;
- removing the literal and the amendment;
- restoring the MODIFIED `security-audit-sdk-node` requirement.

Reverting lets an oversized occurrence commit its business change again before failing. Prefer correcting forward.
