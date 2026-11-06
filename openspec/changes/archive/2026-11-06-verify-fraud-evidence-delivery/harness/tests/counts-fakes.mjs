// Counts-local evolution of chains-fakes' SDK/Node surface. The predecessor loads examples at module
// scope, so importing it would violate this probe's two-file package/contract loading boundary.
import { syntheticClock } from "../lib/clock.mjs";
import { countsCore, invalidBrand } from "./counts-fake-brands.mjs";
import { buildEvent, METHODS, validRedelivery } from "./counts-fake-events.mjs";
import { operationAuthority, refusal } from "./counts-fake-operations.mjs";
import { emitToFakeSink } from "./fake-sdk-common.mjs";
import {
  createBoundedDeliveryBackpressure, createBoundedDeliveryRetry, createDeliveryShutdown,
  createFetchHttpExchange, createHttpDeliveryHandoff, nodeTimers,
} from "./copies-fake-binding.mjs";

export { countsCore };

const deliver = (sink, event) => emitToFakeSink(sink, event, { includeCaughtError: true });

async function emitNamed({ method, input, authority, config }) {
  const operation = authority.check(input.operation, method);
  if (operation) return operation;
  const field = invalidBrand(input);
  if (field) return refusal("AUTHORITY_ESCALATION", `/${field}`, "authority");
  const built = buildEvent({ method, input, config });
  if (!built.ok) return built;
  return deliver(config.sink, built.value);
}

export function createCountsSdk(config) {
  const authority = operationAuthority(Object.keys(METHODS));
  return {
    beginOperation: authority.beginOperation,
    ...Object.fromEntries(Object.keys(METHODS).map((method) => [method, (input) => emitNamed({ method, input, authority, config })])),
    async redeliver(event) {
      const invalid = validRedelivery(event);
      if (invalid) return invalid;
      return deliver(config.sink, event);
    },
  };
}

export function fakeCountsNode() {
  return {
    nodeTimers, createFetchHttpExchange, createHttpDeliveryHandoff,
    createBoundedDeliveryRetry, createBoundedDeliveryBackpressure, createDeliveryShutdown,
    createNodeSecurityAuditSdk: createCountsSdk,
  };
}

export function testSenderSdk({ sdkNode, input, sink }) {
  return sdkNode.createNodeSecurityAuditSdk({
    contractVersion: input.contract_version, producer: { name: "stage-2-harness", version: "1.0.0" },
    service: { name: "stage-2-own-service", version: "1.0.0" }, environment: { name: "synthetic" },
    sink, clock: syntheticClock({ start: input.clock.start, stepMs: input.clock.step_ms }),
  });
}

export async function recordedCall({ ledger, label, invoke }) {
  ledger.take(label);
  return { label, ...await invoke() };
}
