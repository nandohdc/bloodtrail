## Why

Issue #102 requires one governed, reusable conformance contract for delivery semantics so that any future transport implementation shares observable delivery behavior without pulling transport runtimes into the platform-neutral core. The four delivery classes are already frozen in the canonical contract at `delivery_class_contracts`; what is missing is the specification that turns those semantics into observable, testable, conformance-checkable requirements. Eleven downstream issues (#103-#109, #113, #126, and #112 by reference) consume this artifact and cannot be specified coherently until it exists.

## What Changes

- Add a new capability `delivery-conformance-contract` that specifies the common conformance contract for delivery semantics: attempt identity, acknowledgment, retry eligibility, ordering scope, queue capacity, backpressure response, shutdown deadlines, terminal failure behavior, and the boundary between platform-neutral semantics and transport-specific adapters.
- Define a nine-state delivery state model (`admitted`, `attempting`, `acknowledged`, `retryable`, `non_retryable`, `protocol_error`, `exhausted`, `rejected_overload`, `abandoned`) in which every state transition has a deterministic externally observable outcome.
- Provide canonical conformance scenarios covering retry, overflow/capacity, timeout, shutdown deadlines, validation rejection, and downstream failure, with one exact preconditioned scenario per normative point.
- Classify delivery guarantees per class exactly as the frozen rows do: `best_effort` at-most-once acceptable with bounded loss reporting; `security_significant` at-least-once after the required producer boundary accepts the occurrence; `transaction_critical` audit durability atomic with the successful business commit plus downstream at-least-once; `policy_critical` production blocked pending a reviewed policy. Add an explicit prohibition on exactly-once claims.
- Record compatibility requirements (every attempt carries the producer's single bound canonical contract version per the settled exact-one policy from #75) and observability requirements (separate safe operational signals per failure classification).
- Conform to — never redefine, extend, or weaken — the frozen `delivery_class_contracts` rows, using the contract's exact controlled vocabulary for class names, postures, durability, idempotency, retry, backpressure, shutdown, and outage language.
- Restate the boundary: this change is a specification only. It authorizes no code, no transport, queue, collector, or storage implementation, no production deployment, and no real-user processing.

## Capabilities

### New Capabilities

- `delivery-conformance-contract`: The platform-neutral observable delivery semantics every conforming delivery implementation must satisfy, derived exclusively from the frozen contract's `delivery_class_contracts` and its existing delivery-class statements in the `security-audit-event-contract` capability.

### Modified Capabilities

None.

## Impact

- Only `openspec/changes/specify-delivery-conformance-contract/**` changes (governed implementation paths). No `governance_core` paths are touched.
- No code, no `packages/*/src/` files, no package metadata, no contract source change, no generated artifacts, no dependencies, and no publication-path changes.
- The frozen contract and the SDK's existing transport-neutral sink boundary remain unchanged; the new capability sits above them as the conformance reference for future separately authorized delivery implementations.
- Downstream issues #103-#109, #112, #113, and #126 gain their normative reference; plan coverage PLAN-001, PLAN-003, and PLAN-051 is discharged at the specification level.
- Out of scope, restated: implementing HTTP transport, queues, collector validation, or storage; claiming exactly-once delivery; selecting a production deployment.
- Assurance limitation: a conformance specification does not prove that any adapter meets it.
