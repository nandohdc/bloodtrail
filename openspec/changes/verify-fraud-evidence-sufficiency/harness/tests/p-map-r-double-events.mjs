import { frozenSnapshot } from "../p-map/snapshot.mjs";
import { eventDouble } from "./p-map-lm-double-events.mjs";
import { contactEventDouble } from "./p-map-cx-double-events.mjs";

// Independent public event shapes: contract.source.json:3182-3275,3407-3443,
// 3814-3855 at 8e6cdf7. These scripts never infer acceptance from inputs.
const SHAPES = {
  request: { factory: eventDouble, kind: "login", method: "passwordResetRequested",
    fields: { name: "bloodtrail.audit.account.password_reset.requested", category: "account", action: "request_password_reset", lifecycle_phase: "attempted" } },
  completion: { factory: eventDouble, kind: "logout", method: "passwordResetCompleted",
    fields: { name: "bloodtrail.audit.account.password_reset.completed", category: "account", action: "complete_password_reset" } },
  login: { factory: eventDouble, kind: "login", method: "authenticationSucceeded", fields: {} },
  rotation: { factory: contactEventDouble, kind: "contact", method: "sensitiveResourceModified", fields: {} },
  role: { factory: eventDouble, kind: "logout", method: "roleAssigned",
    fields: { name: "bloodtrail.audit.authorization.role.assigned", category: "authorization", action: "assign_role" } },
};

export function rotationEventDouble({ kind, input, ordinal }) {
  const shape = SHAPES[kind];
  const base = shape.factory({ kind: shape.kind, input, ordinal });
  const event = structuredClone(base.event);
  Object.assign(event.event, shape.fields);
  if (input.correlation !== undefined) Object.assign(event.correlation, input.correlation);
  if (input.request !== undefined) event.correlation.request_id = input.request.id;
  return { method: shape.method, event: frozenSnapshot(event) };
}
