import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../lib/io.mjs";
import { runPmap } from "../p-map/roles.mjs";
import { preflightFixture, setApproval } from "./approval-fixture.mjs";

export const OPENED = "2026-10-17T02:22:47Z";
export const HEAD = "a".repeat(40);
export const APPROVAL_URL = "https://github.com/nandohdc/bloodtrail/issues/804#issuecomment-804";
export const approvalBody = (head) => `S1 approval: P-map run 5 for #804 at ${head}\nDelegated S1 under G39`;
export function approvalArgs() {
  const body = approvalBody(HEAD);
  return { body, bodySha256: sha256(body), url: APPROVAL_URL, probe: "P-map", ticket: 804,
    approvedHead: HEAD, runNumber: 5, createdAt: OPENED, updatedAt: OPENED,
    windowOpenedAt: OPENED, now: Date.parse(OPENED) + 1000 };
}

export async function capturedPlan() {
  let plan;
  const result = await runPmap({ entrypoint: "fixture-entry", runner: async (input) => {
    plan = input;
    return { exitCode: 0 };
  } });
  return { plan, result };
}

export async function withApproved(work) {
  const directory = mkdtempSync(join(tmpdir(), "p-map-approval-"));
  try {
    const fixture = preflightFixture({ directory });
    Object.assign(fixture.options, { "approval-url": APPROVAL_URL, "approval-created-at": OPENED,
      "approval-updated-at": OPENED, "window-opened-at": OPENED, "run-number": "5" });
    setApproval({ options: fixture.options, body: approvalBody(fixture.options.approvedHead) });
    return await work({ ...fixture, probe: "P-map", ticket: 804, now: Date.parse(OPENED) + 1000 });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
