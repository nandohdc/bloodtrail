# Proposal

## Why

The Node binding's `transaction_critical` delivery reports `committed_and_durable` for an occurrence whose commit state is `partially_committed` or `compensated` (#869). While the commit gate runs and the change is made durable, the result claims a full business commit for a change that was only partial or undone.

This over-claim is the exact analog of what #860 fixed for `not_committed` (P-E-3a). The catalog allows `partially_committed` on `account.registration.completed`, `data.sensitive_resource.modified`, `data.sensitive_resource.deleted`, and `security.configuration.changed`, and allows `compensated` on `data.sensitive_resource.modified`. The binding's own reported status should never exceed what the occurrence's commit state attests.

## What Changes

- **Qualified durable outcomes (#869)**: When an occurrence with `commit_state === "partially_committed"` or `commit_state === "compensated"` is delivered:
  - The business commit gate continues to run (as it does today).
  - Only when the gate commits (`"committed"`) and durability acknowledges, the pipeline reports `partially_committed_and_durable` or `compensated_and_durable` respectively, rather than `committed_and_durable`.
- **Deduplication**: Both `partially_committed_and_durable` and `compensated_and_durable` are settled durable outcomes and are recorded in the settled deduplication set for `(event.id, transactionId)` pair deduplication.
- **Result union widening**: Widens `TransactionCriticalDeliveryResult` with:
  - `{ readonly status: "partially_committed_and_durable"; readonly event_id: string; readonly transaction_id: string }`
  - `{ readonly status: "compensated_and_durable"; readonly event_id: string; readonly transaction_id: string }`
- **Frozen Node surface**: Follows established union-widening precedent without adding exports or bumping the package version.

## Capabilities

### Modified Capabilities
- `security-audit-sdk-node`: Amend "Transaction-critical delivery orders durability after the business commit and fails closed before it" so that `partially_committed` and `compensated` occurrences report qualified durability results (`partially_committed_and_durable` and `compensated_and_durable`) after a successful commit gate and acknowledged durability.

## Impact

- Affected code: `packages/security-audit-sdk-node/src/delivery-classes.ts` and `packages/security-audit-sdk-node/tests/delivery-classes.test.ts`.
- Public types: `TransactionCriticalDeliveryResult` union widened.
- Backward compatibility: Non-breaking extension for consumers handling the result; existing `committed_and_durable`, `durable_without_commit`, `already_delivered`, `refused`, and `failed_closed` variants remain unchanged for full commits, uncommitted occurrences, and failures.
