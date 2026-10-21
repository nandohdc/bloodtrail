import { sha256 } from "../lib/io.mjs";
import { counterSnapshot, recordStep } from "./case-steps.mjs";
import { exchangeBoundary } from "./delivery.mjs";
import { acknowledgingExchange } from "./scripts.mjs";

// Implementer default (#803 open question): bare handoff only. Hash the stored
// text separately and compare to lib/observe's LIVE exchange hashes, never a
// locally projected request. No probe, gate, binding, network or retry loop.
export async function relayOutboxRow(state, setup) {
  const row = setup.host.outboxRows()[0];
  const storedHash = sha256(Buffer.from(row.body));
  const parsed = JSON.parse(row.body);
  const boundary = exchangeBoundary(state, acknowledgingExchange());
  const handoff = state.call("createHttpDeliveryHandoff", () => state.node.createHttpDeliveryHandoff({
    path: "/v1/security-audit", exchange: boundary.exchange,
  }));
  setup.counters = counterSnapshot({ target: setup.target, business: setup.business, boundary });
  const record = await recordStep(state, { id: "relay", target: setup.target, counters: setup.counters,
    run: () => state.method(handoff, "handoff", parsed, 0) });
  record.exchange_attempts = structuredClone(boundary.attempts);
  record.stored_body_sha256 = storedHash;
  record.round_trip = boundary.attempts.map((attempt) => ({
    live_body_matches_stored: attempt.body_sha256 === storedHash,
    event_id_matches_row: attempt.event_id === row.event_id,
    request_attempt: attempt.request_attempt,
  }));
  return record;
}
