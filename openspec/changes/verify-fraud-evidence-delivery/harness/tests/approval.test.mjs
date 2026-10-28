import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { approvalFromArgs, approvalRecord, claimOnce, LAST_SLOT, SLOT_TICKETS } from "../lib/approval.mjs";
import { argumentsFor, DRIVER_ARGS, RUN_ARGS } from "../lib/arguments.mjs";
import { sha256 } from "../lib/io.mjs";
import { assertControlDirectory, controlDirectory, markerDestination } from "../lib/preflight.mjs";

const HEAD = "1".repeat(40);
const CREATED = "2026-10-23T00:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;
const URL = "https://github.com/nandohdc/bloodtrail/issues/836#issuecomment-1";
const line = ({ run = 1, ticket = 836, head = HEAD } = {}) => `S1 approval: S2-tracer run ${run} for #${ticket} at ${head}`;

function validDisposition({ probe = "S2-tracer", ticket = 836, run = 13 } = {}) {
  const body = `Owner disposition: ${probe} run ${run} for #${ticket}\nauthorized under G46`;
  return {
    body, bodySha256: sha256(body), url: `https://github.com/nandohdc/bloodtrail/issues/${ticket}#issuecomment-99`,
    createdAt: CREATED, updatedAt: CREATED,
  };
}

function approval(patch = {}) {
  const ticket = patch.ticket ?? 836;
  const body = patch.body ?? `${line({ run: patch.runNumber, ticket })}\nDelegated S1 under G44\nopaque Ω`;
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

test("G46: runs 1 to 16 are inside the shared authorization; run 17 is not", () => {
  assert.equal(approvalRecord(approval({ runNumber: 16, body: line({ run: 16 }), disposition: validDisposition({ run: 16 }) })).delegation, null);
  assert.throws(() => approvalRecord(approval({ runNumber: 17, body: line({ run: 17 }) })), /run number outside shared authorization/);
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
    assert.deepEqual(destination(13), {
      name: "run-13",
      prior_claims: [
        "run-1", "run-2", "run-3", "run-4", "run-5", "run-6",
        "run-7", "run-8", "run-9", "run-10", "run-11", "run-12",
      ],
      window_recorded_by_prior_claims: CREATED,
    });
    for (let run = 13; run <= 15; run += 1) writeFileSync(join(control, `run-${run}`), claimed);
    assert.deepEqual(destination(16), {
      name: "run-16",
      prior_claims: [
        "run-1", "run-2", "run-3", "run-4", "run-5", "run-6",
        "run-7", "run-8", "run-9", "run-10", "run-11", "run-12",
        "run-13", "run-14", "run-15",
      ],
      window_recorded_by_prior_claims: CREATED,
    });
    writeFileSync(join(control, "run-16"), claimed);
    assert.throws(() => destination(17), /the G42 run limit, as amended by G46, is already spent/);
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

test("probe runs require the Claude Code lane (G46 Q94); Codex is accepted only for build-only checks", () => {
  const values = Object.fromEntries(["approved-head", ...RUN_ARGS, ...DRIVER_ARGS].map((key) => [key, key === "driver-lane" ? "codex" : "fixture"]));
  const args = Object.entries(values).flatMap(([key, value]) => [`--${key}`, value]);
  assert.throws(() => argumentsFor({ args, run: true, probe: "S2-load", ticket: 838 }), /G46 Q94/);
  assert.throws(() => argumentsFor({ args, run: true, probe: "S2-outages", ticket: 837 }), /Claude Code lane/);
  assert.throws(() => argumentsFor({ args, run: true }), /Claude Code lane/);
  assert.equal(argumentsFor({ args: ["--dry-run", "--driver-lane", "codex", "--driver-model", "fixture"] }).driver.lane, "codex");
});

test("explicit expectation version is parsed, and dynamic discovery is rejected", () => {
  const values = Object.fromEntries(["approved-head", ...RUN_ARGS, ...DRIVER_ARGS].map((key) => [key, key === "driver-lane" ? "claude-code" : "fixture"]));
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

test("a run whose ticket mismatches its slot is refused", () => {
  assert.throws(
    () => approvalRecord(approval({ runNumber: 1, ticket: 837 })),
    /run 1 is the slot for #836 \(G46, Q74\)/,
  );
  assert.throws(
    () => approvalRecord(approval({ runNumber: 2, ticket: 836 })),
    /run 2 is the slot for #837 \(G46, Q74\)/,
  );
  assert.throws(
    () => approvalRecord(approval({ runNumber: 8, ticket: 836, probe: "S2-tracer" })),
    /run 8 is the slot for #840 \(G46, Q74\)/,
  );
});

test("table-driven: each run 1–12 in SLOT_TICKETS passes with its own ticket and is refused with a different ticket", () => {
  for (const [slotRun, slotTicket] of Object.entries(SLOT_TICKETS)) {
    const run = Number(slotRun);
    const passBody = `S1 approval: S2-tracer run ${run} for #${slotTicket} at ${HEAD}`;
    const record = approvalRecord(approval({
      runNumber: run,
      ticket: slotTicket,
      probe: "S2-tracer",
      url: `https://github.com/nandohdc/bloodtrail/issues/${slotTicket}#issuecomment-1`,
      body: passBody,
      bodySha256: sha256(passBody),
    }));
    assert.equal(record.disposition, null);

    const wrongTicket = slotTicket === 836 ? 837 : 836;
    const failBody = `S1 approval: S2-tracer run ${run} for #${wrongTicket} at ${HEAD}`;
    assert.throws(
      () => approvalRecord(approval({
        runNumber: run,
        ticket: wrongTicket,
        probe: "S2-tracer",
        url: `https://github.com/nandohdc/bloodtrail/issues/${wrongTicket}#issuecomment-1`,
        body: failBody,
        bodySha256: sha256(failBody),
      })),
      new RegExp(`run ${run} is the slot for #${slotTicket} \\(G46, Q74\\)`),
    );
  }
});

test("run 13 without a disposition is refused", () => {
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }) })),
    /reserve runs require an owner disposition \(G46, Q68\)/,
  );
});

test("run 13 with a delegated or edited disposition, a wrong hash, or the wrong ticket is refused", () => {
  const base = validDisposition({ run: 13 });
  const delegatedBody = `${base.body}\nDelegated S1 under G44`;
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, body: delegatedBody, bodySha256: sha256(delegatedBody) } })),
    /owner disposition cannot be delegated \(G46, Q68\)/,
  );
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, updatedAt: "2026-10-23T00:00:01.000Z" } })),
    /edited disposition is invalid \(G46, Q68\)/,
  );
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, bodySha256: "0".repeat(64) } })),
    /disposition body sha256 mismatch \(G46, Q68\)/,
  );
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: validDisposition({ run: 13, ticket: 837 }) })),
    /disposition URL must name the probe ticket \(G46, Q68\)/,
  );
  const wrongTicketBody = "Owner disposition: S2-tracer run 13 for #837";
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, body: wrongTicketBody, bodySha256: sha256(wrongTicketBody) } })),
    /missing owner disposition line \(G46, Q68\)/,
  );
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, createdAt: undefined } })),
    /incomplete disposition record \(G46, Q68\)/,
  );
  const wrongProbeBody = "Owner disposition: S2-outages run 13 for #836";
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, body: wrongProbeBody, bodySha256: sha256(wrongProbeBody) } })),
    /missing owner disposition line \(G46, Q68\)/,
  );
  const wrongRunBody = "Owner disposition: S2-tracer run 12 for #836";
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, body: wrongRunBody, bodySha256: sha256(wrongRunBody) } })),
    /missing owner disposition line \(G46, Q68\)/,
  );
  const beforeWindow = { ...base, createdAt: "2026-10-22T23:59:59.000Z", updatedAt: "2026-10-22T23:59:59.000Z" };
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: beforeWindow })),
    /disposition predates window \(G46, Q68\)/,
  );
  const afterS1 = { ...base, createdAt: "2026-10-23T00:00:01.000Z", updatedAt: "2026-10-23T00:00:01.000Z" };
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: afterS1 })),
    /disposition created after S1 \(G46, Q68\)/,
  );
});

test("a disposition containing 'delegated under G44' in lowercase is refused", () => {
  const base = validDisposition({ run: 13 });
  const lowercaseDelegatedBody = `${base.body}\ndelegated under G44`;
  assert.throws(
    () => approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: { ...base, body: lowercaseDelegatedBody, bodySha256: sha256(lowercaseDelegatedBody) } })),
    /owner disposition cannot be delegated \(G46, Q68\)/,
  );
});

test("run 13 with a valid disposition passes and records it", () => {
  const disp = validDisposition({ run: 13 });
  const record = approvalRecord(approval({ runNumber: 13, body: line({ run: 13 }), disposition: disp }));
  assert.deepEqual(record.disposition, {
    url: disp.url,
    created_at: disp.createdAt,
    body_sha256: disp.bodySha256,
  });
  assert.equal(approvalRecord(approval({ runNumber: 1 })).disposition, null);
});

test("runs 8–12 with the right ticket pass", () => {
  const slots = [
    { run: 8, ticket: 840, probe: "S2-chains" },
    { run: 9, ticket: 842, probe: "S2-outbox" },
    { run: 10, ticket: 841, probe: "S2-counts" },
    { run: 11, ticket: 841, probe: "S2-counts" },
    { run: 12, ticket: 841, probe: "S2-counts" },
  ];
  for (const { run, ticket, probe } of slots) {
    const probeLine = `S1 approval: ${probe} run ${run} for #${ticket} at ${HEAD}`;
    const record = approvalRecord(approval({
      runNumber: run,
      ticket,
      probe,
      url: `https://github.com/nandohdc/bloodtrail/issues/${ticket}#issuecomment-1`,
      body: probeLine,
    }));
    assert.equal(record.delegation, null);
    assert.equal(record.disposition, null);
  }
});

test("a disposition supplied for a slot run is validated and recorded", () => {
  const disp = validDisposition({ probe: "S2-counts", ticket: 841, run: 10 });
  const body = `S1 approval: S2-counts run 10 for #841 at ${HEAD}`;
  const record = approvalRecord(approval({
    runNumber: 10,
    ticket: 841,
    probe: "S2-counts",
    url: "https://github.com/nandohdc/bloodtrail/issues/841#issuecomment-1",
    body,
    bodySha256: sha256(body),
    disposition: disp,
  }));
  assert.deepEqual(record.disposition, {
    url: disp.url,
    created_at: disp.createdAt,
    body_sha256: disp.bodySha256,
  });
  const invalidDisp = { ...disp, updatedAt: "2026-10-23T00:00:01.000Z" };
  assert.throws(
    () => approvalRecord(approval({
      runNumber: 10,
      ticket: 841,
      probe: "S2-counts",
      url: "https://github.com/nandohdc/bloodtrail/issues/841#issuecomment-1",
      body,
      bodySha256: sha256(body),
      disposition: invalidDisp,
    })),
    /edited disposition is invalid \(G46, Q68\)/,
  );
});

test("approvalFromArgs reads disposition arguments when present", () => {
  const directory = mkdtempSync(join(tmpdir(), "stage-2-disp-fixture-"));
  const approvalFile = join(directory, "approval.txt");
  const dispFile = join(directory, "disposition.txt");
  try {
    const approvalBody = line({ run: 13 });
    const disp = validDisposition({ run: 13 });
    writeFileSync(approvalFile, approvalBody);
    writeFileSync(dispFile, disp.body);
    const options = {
      "approval-body-file": approvalFile,
      "approval-url": URL,
      "approval-created-at": CREATED,
      "approval-updated-at": CREATED,
      "approval-sha256": sha256(approvalBody),
      approvedHead: HEAD,
      "run-number": "13",
      "window-opened-at": CREATED,
      "disposition-body-file": dispFile,
      "disposition-url": disp.url,
      "disposition-created-at": disp.createdAt,
      "disposition-updated-at": disp.updatedAt,
      "disposition-sha256": disp.bodySha256,
    };
    const record = approvalFromArgs({ options, probe: "S2-tracer", ticket: 836, now: Date.parse(CREATED) + 1000 });
    assert.deepEqual(record.disposition, {
      url: disp.url,
      created_at: disp.createdAt,
      body_sha256: disp.bodySha256,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("SLOT_TICKETS deep-equals the ledger's runs 1–7 and G46 Q74's slots 8–12", () => {
  assert.deepEqual(SLOT_TICKETS, {
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
  assert.equal(LAST_SLOT, 12);
});
