# Design: Exchange-outcome classification

## Context

See `proposal.md` for the problem identified by #750 and #747. The existing classifier already consumes exchange outcomes, not native transport conditions. ADR-NODE-003 gives the adapter native-condition mapping ownership; ADR-NODE-004 establishes one classification shared by the sink and handoff. The fetch adapter requirement explicitly distinguishes a deadline during body reading from other body-read errors. Its existing tests and the HTTP handoff tests exercise this distinction.

## Goals / Non-Goals

**Goal:** Make the shared requirement sufficient for another binding to preserve the exchange/outcome/classifier boundary, without requiring readers to infer that boundary from runtime code.

**Non-goals:** Change the exchange's mapping, retry scheduling, sink acceptance, public exports, or runtime behavior; fold the delta into the canonical capability or archive the change. #753 owns folding.

## Decisions

### Restate the classification over exchange outcomes

The exchange sends a request description and reports one response, timeout, or transport-failure outcome. It alone maps native conditions into that closed set. The classifier maps that outcome to a code once; the sink and handoff consume the same mapping. The sink then maps the code to accepted, rejected, or unknown without adding rules.

Use a MODIFIED delta to replace the two mixed-level list lines. The response clause requires the fully read body and exactly one accepted acknowledgment for the same event; any other 2xx response outcome is malformed. Leave the status clauses, sink mapping, unchanged-outcomes paragraph, and all four scenarios untouched. The timeout and transport-failure clause names outcomes only. A failed body read is not a response outcome to which the 2xx acknowledgment clause can apply; determining whether it is a timeout or transport failure remains the exchange's job.

### Glossary additions

Add these definitions under Sinks and Handoffs, preserving existing entries:

**Exchange**:
The code that sends a delivery handoff's request description to a peer and reports what happened as one exchange outcome.
_Avoid_: transport, request, call, delivery

**Exchange outcome**:
What an exchange reports for one attempt. It is exactly one of a response (a status plus the acknowledgments read from the body), a timeout, or a transport failure. Only the exchange decides which condition becomes which outcome.
_Avoid_: result, error, response

**Response classification**:
The single mapping from an exchange outcome to a classification code, shared by the HTTP audit sink and the delivery handoff. It never sees a native transport condition.
_Avoid_: status mapping, error mapping

These are domain concepts, not native APIs, file locations, or status-code algorithms.

## Design Pattern Assessment

The machine-readable assessment is authored in `assessment.source.json` and generated into `assessment.json`. This is a full assessment because a canonical capability requirement is being modified, even though runtime behavior is unchanged.

### Architectural forces

- A second binding must not confuse an incomplete-body read with a fully read malformed acknowledgment and suppress a retry.
- Only the exchange may map native conditions to response, timeout, or transport-failure outcomes.
- The HTTP audit sink and delivery handoff must share one classification without divergent local rules.
- Observable status, acknowledgment, timeout, transport-failure, and sink-result behavior must remain unchanged.
- The delta must replace mixed-level clauses while preserving scenarios, and leave canonical folding to #753.

### Selected approach and alternatives

**Direct outcome-level restatement (selected):** Replace only the mixed-level clauses and add domain glossary definitions. This answers the body-read ambiguity at the shared requirement's own boundary without modifying the exchange's owner requirement or duplicating runtime rules. No catalog pattern or new abstraction is selected.

**Keep native condition references (rejected):** Add body-read error examples alongside connection failures. This could clarify the immediate example, but would leak transport conditions into the classifier and give two requirements ownership of the native-condition mapping. It would still force every new binding to reconcile transport-specific lists.

**Move classification to the adapter (rejected):** Make the exchange decide acknowledgment and status codes as well as transport outcomes. This would localize all decisions but violate the shared-classification force: caller-owned exchanges, the handoff, and the sink could no longer rely on a single independent mapping. It also changes existing adapter ownership and behavior instead of clarifying it.

### Invariants and evidence

- **Outcome boundary:** Task 2.1's exact delta/list assertions require four outcome-level bullets with no native-condition rule; unchanged fetch-exchange and HTTP handoff tests in task 3.2 prove timeout and body-read transport-failure behavior.
- **Single unchanged classification:** Tasks 2.1 and 3.2 preserve status clauses, sink mappings and all scenarios, and rerun existing tests without modification.
- **Domain-only glossary:** Task 2.2's exact definition and Avoid-line assertions verify three unique entries while preserving all existing entries.
- **Bounded proposal-first scope:** Tasks 1.1 and 1.2 verify six proposal files, generated-assessment drift and the full assessment; task 3.3 checks ancestry and the exact eight-path range, with unchanged runtime, tests and canonical specification.

### Security and correctness implications

`security_sensitive` is false: this changes no security behavior, authority, trust crossing, acceptance logic, or retry implementation. It clarifies the already implemented audit-integrity and retry boundary so a future binding does not treat a failed read as a terminal malformed acknowledgment. All fifteen dimensions have change-specific negative justifications in the source assessment. Gates and this assessment confer no owner approval, publication, deployment, or activation authorization.

## Risks / Trade-offs

- **A response clause read without its outcome boundary** → State fully read body explicitly and define exchange outcome beside the sink and handoff; keep native-condition mapping solely in the adapter requirement.
- **A duplicated contradictory SHALL after folding** → Use one MODIFIED requirement, preserve the existing scenario headings exactly, and verify the supplied block and four-item list rather than append supplemental requirements.
- **Technical evidence mistaken for activation** → Keep the canonical capability untouched and the change active; folding is a separately governed follow-up in #753.

## Verification strategy

At proposal time, verify authored assessment shape, all security justifications, six-file inventory and task states with external assertions; run generated-assessment drift, assessment-generation regression tests and scoped assessment-phase governance. Run Node typecheck and existing tests with an empty staged index.

After the delta exists, task 3.1 runs strict OpenSpec validation and assessment drift checking. Task 3.2 reruns unchanged Node tests, including fetch-exchange and HTTP handoff body-read cases. Task 3.3 records explicit-base final governance and separate trusted-baseline/candidate dual-check verdicts, the prescribed active-change contract-reuse checks, merge-stage normative precedence, runtime gates and whitespace/scope checks. Evidence remains outside the repository. No new committed tests are needed: #747 identifies the existing body-read tests as the proof.

## Migration Plan

Commit proposal and full assessment first; introduce only the active delta, glossary and task ticks in the second commit. No runtime deployment or migration is needed. A reversal removes the active delta and glossary additions together; no runtime code must be reverted. Re-evaluate if a future binding changes native-condition mapping, classification codes, acknowledgment acceptance or retry semantics rather than preserving this boundary.
