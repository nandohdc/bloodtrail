import assert from "node:assert/strict";

export const RECEIVER_CONTROL_DEFINITIONS = Object.freeze([
  { label: "receiver answering a duplicate with 400", identity: "loopback-example-exchange" },
  { label: "receiver rethrowing after replying", identity: "loopback-example-exchange" },
  { label: "receiver reading on after it answers a body past its bound", identity: "loopback-example-exchange" },
]);

const [DUPLICATE_REJECTED_CONTROL, RETHROWING_RECEIVER_CONTROL, POST_ANSWER_READ_CONTROL] = RECEIVER_CONTROL_DEFINITIONS;
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
          "      } else {\n        send(res, submission.reply);\n      }\n",
          '      } else {\n        send(res, submission.reply);\n      }\n      if (res.statusCode >= 400) throw new Error("rethrown after replying");\n',
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

export function createReceiverControlRunners(helpers) {
  return Object.freeze([
    [DUPLICATE_REJECTED_CONTROL.label, ({ kitDir, _disabledChecks }) => checkDuplicateRejectedControl(kitDir, _disabledChecks, helpers)],
    [RETHROWING_RECEIVER_CONTROL.label, ({ kitDir, _disabledChecks }) => checkRethrowingReceiverControl(kitDir, _disabledChecks, helpers)],
    [POST_ANSWER_READ_CONTROL.label, ({ kitDir, _disabledChecks }) => checkPostAnswerReadControl(kitDir, _disabledChecks, helpers)],
  ]);
}
