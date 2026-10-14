import assert from "node:assert/strict";

export const RECEIVER_CONTROL_DEFINITIONS = Object.freeze([
  { label: "receiver answering a duplicate with 400", identity: "loopback-example-exchange" },
  { label: "receiver rethrowing after replying", identity: "loopback-example-exchange" },
  { label: "receiver reading on after it answers a body past its bound", identity: "loopback-example-exchange" },
  { label: "receiver admitting an event that fails SDK validation", identity: "loopback-example-exchange" },
  { label: "receiver accepting a credential with no Bearer scheme", identity: "loopback-example-exchange" },
  { label: "receiver treating a POST to any path as a submission", identity: "loopback-example-exchange" },
  { label: "receiver answering another method without Allow: POST", identity: "loopback-example-exchange" },
  { label: "receiver counting a client abort as a rejection", identity: "loopback-example-exchange" },
  { label: "receiver disguising deduplication capacity as 500", identity: "loopback-example-exchange" },
]);

const [DUPLICATE_REJECTED_CONTROL, RETHROWING_RECEIVER_CONTROL, POST_ANSWER_READ_CONTROL, SKIPPED_SDK_VALIDATION_CONTROL] = RECEIVER_CONTROL_DEFINITIONS;
const [
  BARE_TOKEN_CREDENTIAL_CONTROL,
  WRONG_PATH_SUBMISSION_CONTROL,
  MISSING_ALLOW_HEADER_CONTROL,
  ABORT_COUNTED_CONTROL,
  CAPACITY_AS_SERVER_ERROR_CONTROL,
] = RECEIVER_CONTROL_DEFINITIONS.slice(4);
const RECEIVER_SOURCE_PATH = "examples/evaluation-receiver.ts";
const POST_ANSWER_READ_PLANTS = Object.freeze([
  {
    status: 401,
    anchor: '  req.pause();\n  res.writeHead(reply.status, { connection: "close", "content-type": "application/json" });',
    replacement: `  if (reply.status === 401) {
    req.resume();
    send(res, reply);
    setTimeout(() => socket?.destroySoon(), 1000);
    return;
  }
  req.pause();
  res.writeHead(reply.status, { connection: "close", "content-type": "application/json" });`,
    expectCondition: "bytes after answering 401, more than 16777216",
  },
  {
    status: 413,
    anchor: '  req.pause();\n  res.writeHead(reply.status, { connection: "close", "content-type": "application/json" });',
    replacement: `  if (reply.status === 413) {
    req.resume();
    send(res, reply);
    setTimeout(() => socket?.destroySoon(), 1000);
    return;
  }
  req.pause();
  res.writeHead(reply.status, { connection: "close", "content-type": "application/json" });`,
    expectCondition: "bytes after answering 413, more than 16777216",
  },
]);

async function checkDuplicateRejectedControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(DUPLICATE_REJECTED_CONTROL.label);
  const measurements = await helpers.assertMeasuredKitDefectFails(kitDir, control, {
    tempPrefix: "bloodtrail-ctrl-receiver-duplicate-",
    path: RECEIVER_SOURCE_PATH,
    plant: (text) =>
      text.replace(
        "    console.log(`receiver:duplicate ${result.eventId}`);\n    return acknowledge(result.eventId);",
        '    return reject(state, 400, "duplicate");',
      ),
    expectCondition: "a byte-identical duplicate: expected 2xx, got 400",
    _disabledChecks,
  });
  assert.equal(measurements.length, 1, "duplicate receiver control must record one measured plant");
  return helpers.completeControl(control, measurements);
}

// The receiver before #656: it replied, then rethrew out of the request handler, and the process died.
async function checkRethrowingReceiverControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(RETHROWING_RECEIVER_CONTROL.label);
  const measurements = await helpers.assertMeasuredKitDefectFails(kitDir, control, {
    tempPrefix: "bloodtrail-ctrl-receiver-rethrow-",
    path: RECEIVER_SOURCE_PATH,
    plant: (text) =>
      text
        .replace(
          "  } else {\n    send(res, submission.reply);\n  }\n",
          '  } else {\n    send(res, submission.reply);\n  }\n  if (res.statusCode >= 400) throw new Error("rethrown after replying");\n',
        )
        .replace('    } catch {\n      console.log("receiver:error 500");', "    } catch (err) {\n      throw err;"),
    expectCondition: "the receiver must keep serving",
    _disabledChecks,
  });
  assert.equal(measurements.length, 1, "rethrowing receiver control must record one measured plant");
  return helpers.completeControl(control, measurements);
}

function restorePostAnswerReading(text, plant) {
  const matches = text.split(plant.anchor).length - 1;
  assert.equal(matches, 1, `post-answer ${plant.status} plant anchor must occur exactly once`);
  return text.replace(plant.anchor, plant.replacement);
}

async function checkPostAnswerReadControl(kitDir, _disabledChecks, helpers) {
  const control = helpers.controlFor(POST_ANSWER_READ_CONTROL.label);
  const measurements = [];
  for (const plant of POST_ANSWER_READ_PLANTS) {
    measurements.push(
      ...(await helpers.assertMeasuredKitDefectFails(kitDir, control, {
        tempPrefix: `bloodtrail-ctrl-receiver-reading-${plant.status}-`,
        path: RECEIVER_SOURCE_PATH,
        plant: (text) => restorePostAnswerReading(text, plant),
        expectCondition: plant.expectCondition,
        _disabledChecks,
      })),
    );
  }
  assert.equal(measurements.length, POST_ANSWER_READ_PLANTS.length, "post-answer receiver control must record both measured plants");
  return helpers.completeControl(control, measurements);
}

// The planted kits below share one shape: a single string-anchored replacement in the kit copy's receiver
// source, measured against the kit gate, and asserted to fail at the control's declared identity with its
// named condition. The spec object holds the control, its plant, and its messages; the shared checker keeps
// the string-anchored controls from repeating the same body.
//
// The receiver before #708: it parsed the body and admitted it without SDK validation, so the gate's
// structurally valid but SDK-invalid probe event was answered 2xx instead of 422. The planted kit still
// type-checks: the consumer tsconfig sets no noUnusedLocals, so the unused validateSecurityAuditEvent
// import and the read-but-unused `parsed` stay clean.
const SKIPPED_SDK_VALIDATION_ANCHOR =
  "  const validated = validateSecurityAuditEvent(parsed);\n" +
  "  if (!validated.ok) {\n" +
  "    console.log(`receiver:invalid ${validated.error.code} ${validated.error.path}`);\n" +
  '    return { reply: reject(state, 422, "invalid_event"), close: false };\n' +
  "  }\n";

const SKIPPED_SDK_VALIDATION_PLANT = Object.freeze({
  control: SKIPPED_SDK_VALIDATION_CONTROL,
  tempPrefix: "bloodtrail-ctrl-receiver-skipped-validation-",
  anchor: SKIPPED_SDK_VALIDATION_ANCHOR,
  replacement: "",
  anchorLabel: "SDK-validation",
  recordLabel: "skipped-SDK-validation",
  expectCondition: "an SDK-invalid event: expected 422",
});

// The receiver before #709: a credential with no Bearer scheme authenticated, so the gate's bare-token case
// acknowledged the fixture token instead of refusing it with 401.
const BARE_TOKEN_CREDENTIAL_ANCHOR = '  const separator = header.indexOf(" ");\n  if (separator === -1) return undefined;\n';

const BARE_TOKEN_CREDENTIAL_PLANT = Object.freeze({
  control: BARE_TOKEN_CREDENTIAL_CONTROL,
  tempPrefix: "bloodtrail-ctrl-receiver-bare-token-",
  anchor: BARE_TOKEN_CREDENTIAL_ANCHOR,
  replacement: '  const separator = header.indexOf(" ");\n  if (separator === -1) return { credential: header };\n',
  anchorLabel: "bare-token",
  recordLabel: "bare-token",
  expectCondition: "a bare token: expected 401, got",
});

// The receiver before #709: a POST to any path was a submission, so with the path check removed the gate's
// wrong-path case admitted the event instead of refusing it with 404. The planted kit still type-checks: the
// consumer tsconfig sets no noUnusedLocals, so the now-unused SUBMISSION_PATH constant stays clean.
const WRONG_PATH_CHECK_ANCHOR = '  if (req.url !== SUBMISSION_PATH) return { status: 404, reason: "not_found", allowPost: false };\n';

const WRONG_PATH_SUBMISSION_PLANT = Object.freeze({
  control: WRONG_PATH_SUBMISSION_CONTROL,
  tempPrefix: "bloodtrail-ctrl-receiver-wrong-path-",
  anchor: WRONG_PATH_CHECK_ANCHOR,
  replacement: "",
  anchorLabel: "wrong-path",
  recordLabel: "wrong-path",
  expectCondition: "a POST to another path admitted an event: expected 404, got",
});

// The receiver before #709: another method was answered without an Allow header, so with the header dropped
// from the 405 the gate's method case no longer sees Allow: POST.
const MISSING_ALLOW_HEADER_ANCHOR = '  if (refusal.allowPost) res.setHeader("allow", "POST");\n';

const MISSING_ALLOW_HEADER_PLANT = Object.freeze({
  control: MISSING_ALLOW_HEADER_CONTROL,
  tempPrefix: "bloodtrail-ctrl-receiver-allow-",
  anchor: MISSING_ALLOW_HEADER_ANCHOR,
  replacement: "",
  anchorLabel: "Allow-header",
  recordLabel: "Allow-header",
  expectCondition: "on the submission path: expected Allow: POST, got",
});

// The receiver before #709: a client abort went to the 500 and rejection path, so the gate's abort case saw
// rejectedCount rise and no longer proved the abort counted as neither a 500 nor a rejection.
const ABORT_COUNTED_ANCHOR =
  '  if (submission === SUBMISSION_ABORTED) {\n    console.log("receiver:aborted");\n    return;\n  }\n';

const ABORT_COUNTED_PLANT = Object.freeze({
  control: ABORT_COUNTED_CONTROL,
  tempPrefix: "bloodtrail-ctrl-receiver-abort-",
  anchor: ABORT_COUNTED_ANCHOR,
  replacement:
    '  if (submission === SUBMISSION_ABORTED) {\n    console.log("receiver:aborted");\n    reject(state, 500, "internal_error");\n    return;\n  }\n',
  anchorLabel: "abort-counted",
  recordLabel: "abort-counted",
  expectCondition: "a client abort was counted as a rejection",
});

// The receiver before #798: bounded no-storage capacity fell through to 500/ingress_rejected.
const CAPACITY_AS_SERVER_ERROR_PLANT = Object.freeze({
  control: CAPACITY_AS_SERVER_ERROR_CONTROL,
  tempPrefix: "bloodtrail-ctrl-receiver-capacity-",
  anchor: '    return reject(state, 429, "deduplication_capacity");',
  replacement: '    return reject(state, 500, "ingress_rejected");',
  anchorLabel: "deduplication-capacity",
  recordLabel: "deduplication-capacity",
  expectCondition: "deduplication capacity: expected 429, got 500",
});

const STRING_ANCHORED_RECEIVER_PLANTS = Object.freeze([
  SKIPPED_SDK_VALIDATION_PLANT,
  BARE_TOKEN_CREDENTIAL_PLANT,
  WRONG_PATH_SUBMISSION_PLANT,
  MISSING_ALLOW_HEADER_PLANT,
  ABORT_COUNTED_PLANT,
  CAPACITY_AS_SERVER_ERROR_PLANT,
]);

async function checkStringAnchoredPlant(kitDir, _disabledChecks, helpers, spec) {
  const control = helpers.controlFor(spec.control.label);
  const measurements = await helpers.assertMeasuredKitDefectFails(kitDir, control, {
    tempPrefix: spec.tempPrefix,
    path: RECEIVER_SOURCE_PATH,
    plant: (text) => {
      const matches = text.split(spec.anchor).length - 1;
      assert.equal(matches, 1, `${spec.anchorLabel} plant anchor must occur exactly once`);
      return text.replace(spec.anchor, spec.replacement);
    },
    expectCondition: spec.expectCondition,
    _disabledChecks,
  });
  assert.equal(measurements.length, 1, `${spec.recordLabel} receiver control must record one measured plant`);
  console.log(`receiver control verified at ${control.identity}: ${spec.expectCondition} (one measured plant)`);
  return helpers.completeControl(control, measurements);
}

export function createReceiverControlRunners(helpers) {
  return Object.freeze([
    [DUPLICATE_REJECTED_CONTROL.label, ({ kitDir, _disabledChecks }) => checkDuplicateRejectedControl(kitDir, _disabledChecks, helpers)],
    [RETHROWING_RECEIVER_CONTROL.label, ({ kitDir, _disabledChecks }) => checkRethrowingReceiverControl(kitDir, _disabledChecks, helpers)],
    [POST_ANSWER_READ_CONTROL.label, ({ kitDir, _disabledChecks }) => checkPostAnswerReadControl(kitDir, _disabledChecks, helpers)],
    ...STRING_ANCHORED_RECEIVER_PLANTS.map((spec) => [
      spec.control.label,
      ({ kitDir, _disabledChecks }) => checkStringAnchoredPlant(kitDir, _disabledChecks, helpers, spec),
    ]),
  ]);
}
