import { frozenSnapshot } from "../p-map/snapshot.mjs";
import { eventDouble } from "./p-map-lm-double-events.mjs";
import { contactEventDouble } from "./p-map-cx-double-events.mjs";

// Independent catalog scripts at base: contract.source.json:2902-2934,
// 3351-3385,3814-3855,3998-4036; events.ts:190-225. No validation logic.
const SHAPES = {
  attempt: { factory: eventDouble, kind: "mfa", overrides: {} },
  lock: { factory: contactEventDouble, kind: "contact", overrides: {} },
  unlock: { factory: contactEventDouble, kind: "contact", overrides: {} },
  configuration: { factory: contactEventDouble, kind: "configuration", overrides: {} },
  compensation: { factory: contactEventDouble, kind: "contact",
    overrides: { lifecycle_phase: "compensating", outcome: "partial", commit_state: "compensated" } },
  denial: { factory: eventDouble, kind: "mfa", method: "authorizationDenied",
    overrides: { name: "bloodtrail.audit.authorization.denied", category: "authorization",
      action: "evaluate_authorization", lifecycle_phase: "attempted", outcome: "denied" } },
};

export function lockEventDouble({ kind, input, ordinal }) {
  const shape = SHAPES[kind];
  const base = shape.factory({ kind: shape.kind, input, ordinal });
  const event = structuredClone(base.event);
  Object.assign(event.event, shape.overrides);
  if (input.event !== undefined) event.event.outcome_reason = input.event.outcome_reason;
  if (input.request !== undefined) event.correlation.request_id = input.request.id;
  return { method: shape.method ?? base.method, event: frozenSnapshot(event) };
}
