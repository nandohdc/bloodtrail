// Boundary-1 call facts, extracted from the actual argument BEFORE invocation.
// Never serialize the live handle/SDK. Runtime identifiers are observations;
// expectations compare their equality to the retained prior occurrence.
export function emissionFacts({ method, argument }) {
  if (method === "redeliver") return { method, redelivery_event_id: argument.event.id,
    redelivery_frozen: Object.isFrozen(argument) };
  const facts = { method, handle_state_at_call: argument.operation.state };
  if (argument.retry !== undefined) facts.retry = structuredClone(argument.retry);
  if (argument.event !== undefined) facts.event = structuredClone(argument.event);
  if (argument.redelivery !== undefined) {
    facts.redelivery_event_id = argument.redelivery.event.event.id;
    facts.redelivery_frozen = Object.isFrozen(argument.redelivery.event);
  }
  return facts;
}
