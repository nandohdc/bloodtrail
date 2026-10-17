import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../lib/io.mjs";
import { runApprovedSession } from "../lib/orchestrate.mjs";
import { preflightFixture, setApproval } from "./approval-fixture.mjs";

async function withAuthorization({ ticket, suffix = "", lineEnding = "\n" }, fn) {
  const directory = mkdtempSync(join(tmpdir(), "pd-authorization-"));
  try {
    const fixture = preflightFixture({ directory });
    const body = `  S1 approval: P-D run 1 for #${ticket} at ${fixture.options.approvedHead}  ${lineEnding}${suffix}`;
    setApproval({ options: fixture.options, body });
    fixture.options["approval-url"] = `https://github.com/nandohdc/bloodtrail/issues/${ticket}#issuecomment-1`;
    return await fn({ ...fixture, probe: "P-D", ticket }, body);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

const REFUSALS = [
  ["wrong issue", 801, "", (f) => { f.options["approval-url"] = f.options["approval-url"].replace("/801#", "/802#"); }, /probe ticket/],
  ["wrong PR", 801, "", (f) => { f.options["approval-url"] = "https://github.com/nandohdc/bloodtrail/pull/802#issuecomment-1"; }, /probe ticket/],
  ["800 delegation", 800, "Delegated S1 under G39", () => {}, /G39 delegation does not cover this ticket/],
  ["outside delegation", 805, "Delegated S1 under G39", () => {}, /G39 delegation does not cover this ticket/],
  ["missing probe", 801, "", (f) => { delete f.probe; }, /probe is required/],
  ["missing ticket", 801, "", (f) => { delete f.ticket; }, /ticket is required/],
];
for (const [label, ticket, suffix, patch, reason] of REFUSALS) {
  test(`authorization ${label} refuses before claim, session and results`, () => withAuthorization({ ticket, suffix }, async (fixture) => {
    patch(fixture);
    let refusal;
    const outcome = await runApprovedSession({ ...fixture, session: () => assert.fail("must not invoke session or pipeline"), failure: () => assert.fail("must not claim"), refuse: (text) => { refusal = text; } });
    assert.equal(outcome.exitCode, 1);
    assert.match(refusal, reason);
    assert.equal(existsSync(fixture.options["once-marker"]), false);
    assert.equal(existsSync(fixture.options.results), false);
  }));
}

const AUTHORIZATIONS = [
  [801, "  Delegated S1 under G39  ", "G39", "\r\n"],
  [802, "Delegated S1 under G39", "G39", "\n"],
  [803, "Delegated S1 under G39", "G39", "\n"],
  [804, "Delegated S1 under G39", "G39", "\n"],
  [801, "", null, "\n"],
  [801, "Delegated S1 under G39 extra", null, "\n"],
];
for (const [ticket, suffix, delegation, lineEnding] of AUTHORIZATIONS) {
  test(`authorization ${ticket} records ${JSON.stringify(suffix)} with original body hash`, () => withAuthorization({ ticket, suffix, lineEnding }, async (fixture, body) => {
    if (lineEnding === "\r\n") assert.notEqual(sha256(body), sha256(body.replaceAll("\r\n", "\n")));
    const outcome = await runApprovedSession({ ...fixture,
      session: (approval) => {
        assert.equal(approval.delegation, delegation);
        assert.equal(approval.body_sha256, fixture.options["approval-sha256"]);
        return { exitCode: 0 };
      }, failure: () => assert.fail("must accept"), refuse: (text) => assert.fail(text),
    });
    assert.equal(outcome.exitCode, 0);
    assert(existsSync(fixture.options["once-marker"]));
    assert.equal(existsSync(fixture.options.results), false);
  }));
}
