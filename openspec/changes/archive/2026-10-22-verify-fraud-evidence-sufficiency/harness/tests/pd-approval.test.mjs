import assert from "node:assert/strict";
import { test } from "node:test";
import { approvalRecord } from "../lib/approval.mjs";
import { sha256 } from "../lib/io.mjs";

const HEAD = "a".repeat(40);
const CREATED = "2026-10-17T02:22:47Z";
const BODY = `S1 approval: P-D run 2 for #801 at ${HEAD}`;
const defaults = () => ({ body: BODY, url: "https://github.com/nandohdc/bloodtrail/issues/801#issuecomment-2", createdAt: CREATED, updatedAt: CREATED, bodySha256: sha256(BODY), approvedHead: HEAD, runNumber: 2, windowOpenedAt: CREATED, now: Date.parse(CREATED) + 1000, probe: "P-D", ticket: 801 });
const WRONG = [
  ["probe", (args) => { args.probe = "P-ids"; }, /approval line/],
  ["ticket", (args) => { args.ticket = 800; }, /approval line/],
  ["head", (args) => { args.approvedHead = "b".repeat(40); }, /approval line/],
  ["edited", (args) => { args.updatedAt = "2026-10-17T02:22:48Z"; }, /edited/],
  ["expired", (args) => { args.now += 7 * 86400000; }, /expired/],
  ["hash", (args) => { args.bodySha256 = "0".repeat(64); }, /sha256/],
];
for (const [label, patch, message] of WRONG) {
  test(`P-D approval rejects wrong ${label}`, () => {
    const args = defaults(); patch(args);
    assert.throws(() => approvalRecord(args), message);
  });
}

const DELEGATION = [["\nDelegated S1 under G39", "G39"], ["", null], ["\n Delegated S1 under G39", "G39"], ["\nDelegated S1 under G39 extra", null]];
for (const [suffix, expected] of DELEGATION) {
  test(`P-D delegation is recorded only for an exact line: ${JSON.stringify(suffix)}`, () => {
    const body = BODY + suffix;
    assert.equal(approvalRecord({ ...defaults(), body, bodySha256: sha256(body) }).delegation, expected);
  });
}

test("P-ids explicit approval retains P-ids/800 and no delegation", () => {
  const args = defaults();
  const body = BODY.replace("P-D", "P-ids").replace("#801", "#800");
  args.probe = "P-ids"; args.ticket = 800;
  args.url = args.url.replace("/801#", "/800#");
  assert.equal(approvalRecord({ ...args, body, bodySha256: sha256(body) }).delegation, null);
});
