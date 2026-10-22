import { asFixtureState } from "./p-attr-as-fixtures.mjs";
import { deliverFixture, hookRefusal } from "./p-attr-af-fixtures.mjs";
import { memoryKeying } from "../p-attr/keying.mjs";
import { requestWorkload } from "../p-attr/carrier-workload.mjs";
import { linkageWorkload } from "../p-attr/linkage-workload.mjs";

// Offline public-shape scripts, NOT a package validator or conformance evidence.
// Independently read at cc4fdf5: catalog:1-60,457-511; semantic:371-405;
// events:177-227,238-253,287-352,383-416; schema:8-17,94-104,123-129,146-153.
export const REQUEST_FAMILIES = [
  { family: "PR", method: "passwordResetRequested", purpose: "password_reset_requested", name: "account.password_reset.requested", operation: "execute", route: "/password-reset", address: "203.0.113.11", port: 51001 },
  { family: "RA", method: "accountRegistrationAttempted", purpose: "account_registration_attempted", name: "account.registration.attempted", operation: "create", route: "/register", address: "203.0.113.12", port: 51002 },
];
const REFUSALS = [
  [(event) => event.tenant === undefined, { code: "MISSING_TENANT_CONTEXT", category: "validation", path: "/tenant" }],
  [(event) => event.actor.type !== "anonymous" && event.actor.provenance.trust_level === "client_claim", { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" }],
  [(event) => event.actor.type === "anonymous" && event.authenticated_principal !== undefined, { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" }],
  [(event) => event.tenant.scope === "tenant" && event.tenant.claimed_tenant_id !== undefined && event.tenant.claimed_tenant_id !== event.tenant.effective_tenant_id, { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/claimed_tenant_id" }],
];

function eventFrom({ input, row }) {
  const event = structuredClone(input);
  if (event.tenant !== undefined) Object.assign(event.tenant, event.claimedTenant);
  delete event.claimedTenant;
  event.event = { name: `bloodtrail.audit.${row.name}`, outcome: "success", lifecycle_phase: "attempted", commit_state: "not_applicable", delivery_class: "security_significant" };
  event.resource = { ...event.resource, operation_type: row.operation };
  event.correlation = { request_id: event.request.id };
  return event;
}

function diagnosticFor({ event, config, row }) {
  const diagnostic = hookRefusal({ event, config, purpose: row.purpose });
  if (diagnostic !== undefined) return diagnostic;
  return REFUSALS.find(([matches]) => matches(event))?.[1];
}

function emit({ config, input, row, mutate }) {
  const event = eventFrom({ input, row });
  const diagnostic = diagnosticFor({ event, config, row });
  return deliverFixture({ config, event, diagnostic, mutate });
}

export function requestFixtureState(options = {}) {
  const { mutate = () => {} } = options;
  const state = asFixtureState(options);
  const create = state.node.createNodeSecurityAuditSdk;
  state.node.createNodeSecurityAuditSdk = (config) => ({ ...create(config),
    ...Object.fromEntries(REQUEST_FAMILIES.map((row) => [row.method, async (input) => emit({ config, input, row, mutate })])),
  });
  return state;
}

export async function requestFixtures({ family, ...options }) {
  const state = requestFixtureState(options);
  await requestWorkload({ family, state, keying: memoryKeying() });
  return state;
}

// Hand-counted, NOT derived from descriptors. Three baseline constructors plus
// sink + Node factory + named call =6. Replaced contexts are still counted.
export const REQUEST_COUNTS = [
  ["B", "ex:6 nx:6"], ["C1", "ex:7 nx:7"], ["C2", "ex:8 nx:8"],
  ["C3", "ex:7 nx:7"], ["C4", "ex:7 nx:7"],
  ["C5", "subject-ex:7 subject-nx:6 resource-ex:7 resource-nx:6"],
  ["CR", "ex:7 nx:7"], ["C6", "ex:7 nx:7"], ["C6s", "ex:8 nx:7"],
  ["C7", "ex:7 nx:7"], ["C7a", "ex:7 nx:7"], ["C7b", "ex:8 nx:8"],
  ["C8", "ex:7 nx:7"], ["C9", "ex:7 nx:7"], ["X2", "ex:8 nx:8"],
];

export async function linkageFixture(options = {}) {
  const state = requestFixtureState({ budget: 5000, ...options });
  await linkageWorkload({ state, keying: memoryKeying() });
  return state;
}
export function rowAt(rows, from) { return rows.find((row) => row.from === from); }
export function rowAtTo(rows, to) { return rows.find((row) => row.to === to); }
export function linkedRecord(records, id) { return records.find((record) => record.step_id === id); }
// Hand-written #802 corrected L1 predictions; NOT imported from descriptors.
// cc4fdf5: events:98-131; semantic:371-434; catalog:177-227;
// field-policy:313-341,373-401,493-521; spec:90-104.
// [dataset, ex linkage numerator, ex target count, nx target count, calls]
export const L1_TABLE = [
  ["AF-B/main", 0, 0, 0, 32], ["AF-C0t/main", 0, 0, 0, 38],
  ["AF-C1/main", 0, 15, 15, 38], ["AF-C2/main", 0, 15, 15, 68], ["AF-C2/absent", 0, 0, 0, 32],
  ["AF-C3/main", 0, 15, 15, 38], ["AF-C3s/main", 0, 15, 15, 38], ["AF-C4/main", 0, 15, 15, 38],
  ["AF-C5/main", 15, 15, 0, 35], ["AF-CR/main", 0, 15, 15, 38], ["AF-CR/credential-type", 0, 15, 15, 38],
  ["AF-C6/main", 0, 15, 15, 38], ["AF-C6s/main", 15, 15, 15, 41],
  ["AF-C7/main", 0, 0, 0, 38], ["AF-C7b/equal-claim", 0, 0, 0, 44],
  ["AF-X1/main", 0, 15, 15, 38], ["AF-X2/main", 0, 15, 15, 38], ["AF-X3/main", 0, 0, 0, 38],
  ["AF-X4/main", 15, 15, 0, 38], ["AF-F1/id", 0, 15, 15, 32], ["AF-F1/route", 0, 15, 15, 32],
  ["AF-F2/main", 0, 15, 15, 38], ["AF-F3/main", 0, 15, 15, 38], ["AF-C0r/main", 0, 0, 0, 38], ["AF-F4/main", 0, 15, 15, 32],
];
export const L2_TABLE = [["AS-C3/main", 15], ["AS-C4/main", 15], ["AS-CR/main", 15], ["AS-C6/main", 15],
  ["AS-X2/main", 15], ["AS-C2/keyed-mirror", 0], ["AS-C2/main", 0]];
export const OTHER_COUNTS = [["AS-B/main", 5], ["AS-C3/main", 8], ["AS-C4/main", 8], ["AS-CR/main", 8],
  ["AS-C6/main", 8], ["AS-X2/main", 8], ["AS-C2/main", 11], ["AS-C2/honest-control", 8], ["AS-C2/keyed-mirror", 11],
  ["PR-C5/subject", 11], ["PR-C5/resource", 11], ["RA-C5/subject", 11], ["RA-C5/resource", 11]];
