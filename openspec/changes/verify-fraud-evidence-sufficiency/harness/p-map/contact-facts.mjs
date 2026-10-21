import { isDeepStrictEqual } from "node:util";
import { sameIdentity } from "./snapshot.mjs";
import { captured } from "./evidence.mjs";

export function contactFacts(record, input) {
  const event = captured(record);
  if (event === undefined) return;
  record.signal = { resource_type: event.resource.type, actor_type: event.actor.type,
    change_categories: event.resource.change_categories, data_classification: event.data.classification,
    categories_preserved: isDeepStrictEqual(event.resource.change_categories, input.resource.change_categories) };
}

// Per-row aggregate owned by C5/enrolled, not another SDK invocation. Retain
// incompleteness locally; it must not void unrelated signal verdicts later.
export function replacementFacts(removed, enrolled) {
  const first = captured(removed);
  const second = captured(enrolled);
  if (first === undefined || second === undefined) return { complete: false };
  return { complete: true,
    shared_transaction_id: sameIdentity(first.correlation.transaction_id, second.correlation.transaction_id),
    shared_operation_id: sameIdentity(first.correlation.operation_id, second.correlation.operation_id),
    shared_correlation_id: sameIdentity(first.correlation.correlation_id, second.correlation.correlation_id),
    distinct_event_ids: !sameIdentity(first.event.id, second.event.id),
    enrolled_resource_type: second.resource.type,
    enrolled_credential_type: second.credential.type,
    distinct_factor_ids: !sameIdentity(first.resource.id, second.resource.id) };
}
