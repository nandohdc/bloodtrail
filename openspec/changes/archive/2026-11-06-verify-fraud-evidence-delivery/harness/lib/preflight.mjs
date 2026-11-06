import assert from "node:assert/strict";
import { accessSync, constants, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { approvedRepository } from "./kit-pipeline.mjs";
import { executingCheckout, harnessInventory } from "./repository.mjs";
import { CHANGE, RUN_LIMIT } from "./results.mjs";
import { assertRuntimePrerequisites } from "./runtime-facts.mjs";

function assertAbsent(path) {
  try {
    lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("results path already exists");
}

export function resultsDestination({ path }) {
  assertAbsent(path);
  const parent = dirname(path);
  assert(statSync(parent).isDirectory(), "results parent must be a directory");
  accessSync(parent, constants.W_OK);
}

const RUN_MARKER = /^run-[0-9]+$/;

// The one control directory every Stage 2 run claims in, on the G42 workstation. It is pinned, so a fresh
// directory cannot reset the run count or the window; the run ledger in the repository is the cross-check.
export function controlDirectory({ home = homedir() } = {}) {
  return join(home, ".bloodtrail", "stage-2", "once-markers");
}

export function assertControlDirectory({ path, home }) {
  assert.equal(realpathSync(dirname(path)), realpathSync(controlDirectory({ home })), "the once-marker must be in the Stage 2 control directory");
}

// The G42 window every earlier claim recorded (marker line 3). The first claim declares it; every later
// run must pass the same opening, so no run can restart the 14 days.
function recordedWindow({ parent, prior }) {
  const windows = new Set(prior.map((name) => readFileSync(join(parent, name), "utf8").split("\n")[2]));
  assert(windows.size <= 1, "earlier claims record different G42 windows");
  return [...windows][0] ?? null;
}

// One marker per run number in one control directory shared by every Stage 2 probe. A run number is
// claimed at most once whatever approval names it, and with run numbers bounded by RUN_LIMIT the directory
// never holds more claims than G42 allows as amended by G46. The claims already made are returned for the results.
export function markerDestination({ path, repo, runNumber, windowOpenedAt }) {
  assert.equal(basename(path), `run-${runNumber}`, "once-marker basename must be run-<run number>");
  const parent = dirname(path);
  const rel = relative(realpathSync(repo), realpathSync(parent));
  const outside = rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  assert(outside, "once-marker parent must be outside repository");
  const prior = readdirSync(parent).filter((name) => RUN_MARKER.test(name)).sort((left, right) => Number(left.slice(4)) - Number(right.slice(4)));
  assert(!prior.includes(basename(path)), `run ${runNumber} is already claimed`);
  assert(prior.length < RUN_LIMIT, "the G42 run limit, as amended by G46, is already spent");
  const window = recordedWindow({ parent, prior });
  assert(window === null || window === windowOpenedAt, `the G42 window opened at ${window}, not ${windowOpenedAt}`);
  return { name: basename(path), prior_claims: prior, window_recorded_by_prior_claims: window };
}

export function sessionPreflight({ options, approval, entrypoint, runtimeCheck = assertRuntimePrerequisites }) {
  runtimeCheck();
  const approved = approvedRepository(options);
  executingCheckout({ entrypoint, repo: approved.repo });
  resultsDestination({ path: options.results });
  assertControlDirectory({ path: options["once-marker"] });
  const onceMarker = markerDestination({
    path: options["once-marker"], repo: approved.repo, runNumber: Number(options["run-number"]), windowOpenedAt: approval.window_opened_at,
  });
  return { hashes: harnessInventory({ ...approved, prefix: `${CHANGE}/harness` }), onceMarker };
}
