## Context

See `proposal.md` for motivation. `SecurityAuditSdkImpl` decides whether a named operation completion is a terminal success before `buildNamedEvent` constructs canonical correlation data. `terminalSuccessAttemptEvent` currently observes only `input.correlation.retry_attempt` and inherited context values. The documented named API instead accepts `input.retry`, which `buildCorrelation` later projects to canonical `correlation.retry_attempt`.

The existing canonical requirement already distinguishes re-execution from pure redelivery and requires a positive retry to carry original-event identity. The change is an implementation correction, so `.openspec.yaml` declares `skip_specs: true`; no canonical requirement, contract, generated artifact, or public API is modified.

## Goals / Non-Goals

**Goals:**

- Let the existing pre-construction terminal-success decision recognize a positive safe-integer caller-supplied `input.retry.retry_attempt` no greater than the frozen contract 1.0.0 maximum.
- Preserve the stricter normal path: a completed operation still rejects a later terminal success with no positive retry relationship.
- Prove the behavior through the named SDK method and captured event output rather than a private helper test.
- Keep causality shape/content validation in the existing event-building and semantic-validation stages.

**Non-Goals:**

- Do not add automatic retries, redelivery behavior, sink retries, queues, buffers, transport, durability, or production integration.
- Do not reset or weaken operation completion authority, operation-handle identity, retention, or sink failure release behavior.
- Do not change the frozen 1.0.0 contract, generated projection, public method signatures, or compatibility policy.

## Decisions

### Recognize input retry before input correlation and inherited context

`terminalSuccessAttemptEvent` will extend its narrow untrusted input shape with `retry.retry_attempt`, then resolve the first available retry attempt in this order:

1. `input.retry.retry_attempt`;
2. `input.correlation.retry_attempt`;
3. active context correlation retry attempt;
4. authoritative context correlation retry attempt.

A positive safe integer no greater than the contract 1.0.0 `retry_attempt_max` (1000) retains the existing meaning: this named invocation is an explicit re-attempt and therefore does not reserve or reject through the completed-operation duplicate path. Missing, zero, negative, non-numeric, non-finite, non-integer, and over-bound values remain ordinary terminal attempts and are rejected through the completed-operation duplicate path. The later builder still constructs canonical correlation and the semantic validator still owns canonical causality validation.

**Alternative considered: build the full event before deciding terminal duplicate state.** Rejected because it would move identity allocation, timestamps, transformations, and validation before a rejection currently designed to happen at the operation boundary, changing more lifecycle behavior than this correction needs.

**Alternative considered: reset or replace completed operation state for a retry.** Rejected because the same operation retains its authority and completed normal success must remain protected; retry admission is a narrowly scoped classification decision, not an operation-state transition.

### Test the public named-method seam with one accepted completion and one retry

The new F-11 test will use the existing deterministic harness and exact operation handle. It will first receive an accepted terminal success, then invoke the same named method with an explicit `retry` relationship. It will assert a new emitted ID and preserved retry/original-operation links, then assert another non-retry success is rejected.

**Alternative considered: unit-test `terminalSuccessAttemptEvent` directly.** Rejected because it would couple the regression to a private helper and would not prove the builder's retry projection, operation authority, sink handoff, or post-retry normal duplicate behavior.

### Keep malformed retry handling in existing validators

The precheck only recognizes whether an attempt is positive. It will not validate `original_event_id`, `causation_id`, ranges, or identifier form. `buildCorrelation`, structural validation, and semantic causality validation remain the owners of those errors.

**Alternative considered: add validation in the precheck.** Rejected because it duplicates existing validation ownership and risks changing safe error ordering or disclosure.

## Risks / Trade-offs

- [A retry bypass accidentally admits an ordinary duplicate or malformed retry] → The regressions prove a third non-retry completion and zero, negative, non-numeric, non-finite, non-integer, and over-bound attempts remain `SDK_DUPLICATE_SUCCESS`; existing F-11 reservation tests remain in the focused suite.
- [Input retry and input correlation precedence changes a caller-visible result] → The explicit documented input retry is placed first, while the remaining existing fallback order is unchanged; focused tests cover the new precedence only.
- [The safe-integer classifier adds one standard-language global reference] → Update the platform-coupling null control from 110 to 111 authored references while retaining the same 16 authored artifacts and unchanged `[Buffer (2 sites)]` host-coupling inventory.
- [The change is mistaken for delivery retry] → Proposal, task, test, and PR wording state it is caller-supplied causality for a new named event and add no sink retry.
- [A policy or contract change is accidentally bundled] → Exact changed-path allowlist excludes contract source, generated output, package metadata, sink types, and `src/events.ts`.

## Migration Plan

1. Add and run the failing F-11 public behavior regression against the current implementation.
2. Add the narrow input-level retry read in `terminalSuccessAttemptEvent`.
3. Re-run the focused test and complete the package/contract/OpenSpec/governance verification matrix from an isolated candidate.
4. Commit proposal and technical implementation separately. Preserve the verified technical commit for exact-commit human review; do not merge, sign, or archive without later authorization.
5. Reverting the technical commit restores the prior precheck behavior; no persisted data or compatibility migration exists.
