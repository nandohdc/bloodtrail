import { createSecurityAuditSdk, type AuditEventSink, type EventName, type SecurityAuditEvent } from "../../src/index.js";

const sink: AuditEventSink = { async emit() { return { status: "accepted" }; } };
createSecurityAuditSdk({
  contractVersion: "1.0.0",
  producer: { name: "producer" },
  service: { name: "service" },
  environment: { name: "test" },
  sink,
});
const known: EventName = "bloodtrail.audit.authentication.succeeded";
void known;
// @ts-expect-error unsupported contract versions must not type-check
createSecurityAuditSdk({ contractVersion: "2.0.0", producer: { name: "p" }, service: { name: "s" }, environment: { name: "e" }, sink });
// @ts-expect-error arbitrary event names must not type-check
const unknownName: EventName = "example.arbitrary";
void unknownName;

const acceptedTenant: SecurityAuditEvent["tenant"] = { scope: "tenant" };
void acceptedTenant;
// @ts-expect-error generated controlled tenant scopes reject unknown values
const badTenant: SecurityAuditEvent["tenant"] = { scope: "caller_claimed" };
void badTenant;
// @ts-expect-error generated event type preserves required top-level fields
const missingRequiredFields: SecurityAuditEvent = {};
void missingRequiredFields;
// @ts-expect-error generated extension type rejects unregistered namespaces
const badExtensions: NonNullable<SecurityAuditEvent["extensions"]> = { "bloodtrail.audit.unregistered.v1": {} };
void badExtensions;
