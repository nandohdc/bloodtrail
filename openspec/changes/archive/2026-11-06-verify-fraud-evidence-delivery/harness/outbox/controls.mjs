// Live crash-phase controls on dedicated host files, counted in the run ledger.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { writeControls } from "../lib/controls.mjs";
import { controlCallPlan } from "./call-plan.mjs";
import { createTransactionBoundSink, openHostDatabase } from "./host.mjs";
import { executeHostWorkload, phaseRecorder } from "./host-execution.mjs";
import { crashPersistenceIdentityObserver } from "./observers-atomicity.mjs";
import { drainMarkBeforeAck, drainPendingOutbox, RelayCrashError } from "./relay.mjs";
import { generateWorkloadDefinition } from "./workload.mjs";

function recordingComposition() {
  const bodies = new Map();
  const deliveries = [];
  return {
    bodies, deliveries,
    readBack: () => [...bodies.keys()].map((event_id) => ({ event_id, persisted: true })),
    async deliver(event) {
      deliveries.push(event.event.id);
      bodies.set(event.event.id, structuredClone(event));
      return { status: "acknowledged" };
    },
  };
}

async function runUntilCrash(options, planted, crashIndex) {
  let acknowledgments = 0;
  try {
    if (planted) {
      await drainMarkBeforeAck({ ...options, crashAfterMarkIndex: crashIndex });
    } else {
      await drainPendingOutbox({
        ...options,
        onBeforeMark: async () => {
          acknowledgments += 1;
          if (acknowledgments === crashIndex + 1) throw new RelayCrashError("null control crash before mark");
        },
      });
    }
  } catch (error) {
    assert(error instanceof RelayCrashError, `unexpected control error: ${error.message}`);
    return true;
  }
  return false;
}

async function relayControl({ directory, input, core, buildSdk, recordedCall, planted, ledger, calls }) {
  const config = input.control_phase;
  const name = `${input.phase.name}-control-${planted}`;
  let host = openHostDatabase({ directory, name });
  const composition = recordingComposition();
  const plan = controlCallPlan(config, planted);
  const record = phaseRecorder({ ledger, recordedCall, calls });
  try {
    const sink = createTransactionBoundSink({ host });
    const sdk = buildSdk({ input: { ...input, phase: { ...config, kind: "commit_relay" } }, sink });
    const workload = generateWorkloadDefinition({
      count: config.change_count, seed: input.workload.seed,
      clockStart: input.clock.start, clockStepMs: input.clock.step_ms,
    });
    let planIndex = await executeHostWorkload({
      workload, host, sdk, core, record, plan,
      phase: { kind: "commit_relay" },
    });
    const relayOptions = {
      host, composition, ledger, getLabel: () => plan[planIndex++].label,
      recordCall: ({ label, invoke }) => record({ label }, invoke),
    };
    const crashFired = await runUntilCrash(relayOptions, planted, config.crash_after_acknowledgment - 1);
    host.close();
    host = openHostDatabase({ directory, name, exists: true });
    await drainPendingOutbox({ ...relayOptions, host });
    return {
      sender: {
        crash_fired: crashFired, pending_after_resume: host.counts().pending_outbox,
        host: { business_rows: host.businessRows(), business_count: host.counts().business_change },
      },
      ingress: {
        persisted_bodies: [...composition.bodies.values()], read_back: composition.readBack(),
        delivery_count: composition.deliveries.length,
      },
      ledger: ledger.report(),
    };
  } finally {
    host.close();
  }
}

export async function markBeforeAckControl(options) {
  const planted = await relayControl({ ...options, planted: true });
  const nullControl = await relayControl({ ...options, planted: false });
  const args = { caseDef: options.input.control_case, config: options.input.control_phase };
  const name = args.caseDef.phases[0];
  const plantedResult = crashPersistenceIdentityObserver({ ...args, observed: { [name]: planted } });
  const nullResult = crashPersistenceIdentityObserver({ ...args, observed: { [name]: nullControl } });
  const detected = plantedResult.persisted_exactly_once === false;
  const passed = nullResult.persisted_exactly_once === true;
  return {
    planted, null_control: nullControl,
    mark_before_ack_defect_detected: detected, null_control_passed: passed,
    holds: detected && passed,
  };
}

export function hostDbIsolationControl(directory) {
  assert.equal(typeof directory, "string", "host database directory required");
  assert(directory.length > 0, "host database directory required");
  const result = writeControls({
    refusedPath: join(dirname(directory), "planted-host-write"),
    allowedPath: join(directory, "control-probe-write"),
  });
  return {
    host_database_grant_isolated: result.holds, planted_write_refused: result.planted_refused,
    null_control_allowed: result.null_control_allowed, holds: result.holds,
  };
}
