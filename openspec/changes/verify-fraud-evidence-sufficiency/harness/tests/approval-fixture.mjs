import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { command, sha256 } from "../lib/io.mjs";
import { CHANGE } from "../lib/results.mjs";

export const CREATED = "2026-10-16T00:00:00.000Z";
export const NOW = Date.parse(CREATED) + 1000;
export const APPROVAL_URL = "https://github.com/nandohdc/bloodtrail/issues/800#issuecomment-1";
export const approvalBody = ({ head, run = 1 }) => `S1 approval: P-ids run ${run} for #800 at ${head}`;

export function setApproval({ options, body = approvalBody({ head: options.approvedHead }) }) {
  writeFileSync(options["approval-body-file"], body);
  options["approval-sha256"] = sha256(body);
  options["once-marker"] = join(options.control, sha256(body));
}

export function preflightFixture({ directory }) {
  const repo = join(directory, "repo");
  const harness = join(repo, CHANGE, "harness");
  mkdirSync(join(harness, "lib"), { recursive: true });
  const script = join(harness, "fixture.mjs");
  writeFileSync(script, "// fixture entrypoint: never executed\n");
  writeFileSync(join(harness, "lib/parent.mjs"), "// parent fixture\n");
  const git = (args) => command({ program: "git", args, cwd: repo }).trim();
  git(["init", "-q"]);
  git(["add", `${CHANGE}/harness/fixture.mjs`, `${CHANGE}/harness/lib/parent.mjs`]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture", "-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]);
  const options = {
    repo, approvedHead: git(["rev-parse", "HEAD"]), control: directory,
    "approval-body-file": join(directory, "body"), "approval-url": APPROVAL_URL,
    "approval-created-at": CREATED, "approval-updated-at": CREATED,
    "window-opened-at": CREATED, "run-number": "1", results: join(directory, "results.json"),
  };
  setApproval({ options });
  return { options, entrypoint: pathToFileURL(script).href, now: NOW };
}
