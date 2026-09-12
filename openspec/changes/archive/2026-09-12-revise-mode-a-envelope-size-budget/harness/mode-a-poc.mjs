// Mode A proof of concept for issue #128.
//
// One synthetic workload, run twice over the real code: once with P1 interaction identifiers and
// once with only the evidence a server already records. It measures every metric and stop criterion
// in decisions/118-success-and-stop-criteria.md, attempts replay, claim substitution, correlation
// collision, and server-field fabrication, and prints a machine-readable report.
//
// Real components: @bloodtrail/client-evidence-browser builds every envelope, the collector's
// ClientEvidenceIngress and InteractionClaimMapper admit and map them, and the Core emits and
// validates every audit event. Nothing is deployed, transmitted, or persisted: the workload is
// generated in this file and lives in memory for the length of the run.
//
// Authorization: decisions/121-implementation-authorization.md. NON-PRODUCTION, synthetic only.
//
// Run from the repository root, after building the three packages:
//   node openspec/changes/add-client-evidence-capability/harness/mode-a-poc.mjs

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packages = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packages");
const browser = await import(resolve(packages, "client-evidence-browser/dist/index.js"));
const collector = await import(resolve(packages, "security-audit-collector/dist/index.js"));
const core = await import(resolve(packages, "security-audit-sdk-core/dist/index.js"));

// ---------------------------------------------------------------- workload shape
// Every number here is stated in the evidence. The mix deliberately includes the cases #118 calls
// the ones that make the question hard, and the trace-reuse and retry rates are the only knobs that
// could flatter P1, so they are reported with the result rather than tuned to it.
const WORKLOAD = Object.freeze({
  seed: 128,
  sessions: 140,
  interactionsPerSession: [7, 9],
  requestsPerInteraction: [1, 5],
  // A client that reuses one trace across several interactions, which real instrumentation does.
  traceReuseProbability: 0.35,
  // A repeated request inside one interaction.
  retryProbability: 0.15,
  // Milliseconds between the requests of one interaction, and between interaction starts.
  requestGapMs: [120, 1_800],
  interactionStartGapMs: [200, 2_500],
  sessionGapMs: 600_000,
});

const INTERACTION_KINDS = ["navigation", "form_submit", "button_click", "input", "dialog_action", "tab_switch", "refresh", "custom"];

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function populateRequestsForInteraction(interaction, start, ctx) {
  let at = start;
  const requestCount = ctx.between(WORKLOAD.requestsPerInteraction);
  for (let step = 0; step < requestCount; step += 1) {
    interaction.requests.push(pushRequest(ctx.requests, interaction, at));
    if (ctx.random() < WORKLOAD.retryProbability) {
      at += 40;
      interaction.requests.push(pushRequest(ctx.requests, interaction, at));
    }
    at += ctx.between(WORKLOAD.requestGapMs);
  }
  return at;
}

function generateSession(session, clock, ctx) {
  const sessionId = `session_${String(session).padStart(4, "0")}`;
  const stickyTrace = traceId(ctx.random);
  let start = clock;
  let maxAt = clock;
  const count = ctx.between(WORKLOAD.interactionsPerSession);
  for (let index = 0; index < count; index += 1) {
    const interaction = {
      key: `${sessionId}:${index}`,
      sessionId,
      kind: INTERACTION_KINDS[Math.floor(ctx.random() * INTERACTION_KINDS.length)],
      trace: ctx.random() < WORKLOAD.traceReuseProbability ? stickyTrace : traceId(ctx.random),
      requests: [],
    };
    const at = populateRequestsForInteraction(interaction, start, ctx);
    ctx.interactions.push(interaction);
    start += ctx.between(WORKLOAD.interactionStartGapMs);
    maxAt = Math.max(maxAt, at);
  }
  return maxAt + WORKLOAD.sessionGapMs;
}

function makeWorkload() {
  const random = seededRandom(WORKLOAD.seed);
  const between = ([low, high]) => low + Math.floor(random() * (high - low + 1));
  const interactions = [];
  const requests = [];
  const ctx = { random, between, interactions, requests };
  let clock = 1_780_000_000_000;

  for (let session = 0; session < WORKLOAD.sessions; session += 1) {
    clock = generateSession(session, clock, ctx);
  }
  // One session's requests interleave by time, exactly as concurrent interactions arrive.
  requests.sort((left, right) => (left.sessionId === right.sessionId ? left.at - right.at : 0));
  return { interactions, requests };
}

function pushRequest(requests, interaction, at) {
  const request = {
    id: `request_${String(requests.length + 1).padStart(6, "0")}`,
    sessionId: interaction.sessionId,
    interactionKey: interaction.key,
    kind: interaction.kind,
    trace: interaction.trace,
    at,
    first: interaction.requests.length === 0,
  };
  requests.push(request);
  return request.id;
}

function traceId(random) {
  let value = "";
  while (value.length < 32) value += Math.floor(random() * 16).toString(16);
  return value.slice(0, 32);
}

// ---------------------------------------------------------------- server under test
function nonceSource() {
  return () => randomBytes(32).toString("hex");
}

function auditSdk(captured) {
  return core.createSecurityAuditSdk({
    contractVersion: collector.SUPPORTED_CONTRACT_VERSIONS[0],
    producer: { name: "mode-a-poc-producer", version: "1.0.0" },
    service: { name: "mode-a-poc-service", version: "1.0.0" },
    environment: { name: "synthetic-poc" },
    sink: {
      async emit(event) {
        captured.push(event);
        return { status: "accepted" };
      },
    },
  });
}

async function emitAuditEvent(sdk, request, reference) {
  const input = {
    actor: core.authoritativeActor({ type: "authenticated_human", id: `actor_${request.sessionId}`, tenant_id: "tenant_poc" }),
    tenant: core.authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_poc", effective_tenant_id: "tenant_poc", resource_tenant_id: "tenant_poc" }),
    source: core.observedSource({ observed: { address: "203.0.113.10" } }),
    session: core.sessionEvidence({ id: request.sessionId }),
    request: { id: request.id },
    correlation: { correlation_id: request.id, operation_id: request.interactionKey, trace_id: request.trace },
  };
  const result = await sdk.accountRegistrationAttempted(reference === null ? input : { ...input, client_evidence: reference });
  assert.equal(result.ok, true, `audit emission failed: ${JSON.stringify(result.error ?? {})}`);
}

function mapInstrumentedRequest(request, ctx) {
  const outcome = request.first
    ? admitFirstRequest({
        ingress: ctx.ingress,
        nonces: ctx.nonces,
        mapper: ctx.mapper,
        request,
        identifiers: ctx.identifiers,
        envelopeBytes: ctx.envelopeBytes,
        validationMs: ctx.validationMs,
        inventoryViolations: ctx.inventoryViolations,
      })
    : ctx.mapper.recall(binding(request.sessionId), ctx.identifiers.get(request.interactionKey) ?? "");

  if (request.first) {
    ctx.stats.submitted += 1;
    if (outcome.kind !== "mapped") ctx.stats.rejected += 1;
  }
  return outcome.kind === "mapped" ? outcome.reference : null;
}

/**
 * Runs the whole workload. With `instrumented`, the first request of each interaction carries a
 * full envelope bound to a server-issued nonce and every later request carries the identifier
 * alone (#122); without it, the server records only what it already had.
 */
async function runArm(workload, instrumented) {
  const captured = [];
  const sdk = auditSdk(captured);
  let clock = 0;
  const nonces = new collector.InteractionNonceLedger({ source: nonceSource(), now: () => clock });
  const ingress = new collector.ClientEvidenceIngress({ nonces });
  const mapper = new collector.InteractionClaimMapper({ now: () => clock });
  const identifiers = new Map();
  const envelopeBytes = [];
  const validationMs = [];
  const inventoryViolations = [];
  const stats = { submitted: 0, rejected: 0 };
  const eventInteraction = new Map();
  const ctx = { ingress, nonces, mapper, identifiers, envelopeBytes, validationMs, inventoryViolations, stats };

  for (const request of workload.requests) {
    clock = request.at;
    const reference = instrumented ? mapInstrumentedRequest(request, ctx) : null;
    const before = captured.length;
    await emitAuditEvent(sdk, request, reference);
    const emitted = captured[before];
    eventInteraction.set(emitted.event.id, request.interactionKey);
  }

  return {
    captured,
    eventInteraction,
    envelopeBytes,
    validationMs,
    inventoryViolations,
    wellFormedSubmitted: stats.submitted,
    wellFormedRejected: stats.rejected,
    identifiers,
  };
}

function binding(sessionId) {
  return `binding:${sessionId}`;
}

// The envelope inventory #117 approved. Anything else present is a privacy stop (S-privacy-1).
const APPROVED_ENVELOPE_MEMBERS = new Set(["envelope_version", "interaction_id", "interaction_kind", "client_timestamp", "provenance", "nonce"]);

function admitFirstRequest({ ingress, nonces, mapper, request, identifiers, envelopeBytes, validationMs, inventoryViolations }) {
  const issued = nonces.issue(binding(request.sessionId));
  assert.equal(issued.kind, "issued", "the server must be able to issue a nonce");
  const interaction = browser.startInteraction(request.kind, { nonce: issued.nonce, timestamp: request.at });
  const serialized = interaction.serialize();
  envelopeBytes.push(Buffer.byteLength(serialized, "utf8"));
  for (const member of Object.keys(JSON.parse(serialized))) {
    if (!APPROVED_ENVELOPE_MEMBERS.has(member)) inventoryViolations.push(member);
  }
  const started = performance.now();
  const admitted = ingress.admit({ body: serialized, binding: binding(request.sessionId) });
  validationMs.push(performance.now() - started);
  if (admitted.kind !== "admitted") return admitted;
  identifiers.set(request.interactionKey, interaction.interactionId);
  return mapper.map(binding(request.sessionId), [admitted]);
}

// ---------------------------------------------------------------- grouping and accuracy
function groupsFrom(events, keyOf) {
  const groups = new Map();
  for (const event of events) {
    const key = keyOf(event);
    if (key === null) continue;
    const group = groups.get(key) ?? [];
    group.push(event.event.id);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** The fraction of ground-truth interactions some predicted group matches exactly. */
function accuracy(groups, truth) {
  const predicted = new Set(groups.map((group) => [...group].sort().join(",")));
  let exact = 0;
  for (const members of truth.values()) {
    if (predicted.has([...members].sort().join(","))) exact += 1;
  }
  return exact / truth.size;
}

function truthFrom(eventInteraction) {
  const truth = new Map();
  for (const [eventId, interactionKey] of eventInteraction) {
    const members = truth.get(interactionKey) ?? [];
    members.push(eventId);
    truth.set(interactionKey, members);
  }
  return truth;
}

/**
 * The best grouping the baseline can reach: session and trace, split wherever a gap exceeds a
 * threshold. The threshold is chosen by trying every candidate and keeping the best, which is more
 * than a real deployment could do — the comparison is deliberately generous to the baseline.
 */
function baselineAccuracy(events, truth) {
  const candidates = [0, 250, 500, 1_000, 2_000, 3_000, 5_000, 10_000, 30_000, Number.POSITIVE_INFINITY];
  let best = { threshold: null, accuracy: 0 };
  for (const threshold of candidates) {
    const groups = baselineGroups(events, threshold);
    const measured = accuracy(groups, truth);
    if (measured > best.accuracy) best = { threshold, accuracy: measured };
  }
  return best;
}

function baselineGroups(events, threshold) {
  const byTrace = new Map();
  for (const event of events) {
    const key = `${event.session.id}|${event.correlation.trace_id}`;
    const bucket = byTrace.get(key) ?? [];
    bucket.push(event);
    byTrace.set(key, bucket);
  }
  const groups = [];
  for (const bucket of byTrace.values()) {
    bucket.sort((left, right) => Date.parse(left.event.timestamp) - Date.parse(right.event.timestamp));
    let current = [];
    let previous = null;
    for (const event of bucket) {
      const at = Date.parse(event.event.timestamp);
      if (previous !== null && at - previous > threshold) {
        groups.push(current);
        current = [];
      }
      current.push(event.event.id);
      previous = at;
    }
    if (current.length > 0) groups.push(current);
  }
  return groups;
}

// ---------------------------------------------------------------- adversarial arms
function adversarialOutcomes() {
  let clock = 1_000;
  const nonces = new collector.InteractionNonceLedger({ source: nonceSource(), now: () => clock });
  const ingress = new collector.ClientEvidenceIngress({ nonces });
  const mapper = new collector.InteractionClaimMapper({ now: () => clock });
  const victim = binding("victim");
  const attacker = binding("attacker");
  const envelopeFor = (nonce, overrides = {}) => JSON.stringify({
    ...browser.buildClientEvidenceEnvelope({ interactionKind: "form_submit", nonce, timestamp: clock + 1_700_000_000_000 }),
    ...overrides,
  });

  const outcomes = {};
  const spent = nonces.issue(victim);
  const body = envelopeFor(spent.nonce);
  outcomes.first_submission = ingress.admit({ body, binding: victim }).kind;
  outcomes.replay_same_context = describe(ingress.admit({ body, binding: victim }));
  const substituted = nonces.issue(victim);
  outcomes.claim_substitution = describe(ingress.admit({ body: envelopeFor(substituted.nonce), binding: attacker }));
  outcomes.substituted_nonce_is_burned = describe(ingress.admit({ body: envelopeFor(substituted.nonce), binding: victim }));
  outcomes.forged_nonce = describe(ingress.admit({ body: envelopeFor("f".repeat(64)), binding: victim }));
  const forbidden = nonces.issue(victim);
  outcomes.server_field_fabrication = describe(ingress.admit({
    body: envelopeFor(forbidden.nonce, { claims: [{ name: "risk_score", trust_level: "client_claim", value: 99 }] }),
    binding: victim,
  }));
  const audit = nonces.issue(victim);
  outcomes.audit_member_fabrication = describe(ingress.admit({ body: envelopeFor(audit.nonce, { risk: { level: "low" } }), binding: victim }));
  const escalated = nonces.issue(victim);
  outcomes.trust_escalation = describe(ingress.admit({
    body: envelopeFor(escalated.nonce, { provenance: { source: "client_reported", trust_level: "authoritative_server", platform: "web_browser", capture_scope: "interaction_ephemeral" } }),
    binding: victim,
  }));
  outcomes.unknown_version = describe(ingress.admit({ body: envelopeFor(nonces.issue(victim).nonce, { envelope_version: 2 }), binding: victim }));
  outcomes.oversized = describe(ingress.admit({ body: "x".repeat(5_000), binding: victim }));
  outcomes.malformed = describe(ingress.admit({ body: "{", binding: victim }));
  outcomes.mapping_an_unadmitted_value = mapper.map(victim, [{ kind: "admitted", interactionId: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d", interactionKind: "form_submit", envelopeVersion: 1, platform: "web_browser" }]).reason;
  outcomes.recalling_an_unadmitted_identifier = mapper.recall(victim, "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d").reason;

  // A collision: two contexts present the same identifier. Each is an independent claim (#122),
  // and grouping keys include the server-authoritative session, so neither merges with the other.
  const collisionA = nonces.issue(victim);
  const collisionB = nonces.issue(attacker);
  const shared = browser.buildClientEvidenceEnvelope({ interactionKind: "input", nonce: collisionA.nonce, timestamp: clock + 1_700_000_000_000 });
  const admittedA = ingress.admit({ body: JSON.stringify(shared), binding: victim });
  const admittedB = ingress.admit({ body: JSON.stringify({ ...shared, nonce: collisionB.nonce }), binding: attacker });
  const mappedA = mapper.map(victim, [admittedA]);
  const mappedB = mapper.map(attacker, [admittedB]);
  outcomes.correlation_collision = mappedA.kind === "mapped" && mappedB.kind === "mapped"
    && mappedA.reference.interaction_id === mappedB.reference.interaction_id
    ? "both mapped as independent claims under their own context"
    : "unexpected";
  outcomes.conflicting_kind_for_one_interaction = describeMapping(mapper.map(victim, [ingress.admit({ body: JSON.stringify({ ...shared, interaction_kind: "refresh", nonce: nonces.issue(victim).nonce }), binding: victim })]));
  return outcomes;
}

function describe(result) {
  return result.kind === "rejected" ? `rejected:${result.rejectionClass}` : result.kind;
}

function describeMapping(mapping) {
  return mapping.kind === "mapped" ? "mapped" : `unmapped:${mapping.reason}`;
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

// ---------------------------------------------------------------- run
const workload = makeWorkload();
const instrumented = await runArm(workload, true);
const baseline = await runArm(workload, false);
const truth = truthFrom(instrumented.eventInteraction);

const p1Groups = groupsFrom(instrumented.captured, (event) =>
  event.client_evidence ? `${event.session.id}|${event.client_evidence.interaction_id}` : null);
const u1 = accuracy(p1Groups, truth);
const baselineBest = baselineAccuracy(baseline.captured, truthFrom(baseline.eventInteraction));
const linked = instrumented.captured.filter((event) => event.client_evidence !== undefined).length;
const distinctIdentifiers = new Set(instrumented.identifiers.values()).size;
const adversarial = adversarialOutcomes();

const metrics = {
  U1_grouping_accuracy: round(u1),
  U2_incremental_utility: round(u1 - baselineBest.accuracy),
  baseline_accuracy: round(baselineBest.accuracy),
  baseline_best_gap_threshold_ms: baselineBest.threshold,
  C1_coverage: round(linked / instrumented.captured.length),
  V1_rejection_completeness: round(rejectionCompleteness(adversarial)),
  V2_false_rejection: round(instrumented.wellFormedRejected / instrumented.wellFormedSubmitted),
  L1_envelope_bytes_max: Math.max(...instrumented.envelopeBytes),
  L1_envelope_bytes_p50: percentile(instrumented.envelopeBytes, 0.5),
  L2_validation_ms_p95: round(percentile(instrumented.validationMs, 0.95), 4),
  P1_inventory_violations: instrumented.inventoryViolations.length,
  P1_identifier_reuse: instrumented.identifiers.size - distinctIdentifiers,
};

function rejectionCompleteness(outcomes) {
  const mustReject = ["replay_same_context", "claim_substitution", "forged_nonce", "server_field_fabrication", "audit_member_fabrication", "trust_escalation", "unknown_version", "oversized", "malformed"];
  const rejected = mustReject.filter((name) => String(outcomes[name]).startsWith("rejected:"));
  return rejected.length / mustReject.length;
}

function round(value, digits = 4) {
  return Number.parseFloat(value.toFixed(digits));
}

const thresholds = {
  U1: metrics.U1_grouping_accuracy >= 0.99,
  U2: metrics.U2_incremental_utility >= 0.1,
  C1: metrics.C1_coverage >= 0.95,
  V1: metrics.V1_rejection_completeness === 1,
  V2: metrics.V2_false_rejection <= 0.001,
  L1: metrics.L1_envelope_bytes_max <= 384, // Revised under #498
  L2: metrics.L2_validation_ms_p95 <= 1,
  "P1-inv": metrics.P1_inventory_violations === 0,
  "P1-link": metrics.P1_identifier_reuse === 0,
};
const unmet = Object.entries(thresholds).filter(([, met]) => !met).map(([name]) => name);
// A stop criterion ends the wave; an unmet success metric that is not a stop is a REVISE.
const stops = [];
if (!thresholds.U2) stops.push("S-utility-1");
if (!thresholds.U1) stops.push("S-utility-2");
if (!thresholds["P1-inv"]) stops.push("S-privacy-1");
if (!thresholds["P1-link"]) stops.push("S-privacy-2");
if (!thresholds.V1) stops.push("S-abuse-2");
const recommendation = stops.length > 0 ? "NO-GO" : unmet.length > 0 ? "REVISE" : "GO";

console.log(JSON.stringify({
  workload: {
    ...WORKLOAD,
    interactions: workload.interactions.length,
    requests: workload.requests.length,
    events_per_arm: instrumented.captured.length,
    reused_trace_interactions: workload.interactions.length - new Set(workload.interactions.map((item) => `${item.sessionId}|${item.trace}`)).size,
  },
  metrics,
  thresholds,
  unmet,
  adversarial,
  stops,
  recommendation,
}, null, 2));
process.exitCode = metrics.V1_rejection_completeness === 1 && metrics.P1_inventory_violations === 0 ? 0 : 1;
