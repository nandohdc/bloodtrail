# Delivery Policy

> GENERATED FROM contracts/security-audit/source/contract.source.json. DO NOT EDIT BY HAND.

| Class | Semantic | Durability | Idempotency | Retry | Backpressure | Shutdown | Outage | Business Posture |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best_effort | At-most-once acceptable with bounded loss reporting. | direct attempt or bounded memory buffer | unique event id; duplicates tolerated but not guaranteed | none or bounded retry | drop with bounded counter and health signal | no unbounded delay | health signal records loss estimate | fail_open |
| security_significant | At-least-once after required producer boundary accepts the occurrence. | durable or protected bounded queue in later implementation | same event id on retry; consumers dedupe | bounded retry with jitter and retry exhaustion alert | alert before silent loss | bounded flush or durable handoff | delay accounting and operator alert | normally fail_open unless event-specific policy strengthens |
| transaction_critical | Audit durability atomic with successful business commit; downstream at-least-once. | transactional outbox or equivalent behavior, product not selected | dedupe by event id and transaction id | persistent retry after commit | commit gate before durability point; backlog alert after commit | durable handoff required | defer downstream delivery from durable record | fail_closed before business commit if audit durability cannot be reached |
| policy_critical | Policy owner must approve exact fail-open, fail-closed, or deferred-completion behavior before production. | at least security-significant; may require transaction-critical semantics | same event id on retry with policy-specific reconciliation | policy-defined | policy-defined operator escalation | policy-defined durable handoff | production blocked until reviewed policy exists | blocked_pending_qualified_review |

Policy-critical production use remains blocked until exact fail-open, fail-closed, or deferred-completion policy is reviewed and approved.
