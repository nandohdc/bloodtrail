import assert from "node:assert/strict";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { sha256 } from "./io.mjs";
import { requireProbe } from "./plan.mjs";
import { RUN_LIMIT } from "./results.mjs";

// G42: a 14-day window from the first Stage 2 run approval. G44: delegated S1 on the probe tickets.
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const DELEGATED_TICKETS = Object.freeze([836, 837, 838, 839, 840, 841, 842]);

function utcTime(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, "invalid UTC timestamp");
  const time = Date.parse(value);
  assert(Number.isFinite(time), "invalid approval timestamp");
  assert.equal(new Date(time).toISOString(), value.includes(".") ? value : value.replace("Z", ".000Z"), "invalid UTC date");
  return time;
}

function delegatedApproval({ lines, ticket }) {
  if (!lines.includes("Delegated S1 under G44")) return null;
  assert(DELEGATED_TICKETS.includes(ticket), "G44 delegation does not cover this ticket");
  return "G44";
}

export function approvalRecord({ body, url, createdAt, updatedAt, bodySha256, approvedHead, runNumber, windowOpenedAt, now = Date.now(), probe, ticket }) {
  requireProbe({ probe, ticket });
  const lines = body.split(/\r?\n/).map((entry) => entry.trim());
  assert.equal(sha256(Buffer.from(body, "utf8")), bodySha256, "approval body sha256 mismatch");
  assert.equal(updatedAt, createdAt, "edited approval is invalid");
  assert.match(approvedHead, /^[0-9a-f]{40}$/, "invalid approved head");
  assert(Number.isInteger(runNumber) && runNumber >= 1 && runNumber <= RUN_LIMIT, "run number outside shared authorization");
  const line = `S1 approval: ${probe} run ${runNumber} for #${ticket} at ${approvedHead}`;
  assert(lines.includes(line), "missing exact approval line");
  const opened = utcTime(windowOpenedAt);
  assert(utcTime(createdAt) >= opened, "approval predates window");
  assert(now <= opened + WINDOW_MS, "approval window expired");
  assert.match(url, new RegExp(`^https://github\\.com/nandohdc/bloodtrail/(issues|pull)/${ticket}#issuecomment-\\d+$`), "approval URL must name the probe ticket");
  const delegation = delegatedApproval({ lines, ticket });
  return { url, createdAt, updatedAt, body_sha256: bodySha256, window_opened_at: windowOpenedAt, delegation };
}

export function approvalFromArgs({ options, now, probe, ticket }) {
  requireProbe({ probe, ticket });
  return approvalRecord({
    body: readFileSync(options["approval-body-file"], "utf8"),
    url: options["approval-url"], createdAt: options["approval-created-at"],
    updatedAt: options["approval-updated-at"], bodySha256: options["approval-sha256"], approvedHead: options.approvedHead,
    runNumber: Number(options["run-number"]), windowOpenedAt: options["window-opened-at"], now, probe, ticket,
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
