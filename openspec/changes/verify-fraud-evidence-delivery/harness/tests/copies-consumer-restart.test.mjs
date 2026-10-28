// Verification tests for consumer-restart phase logic (#839, Q130, Q144, Q146, Q153, Q155, Q156, Q159, Q161, Q162, Q170, Q171, Q175, Q177, Q180, Q184, Q185).
import assert from "node:assert/strict";
import { test } from "node:test";
import { faultInjector, scheduledFaultPlan } from "../lib/faults.mjs";
import { readBack, startIngress } from "../lib/ingress.mjs";
import { jsonFile } from "../lib/io.mjs";
import { checkShutdownExchangesMatch, consumerRestartObserver } from "../copies/evaluate.mjs";
import { runConsumerRestart } from "../copies/consumer-restart.mjs";
import { makeFencedSdkNode, senderFactories } from "../copies/sender-phases.mjs";
import { fakeSdkNode, recordedCall, testSenderSdk } from "./copies-fakes.mjs";
import { makeRestartCollector } from "./collector-fixture.mjs";

const FROZEN_V2 = jsonFile(new URL("../expectations/copies.v2.json", import.meta.url));
const CONSUMER_RESTART_CONFIG = FROZEN_V2.phases.find((phaseConfig) => phaseConfig.name === "consumer_restart");
const DEFAULT_SCHEDULE = Object.freeze(["retry_once", "retry_once", "clean", "clean"]);
const ZERO_SESSION_KEY = Buffer.alloc(32);
const NOOP_LEDGER = Object.freeze({ take() {} });
const CONSUMER_RESTART_IDENTITIES = Object.freeze(
  Array.from({ length: 4 }, (_, index) => ({ ids: { account: `evt_cr_${index}` } })),
);

function testForwardingFence(nodeBase, isFenced, onFenced) {
  const fencedNode = makeFencedSdkNode(nodeBase, isFenced, onFenced);
  return {
    ...fencedNode,
    createHttpDeliveryHandoff(options) {
      const fencedHandoff = fencedNode.createHttpDeliveryHandoff(options);
      const realHandoff = nodeBase.createHttpDeliveryHandoff(options);
      return {
        async handoff(event, attempt = 0) {
          if (isFenced()) {
            await fencedHandoff.handoff(event, attempt);
            return realHandoff.handoff(event, attempt);
          }
          return realHandoff.handoff(event, attempt);
        },
      };
    },
  };
}

async function startConsumerIngress({ schedule }) {
  const faultPlan = scheduledFaultPlan({ scenarios: FROZEN_V2.scenarios, schedule, cycles: 1 });
  const fakeCollector = makeRestartCollector(new Map());
  const storagePort = new fakeCollector.SqliteStorage({ location: ":memory:" });
  const ingressInstance = new fakeCollector.CollectorIngress({
    authenticator: new fakeCollector.SyntheticFixtureAuthenticator(["token"]),
    storage: { port: storagePort, owners: ["owner"] },
  });
  const server = await startIngress({ collector: fakeCollector, ingress: ingressInstance, faults: faultInjector(faultPlan) });
  return { server, storagePort, origin: `http://127.0.0.1:${server.port}` };
}

function consumerRestartInput({ schedule }) {
  return {
    contract_version: FROZEN_V2.contract_version,
    composition: CONSUMER_RESTART_CONFIG.composition,
    phase: {
      kind: "consumer_restart",
      occurrences: 4,
      schedule,
      cycles: 1,
      distinct_occurrences: 4,
      gate_timers: true,
    },
    clock: FROZEN_V2.clock,
    workload: { seed: FROZEN_V2.workload.seed },
  };
}

function compositionFactory({ sdkNode, origin, input, forwardFence = false }) {
  return ({ gateTimers, onAttemptScheduled, isFenced, onFenced }) => {
    const customSdkNode = forwardFence && isFenced
      ? testForwardingFence(sdkNode, isFenced, onFenced)
      : sdkNode;
    return senderFactories({ sdkNode: customSdkNode, senderSdk: testSenderSdk }).buildComposition({
      input,
      origin,
      token: "token",
      gateTimers,
      onAttemptScheduled,
      isFenced: forwardFence ? undefined : isFenced,
      onFenced,
    });
  };
}

function ingressSnapshot({ server, storagePort }) {
  return {
    records: [...server.state.records],
    read_back: readBack({ state: server.state, storage: storagePort }),
  };
}

async function runConsumerPhase({ schedule = DEFAULT_SCHEDULE, forwardFence = false } = {}) {
  const { server, storagePort, origin } = await startConsumerIngress({ schedule });
  try {
    const input = consumerRestartInput({ schedule });
    const sdkNode = fakeSdkNode();
    const phaseResult = await runConsumerRestart({
      buildComposition: compositionFactory({ sdkNode, origin, input, forwardFence }),
      buildSdk: ({ composition, onCaptured }) =>
        senderFactories({ sdkNode, senderSdk: testSenderSdk }).buildSdk({ input, composition, onCaptured }),
      ledger: NOOP_LEDGER,
      identities: CONSUMER_RESTART_IDENTITIES,
      input,
      sessionKey: ZERO_SESSION_KEY,
      recordedCall,
      authenticationInput: (opts) => ({ identities: opts.identities, at: opts.at }),
    });
    return {
      phaseResult,
      ingress: ingressSnapshot({ server, storagePort }),
    };
  } finally {
    await server.close();
  }
}

test("consumer restart resolves and proves ordering, fencing, and byte identity", { timeout: 15000 }, async () => {
  const { phaseResult: result, ingress } = await runConsumerPhase();

  assert.equal(result.restart_triggered, true);
  assert.equal(result.fenced_attempts.length, 2);

  const expectedFenced = new Set(ingress.records.filter((record) => record.status === 503).map((record) => record.event_id));
  const actualFenced = new Set(result.fenced_attempts.map((fenced) => fenced.event_id));
  assert.equal(actualFenced.size, 2);
  assert.deepEqual(actualFenced, expectedFenced);

  const callLabels = result.calls.map((callEntry) => callEntry.label);
  const redelivery0 = callLabels.indexOf("consumer_restart_redelivery_0");
  const redelivery1 = callLabels.indexOf("consumer_restart_redelivery_1");
  assert(redelivery0 !== -1 && redelivery1 !== -1);
  assert(redelivery0 < redelivery1);

  const redeliveredExchanges = result.exchanges.slice(4);
  assert.equal(redeliveredExchanges.length, 2);
  assert.equal(redeliveredExchanges[0].event_id, result.exchanges[0].event_id);
  assert.equal(redeliveredExchanges[1].event_id, result.exchanges[1].event_id);
  assert.equal(redeliveredExchanges[0].body_sha256, result.exchanges[0].body_sha256);
  assert.equal(redeliveredExchanges[1].body_sha256, result.exchanges[1].body_sha256);
});

test("phase result matches consumerRestartObserver, and planted C-07 defects mismatch", { timeout: 15000 }, async () => {
  const { phaseResult, ingress } = await runConsumerPhase();
  const config = CONSUMER_RESTART_CONFIG;
  const honestObserved = { consumer_restart: { sender: phaseResult, ingress } };
  const evaluated = consumerRestartObserver({ observed: honestObserved, config });
  const expectedC07 = FROZEN_V2.cases.find((caseDef) => caseDef.case_id === "C-07").expected;
  assert.deepEqual(evaluated, expectedC07);

  const firstEventId = phaseResult.exchanges[0].event_id;
  const defects = [
    (obs) => { obs.consumer_restart.sender.restart_triggered = false; },
    (obs) => { obs.consumer_restart.sender.health.before_restart.abandoned = 0; },
    (obs) => { obs.consumer_restart.sender.exchanges[3].body_sha256 = "0".repeat(64); },
    (obs) => { obs.consumer_restart.ingress.read_back.shift(); },
    (obs) => {
      obs.consumer_restart.sender.deliveries[firstEventId].status = "abandoned";
      obs.consumer_restart.ingress.read_back = obs.consumer_restart.ingress.read_back.filter((record) => record.event_id !== firstEventId);
    },
    (obs) => { obs.consumer_restart.sender.fenced_attempts = []; },
    (obs) => { obs.consumer_restart.ingress.records.push({ event_id: firstEventId, body_sha256: "0".repeat(64) }); },
  ];

  for (const defect of defects) {
    const clone = structuredClone(honestObserved);
    defect(clone);
    const result = consumerRestartObserver({ observed: clone, config });
    assert.notDeepEqual(result, expectedC07);
  }
});

test("Q177: consumer restart with non-prefix redelivery pair (evt_0 and evt_2) matches C-07", { timeout: 15000 }, async () => {
  const schedule = ["retry_once", "clean", "retry_once", "clean"];
  const { phaseResult, ingress } = await runConsumerPhase({ schedule });
  const config = CONSUMER_RESTART_CONFIG;
  const observed = { consumer_restart: { sender: phaseResult, ingress } };
  const evaluated = consumerRestartObserver({ observed, config });
  const expectedC07 = FROZEN_V2.cases.find((caseDef) => caseDef.case_id === "C-07").expected;
  assert.deepEqual(evaluated, expectedC07);
});

test("the sender's real fence and gate wiring: fenced attempt produces NO exchange", { timeout: 5000 }, async () => {
  let exchangeCalled = false;
  const fakeNode = {
    createFetchHttpExchange: () => () => { exchangeCalled = true; return { status: 202 }; },
    createHttpDeliveryHandoff: () => ({
      async handoff() {
        exchangeCalled = true;
        return { status: "acknowledged" };
      },
    }),
  };

  let isFenced = true;
  const fencedAttempts = [];
  const onFenced = (item) => fencedAttempts.push(item);
  const fencedSdk = makeFencedSdkNode(fakeNode, () => isFenced, onFenced);
  const handoff = fencedSdk.createHttpDeliveryHandoff();

  const event = { event: { id: "test_event" } };
  const res = await handoff.handoff(event, 0);

  assert.equal(exchangeCalled, false, "fenced attempt must produce NO exchange");
  assert.equal(fencedAttempts.length, 1);
  assert.equal(fencedAttempts[0].event_id, "test_event");
  assert.equal(res.status, "non_retryable");

  isFenced = false;
  await handoff.handoff(event, 0);
  assert.equal(exchangeCalled, true, "unfenced attempt must call the exchange");
});

test("planted forwarding fence calls onFenced and forwards to handoff, causing C-07 mismatch", { timeout: 15000 }, async () => {
  const { phaseResult, ingress } = await runConsumerPhase({ forwardFence: true });
  const config = CONSUMER_RESTART_CONFIG;
  const observed = { consumer_restart: { sender: phaseResult, ingress } };
  const evaluated = consumerRestartObserver({ observed, config });
  assert.equal(evaluated.fenced_produced_no_ingress, false);
  const expectedC07 = FROZEN_V2.cases.find((caseDef) => caseDef.case_id === "C-07").expected;
  assert.notDeepEqual(evaluated, expectedC07);
});

test("composition 1 exchange after shutdown without collision caught only by shutdown arm", { timeout: 5000 }, async () => {
  const baseSender = {
    restart_triggered: true,
    calls: [
      { label: "consumer_restart_redelivery_0", ok: true },
      { label: "consumer_restart_redelivery_1", ok: true },
    ],
    health: { before_restart: { abandoned: 2 }, after_restart: { abandoned: 0 } },
    fenced_attempts: [
      { event_id: "evt_cr_0", attempt: 1 },
      { event_id: "evt_cr_1", attempt: 1 },
    ],
    exchanges_at_shutdown: 2,
    comp1_exchanges_count: 2,
    exchanges: [
      { event_id: "evt_cr_0", attempt: 0, body_sha256: "0".repeat(64) },
      { event_id: "evt_cr_1", attempt: 0, body_sha256: "1".repeat(64) },
      { event_id: "evt_cr_0", attempt: 0, body_sha256: "0".repeat(64) },
      { event_id: "evt_cr_1", attempt: 0, body_sha256: "1".repeat(64) },
      { event_id: "evt_cr_extra", attempt: 0, body_sha256: "e".repeat(64) },
    ],
  };

  const ingress = {
    records: [
      { event_id: "evt_cr_0", body_sha256: "0".repeat(64), outcome: { kind: "persisted" } },
      { event_id: "evt_cr_0", body_sha256: "0".repeat(64), outcome: { kind: "persisted" } },
      { event_id: "evt_cr_1", body_sha256: "1".repeat(64), outcome: { kind: "persisted" } },
      { event_id: "evt_cr_1", body_sha256: "1".repeat(64), outcome: { kind: "persisted" } },
      { event_id: "evt_cr_extra", body_sha256: "e".repeat(64), outcome: { kind: "persisted" } },
    ],
    read_back: [
      { event_id: "evt_cr_0", persisted: true },
      { event_id: "evt_cr_1", persisted: true },
      { event_id: "evt_cr_extra", persisted: true },
    ],
  };
  const config = { occurrences: 4 };

  const evaluateComp1Exchanges = (comp1Count) => {
    const sender = { ...baseSender, comp1_exchanges_count: comp1Count };
    const observed = { consumer_restart: { sender, ingress } };
    return {
      match: checkShutdownExchangesMatch(sender),
      evaluated: consumerRestartObserver({ observed, config }),
    };
  };

  const nullControl = evaluateComp1Exchanges(2);
  assert.equal(nullControl.match, true);
  assert.equal(nullControl.evaluated.fenced_produced_no_ingress, true);

  const planted = evaluateComp1Exchanges(3);
  assert.equal(planted.match, false);
  assert.equal(planted.evaluated.fenced_produced_no_ingress, false);
});
