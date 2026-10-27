import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { approvalRecord, claimOnce } from "../lib/approval.mjs";
import { argumentsFor, DRIVER_ARGS, RUN_ARGS } from "../lib/arguments.mjs";
import { sha256 } from "../lib/io.mjs";
import { assertControlDirectory, controlDirectory, markerDestination } from "../lib/preflight.mjs";

const HEAD = "1".repeat(40);
const CREATED = "2026-10-23T00:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;
const URL = "https://github.com/nandohdc/bloodtrail/issues/836#issuecomment-1";
const line = ({ run = 1, ticket = 836, head = HEAD } = {}) => `S1 approval: S2-tracer run ${run} for #${ticket} at ${head}`;

function approval(patch = {}) {
  const body = patch.body ?? `${line({ run: patch.runNumber })}\nDelegated S1 under G44\nopaque Ω`;
  return {
    probe: "S2-tracer", ticket: 836, body, bodySha256: sha256(body), approvedHead: HEAD, url: URL, createdAt: CREATED,
    updatedAt: CREATED, runNumber: 1, windowOpenedAt: CREATED, now: Date.parse(CREATED) + 1000, ...patch,
  };
}

test("approval binds the exact body bytes, run, head and ticket, and records the G44 delegation", () => {
  const record = approvalRecord(approval());
  assert.equal(record.delegation, "G44");
  assert.equal(record.window_opened_at, CREATED);
  const invalid = [
    { bodySha256: "0".repeat(64) }, { updatedAt: "2026-10-23T00:00:01.000Z" }, { approvedHead: "2".repeat(40) },
    { approvedHead: "A".repeat(40) }, { windowOpenedAt: "2026-02-30T00:00:00.000Z" },
    { url: "https://github.com/nandohdc/bloodtrail/issues/837#issuecomment-1" },
  ];
  for (const patch of invalid) assert.throws(() => approvalRecord(approval(patch)), undefined, JSON.stringify(patch));
});

test("an approval without the delegation line is still valid and records no delegation", () => {
  assert.equal(approvalRecord(approval({ body: line() })).delegation, null);
});

test("G42: runs 1 to 12 are inside the shared authorization; run 13 is not", () => {
  assert.equal(approvalRecord(approval({ runNumber: 12, body: line({ run: 12 }) })).delegation, null);
  assert.throws(() => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }) })), /run number outside shared authorization/);
  assert.throws(() => approvalRecord(approval({ runNumber: 0, body: line({ run: 0 }) })), /run number outside shared authorization/);
});

test("G42: the window is 14 days from its opening, not 7", () => {
  assert.doesNotThrow(() => approvalRecord(approval({ now: Date.parse(CREATED) + 13 * DAY })));
  assert.doesNotThrow(() => approvalRecord(approval({ now: Date.parse(CREATED) + 14 * DAY })));
  assert.throws(() => approvalRecord(approval({ now: Date.parse(CREATED) + 14 * DAY + 1 })), /approval window expired/);
});

test("G44 delegation covers only the Stage 2 probe tickets", () => {
  const body = `S1 approval: S2-tracer run 1 for #843 at ${HEAD}\nDelegated S1 under G44`;
  const record = { ...approval({ body }), ticket: 843, url: "https://github.com/nandohdc/bloodtrail/issues/843#issuecomment-1" };
  assert.throws(() => approvalRecord(record), /G44 delegation does not cover this ticket/);
  const stageP = `${line()}\nDelegated S1 under G39`;
  assert.equal(approvalRecord(approval({ body: stageP })).delegation, null, "a Stage P delegation line is not a Stage 2 delegation");
});

test("the once-marker cannot be claimed twice, and records the head and approval it was claimed for", () => {
  const directory = mkdtempSync(join(tmpdir(), "stage-2-marker-fixture-"));
  try {
    const options = { path: join(directory, "run-1"), approvedHead: HEAD, bodySha256: "a".repeat(64), windowOpenedAt: CREATED };
    claimOnce(options);
    assert.equal(readFileSync(options.path, "utf8"), `${HEAD}\n${"a".repeat(64)}\n${CREATED}\n`);
    assert.throws(() => claimOnce(options), /once-marker already exists/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  assert(!existsSync(directory));
});

test("a run number is claimed once across approvals, and the control directory never exceeds the run limit", () => {
  const root = mkdtempSync(join(tmpdir(), "stage-2-control-fixture-"));
  const repo = join(root, "repo");
  const control = join(root, "control");
  mkdirSync(repo);
  mkdirSync(control);
  try {
    const destination = (run, windowOpenedAt = CREATED) => markerDestination({ path: join(control, `run-${run}`), repo, runNumber: run, windowOpenedAt });
    assert.deepEqual(destination(1), { name: "run-1", prior_claims: [], window_recorded_by_prior_claims: null }, "the first claim declares the window");
    const claimed = `${HEAD}\n${"a".repeat(64)}\n${CREATED}\n`;
    for (const name of ["run-2", "run-1", "unrelated"]) writeFileSync(join(control, name), claimed);
    assert.deepEqual(destination(3), { name: "run-3", prior_claims: ["run-1", "run-2"], window_recorded_by_prior_claims: CREATED });
    assert.throws(() => destination(2), /run 2 is already claimed/, "a second approval naming run 2 is refused");
    assert.throws(() => destination(3, "2026-11-01T00:00:00.000Z"), /G42 window opened at/, "a later run cannot restart the window");
    assert.throws(() => markerDestination({ path: join(control, "marker"), repo, runNumber: 3, windowOpenedAt: CREATED }), /run-<run number>/);
    assert.throws(() => markerDestination({ path: join(repo, "run-3"), repo, runNumber: 3, windowOpenedAt: CREATED }), /outside repository/);
    for (let run = 3; run <= 12; run += 1) writeFileSync(join(control, `run-${run}`), claimed);
    assert.throws(() => destination(13), /G42 run limit is already spent/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("G45: the run CLI requires every argument and the historical Claude Code lane", () => {
  const required = ["approved-head", ...RUN_ARGS, ...DRIVER_ARGS];
  const values = Object.fromEntries(required.map((key) => [key, key === "driver-lane" ? "claude-code" : "fixture"]));
  const toArgs = (entries) => Object.entries(entries).flatMap(([key, value]) => [`--${key}`, value]);
  assert.equal(argumentsFor({ args: toArgs(values), run: true }).driver.lane, "claude-code");
  for (const missing of required) {
    const args = toArgs(Object.fromEntries(Object.entries(values).filter(([key]) => key !== missing)));
    assert.throws(() => argumentsFor({ args, run: true }), /required argument/, missing);
  }
  assert.throws(() => argumentsFor({ args: toArgs({ ...values, "driver-lane": "pi" }), run: true }), /Claude Code lane/);
});

test("the owner Codex exception is bounded to #838 and build-only checks", () => {
  const values = Object.fromEntries(["approved-head", ...RUN_ARGS, ...DRIVER_ARGS].map((key) => [key, key === "driver-lane" ? "codex" : "fixture"]));
  const args = Object.entries(values).flatMap(([key, value]) => [`--${key}`, value]);
  assert.equal(argumentsFor({ args, run: true, probe: "S2-load", ticket: 838 }).driver.lane, "codex");
  assert.throws(() => argumentsFor({ args, run: true, probe: "S2-outages", ticket: 837 }), /Claude Code lane/);
  assert.throws(() => argumentsFor({ args, run: true }), /Claude Code lane/);
  assert.equal(argumentsFor({ args: ["--dry-run", "--driver-lane", "codex", "--driver-model", "fixture"] }).driver.lane, "codex");
});

test("explicit expectation version is parsed, and dynamic discovery is rejected", () => {
  const values = Object.fromEntries(["approved-head", ...RUN_ARGS, ...DRIVER_ARGS].map((key) => [key, key === "driver-lane" ? "codex" : "fixture"]));
  const toArgs = (entries) => Object.entries(entries).flatMap(([key, value]) => [`--${key}`, value]);
  const parsed = argumentsFor({ args: toArgs({ ...values, "expectations-version": "2" }), run: true, probe: "S2-load", ticket: 838 });
  assert.equal(parsed.expectationsVersion, 2);

  assert.throws(
    () => argumentsFor({ args: toArgs({ ...values, "expectations-version": "latest" }), run: true, probe: "S2-load", ticket: 838 }),
    /never discover expectations version 'latest' dynamically/,
  );
  assert.throws(
    () => argumentsFor({ args: toArgs({ ...values, "expectations-version": "0" }), run: true, probe: "S2-load", ticket: 838 }),
    /positive integer/,
  );
});

test("the once-marker must be in the one pinned Stage 2 control directory", () => {
  const home = mkdtempSync(join(tmpdir(), "stage-2-home-fixture-"));
  try {
    assert.equal(controlDirectory({ home }), join(home, ".bloodtrail", "stage-2", "once-markers"));
    mkdirSync(controlDirectory({ home }), { recursive: true });
    mkdirSync(join(home, "fresh"));
    assert.doesNotThrow(() => assertControlDirectory({ path: join(controlDirectory({ home }), "run-1"), home }));
    assert.throws(() => assertControlDirectory({ path: join(home, "fresh", "run-1"), home }), /Stage 2 control directory/, "a fresh directory cannot reset the count");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
