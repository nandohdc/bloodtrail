import assert from "node:assert/strict";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { sha256 } from "./io.mjs";
import { requireProbe } from "./plan.mjs";
import { RUN_LIMIT } from "./results.mjs";

// G42: a 14-day window from the first Stage 2 run approval. G44: delegated S1 on the probe tickets.
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const DELEGATED_TICKETS = Object.freeze([836, 837, 838, 839, 840, 841, 842]);

export const SLOT_TICKETS = Object.freeze({
  1: 836,
  2: 837,
  3: 838,
  4: 838,
  5: 839,
  6: 839,
  7: 839,
  8: 840,
  9: 842,
  10: 841,
  11: 841,
  12: 841,
});

export const LAST_SLOT = Math.max(...Object.keys(SLOT_TICKETS).map(Number));

function utcTime(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, "invalid UTC timestamp");
  const time = Date.parse(value);
  assert(Number.isFinite(time), "invalid approval timestamp");
  assert.equal(new Date(time).toISOString(), value.includes(".") ? value : value.replace("Z", ".000Z"), "invalid UTC date");
  return time;
}

function issueCommentPattern(ticket) {
  return new RegExp(`^https://github\\.com/nandohdc/bloodtrail/(issues|pull)/${ticket}#issuecomment-\\d+$`);
}

function delegatedApproval({ lines, ticket }) {
  if (!lines.includes("Delegated S1 under G44")) return null;
  assert(DELEGATED_TICKETS.includes(ticket), "G44 delegation does not cover this ticket");
  return "G44";
}

function assertTiming({ createdAt, windowOpenedAt, now }) {
  const opened = utcTime(windowOpenedAt);
  assert(utcTime(createdAt) >= opened, "approval predates window");
  assert(now <= opened + WINDOW_MS, "approval window expired");
}

function assertRunNumber(runNumber) {
  const valid = Number.isInteger(runNumber) && runNumber >= 1 && runNumber <= RUN_LIMIT;
  assert(valid, "run number outside shared authorization");
}

function assertSlotTicket({ runNumber, ticket }) {
  if (runNumber > LAST_SLOT) return;
  const slotTicket = SLOT_TICKETS[runNumber];
  assert.equal(ticket, slotTicket, `run ${runNumber} is the slot for #${slotTicket} (G46, Q74)`);
}

function assertDispositionTiming({ createdAt, windowOpenedAt, approvalCreatedAt }) {
  const dispTime = utcTime(createdAt);
  const opened = utcTime(windowOpenedAt);
  const approvalTime = utcTime(approvalCreatedAt);
  assert(dispTime >= opened, "disposition predates window (G46, Q68)");
  assert(dispTime <= approvalTime, "disposition created after S1 (G46, Q68)");
}

function validateDisposition({ disposition, probe, ticket, runNumber, windowOpenedAt, approvalCreatedAt }) {
  if (runNumber > LAST_SLOT) {
    assert(disposition, "reserve runs require an owner disposition (G46, Q68)");
  }
  if (!disposition) return null;
  const { body, url, createdAt, updatedAt, bodySha256 } = disposition;
  const complete = [body, url, createdAt, updatedAt, bodySha256].every(Boolean);
  assert(complete, "incomplete disposition record (G46, Q68)");
  assert(!/delegated/i.test(body), "owner disposition cannot be delegated (G46, Q68)");
  assert.equal(updatedAt, createdAt, "edited disposition is invalid (G46, Q68)");
  assert.match(url, issueCommentPattern(ticket), "disposition URL must name the probe ticket (G46, Q68)");
  assert.equal(sha256(Buffer.from(body, "utf8")), bodySha256, "disposition body sha256 mismatch (G46, Q68)");
  const lines = body.split(/\r?\n/).map((entry) => entry.trim());
  const requiredLine = `Owner disposition: ${probe} run ${runNumber} for #${ticket}`;
  assert(lines.includes(requiredLine), "missing owner disposition line (G46, Q68)");
  assertDispositionTiming({ createdAt, windowOpenedAt, approvalCreatedAt });
  return { url, created_at: createdAt, body_sha256: bodySha256 };
}

function dispositionFromArgs(options) {
  const file = options["disposition-body-file"];
  const url = options["disposition-url"];
  const sha = options["disposition-sha256"];
  const createdAt = options["disposition-created-at"];
  const updatedAt = options["disposition-updated-at"];
  const present = Boolean(file || url || sha || createdAt || updatedAt);
  if (!present) return undefined;
  return {
    body: file ? readFileSync(file, "utf8") : "",
    url,
    createdAt,
    updatedAt,
    bodySha256: sha,
  };
}

export function approvalRecord({ body, url, createdAt, updatedAt, bodySha256, approvedHead, runNumber, windowOpenedAt, now = Date.now(), probe, ticket, disposition }) {
  requireProbe({ probe, ticket });
  assertRunNumber(runNumber);
  const lines = body.split(/\r?\n/).map((entry) => entry.trim());
  const delegation = delegatedApproval({ lines, ticket });
  assertSlotTicket({ runNumber, ticket });
  assert.equal(sha256(Buffer.from(body, "utf8")), bodySha256, "approval body sha256 mismatch");
  assert.equal(updatedAt, createdAt, "edited approval is invalid");
  assert.match(approvedHead, /^[0-9a-f]{40}$/, "invalid approved head");
  const line = `S1 approval: ${probe} run ${runNumber} for #${ticket} at ${approvedHead}`;
  assert(lines.includes(line), "missing exact approval line");
  assertTiming({ createdAt, windowOpenedAt, now });
  assert.match(url, issueCommentPattern(ticket), "approval URL must name the probe ticket");
  const dispositionRecord = validateDisposition({
    disposition,
    probe,
    ticket,
    runNumber,
    windowOpenedAt,
    approvalCreatedAt: createdAt,
  });
  return { url, createdAt, updatedAt, body_sha256: bodySha256, window_opened_at: windowOpenedAt, delegation, disposition: dispositionRecord };
}

export function approvalFromArgs({ options, now, probe, ticket }) {
  requireProbe({ probe, ticket });
  const disposition = dispositionFromArgs(options);
  return approvalRecord({
    body: readFileSync(options["approval-body-file"], "utf8"),
    url: options["approval-url"], createdAt: options["approval-created-at"],
    updatedAt: options["approval-updated-at"], bodySha256: options["approval-sha256"], approvedHead: options.approvedHead,
    runNumber: Number(options["run-number"]), windowOpenedAt: options["window-opened-at"], now, probe, ticket,
    disposition,
  });
}

export function claimOnce({ path, approvedHead, bodySha256, windowOpenedAt }) {
  let fd;
  try {
    fd = openSync(path, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error("once-marker already exists: approval execution refused");
    throw error;
  }
  try {
    writeFileSync(fd, `${approvedHead}\n${bodySha256}\n${windowOpenedAt}\n`);
  } finally {
    closeSync(fd);
  }
}
