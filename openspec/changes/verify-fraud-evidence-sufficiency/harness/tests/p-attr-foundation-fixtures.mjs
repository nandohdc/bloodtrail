import { occurrenceLedger } from "../lib/ledger.mjs";
import { createState } from "../p-attr/runtime.mjs";

// Offline public-shape doubles, never a validator or packed-code substitute.
// Defaults below were hand-read at the pinned base, independently of BASELINES.
export const FIXTURE_METHODS = [
  ["authenticationFailed", "authentication.failed", "failure", "completed", "execute"],
  ["authenticationSucceeded", "authentication.succeeded", "success", "completed", "execute"],
  ["passwordResetRequested", "account.password_reset.requested", "success", "attempted", "execute"],
  ["accountRegistrationAttempted", "account.registration.attempted", "success", "attempted", "create"],
];

export function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
}

function actor({ id }) {
  return { type: "authenticated_human", id, provenance: { trust_level: "authoritative_server", source: "configured-authority" } };
}

function eventFrom({ input, row }) {
  const [, name, outcome, lifecycle, operation] = row;
  const value = structuredClone(input);
  return deepFreeze({
    ...value,
    event: { ...value.event, name: `bloodtrail.audit.${name}`, outcome, lifecycle_phase: lifecycle,
      commit_state: "not_applicable", delivery_class: "security_significant" },
    resource: { operation_type: operation }, correlation: { request_id: input.request?.id },
  });
}

function fixtureSdk({ config, behavior }) {
  return Object.fromEntries(FIXTURE_METHODS.map((row) => [row[0], async (input) => {
    const result = await behavior({ config, input });
    if (result.ok) config.sink.events.push(eventFrom({ input, row }));
    return result;
  }]));
}

const CONSTRUCTORS = ["authoritativeTenant", "authenticationEvidence", "observedSource", "authenticatedPrincipal", "credentialReference", "sessionEvidence"];
const accept = async () => ({ ok: true, value: { status: "accepted" } });

export function fixtureState({ budget = 100, behavior = accept } = {}) {
  const core = Object.fromEntries(CONSTRUCTORS.map((name) => [name, (value) => deepFreeze(structuredClone(value))]));
  core.CONTRACT_VERSION = "2.1.0";
  core.anonymousActor = () => deepFreeze({ type: "anonymous", provenance: { trust_level: "client_claim", source: "request_boundary" } });
  core.authenticatedHumanActor = (input) => deepFreeze(actor(input));
  const testing = { createCapturingAuditSink: () => ({ events: [] }) };
  const node = { createNodeSecurityAuditSdk: (config) => fixtureSdk({ config, behavior }) };
  return createState({ core, node, testing, ledger: occurrenceLedger({ budget }) });
}
