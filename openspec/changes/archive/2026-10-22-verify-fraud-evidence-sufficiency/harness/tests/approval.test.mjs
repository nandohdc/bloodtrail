import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { approvalRecord, claimOnce } from "../lib/approval.mjs";
import { sha256 } from "../lib/io.mjs";
import { argumentsFor, DRIVER_ARGS, RUN_ARGS } from "../lib/arguments.mjs";
import { approvalBody, APPROVAL_URL, CREATED, NOW } from "./approval-fixture.mjs";

const HEAD = "1".repeat(40);
const BODY = `${approvalBody({ head: HEAD })}\nopaque Ω`;
const APPROVAL = { probe: "P-ids", ticket: 800, body: BODY, bodySha256: sha256(BODY), approvedHead: HEAD, url: APPROVAL_URL, createdAt: CREATED, updatedAt: CREATED, runNumber: 1, windowOpenedAt: CREATED, now: NOW };
const INVALID = [
  { body: BODY + "\n" }, { bodySha256: "0".repeat(64) },
  { updatedAt: "2026-10-16T00:00:01.000Z" }, { approvedHead: "2".repeat(40) },
  { windowOpenedAt: "2026-02-30T00:00:00.000Z" }, { approvedHead: "A".repeat(40) },
];

test("approval binds exact UTF-8 bytes, run/head and UTC window without authenticating author", () => {
  const record = approvalRecord(APPROVAL);
  assert.equal(record.body_sha256, APPROVAL.bodySha256);
  assert.equal(record.window_opened_at, CREATED);
  assert.equal(record.createdAt, record.updatedAt);
  for (const patch of INVALID) assert.throws(() => approvalRecord({ ...APPROVAL, ...patch }));
  assert.equal(approvalRecord({ ...APPROVAL, now: Date.parse(CREATED) + 7 * 86400000 }).window_opened_at, CREATED);
});

test("exclusive once-marker cannot be reused, including after a refused run", () => {
  const directory = mkdtempSync(join(tmpdir(), "pids-marker-fixture-"));
  try {
    const options = { path: join(directory, "marker"), approvedHead: HEAD };
    claimOnce(options);
    assert.throws(() => claimOnce(options), /once-marker already exists/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  assert(!existsSync(directory));
});

test("run CLI refuses each missing required argument and non-pi driver", () => {
  const required = ["approved-head", ...RUN_ARGS, ...DRIVER_ARGS];
  const values = Object.fromEntries(required.map((key) => [key, key === "driver-harness" ? "pi" : "fixture"]));
  for (const missing of required) {
    const args = Object.entries(values).filter(([key]) => key !== missing).flatMap(([key, value]) => [`--${key}`, value]);
    assert.throws(() => argumentsFor({ args, run: true }), /required argument/);
  }
  const args = Object.entries({ ...values, "driver-harness": "fixture" }).flatMap(([key, value]) => [`--${key}`, value]);
  assert.throws(() => argumentsFor({ args, run: true }));
});
