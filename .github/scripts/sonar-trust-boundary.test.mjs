import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(new URL("../workflows/ci.yml", import.meta.url), "utf8");

function jobHeader(source, name) {
  const block = source.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][\\w-]*:|$(?![\\s\\S]))`, "m"));
  assert.ok(block, `job ${name} exists`);
  return block[1].split(/^    steps:/m)[0];
}

function conditionFor(source) {
  const header = jobHeader(source, "sonar");
  const condition = header.match(/^    if: (.+)(?:\n((?:      .+\n)*))?/m);
  if (!condition) return "true"; // GitHub schedules an unconditional job.
  const expression = condition[1] === ">-" ? condition[2].trim() : condition[1];
  return expression.replace(/^\$\{\{\s*|\s*\}\}$/g, "");
}

function context({
  actor = "maintainer",
  author = "contributor",
  head = "owner/repo",
  eventName = "pull_request",
  vars = {},
} = {}) {
  return {
    // GitHub resolves an unset repository variable to an empty string.
    vars: new Proxy(vars, { get: (target, name) => target[name] ?? "" }),
    github: {
      actor,
      repository: "owner/repo",
      event_name: eventName,
      event: eventName === "pull_request"
        ? { pull_request: { user: { login: author }, head: { repo: { full_name: head } } } }
        : {},
    },
  };
}

function runs(source, event) {
  return runInNewContext(conditionFor(source), event, { timeout: 1000 });
}

const cases = [
  ["main push", { eventName: "push" }, true],
  ["trusted PR", {}, true],
  ["fork PR", { head: "contributor/fork" }, false],
  ["Dependabot actor", { actor: "dependabot[bot]" }, false],
  ["Dependabot PR updated by a maintainer", { author: "dependabot[bot]" }, false],
  ["Dependabot actor and author", { actor: "dependabot[bot]", author: "dependabot[bot]" }, false],
];

for (const [name, event, expected] of cases) {
  test(`Sonar scheduling: ${name}`, () => {
    assert.equal(runs(workflow, context(event)), expected);
  });
}

// #963: SONAR_ANALYSIS=disabled pauses analysis for trusted events. Any other
// value, including unset, must run it, so a lost setting cannot fail open.
const disabled = { SONAR_ANALYSIS: "disabled" };
const switchCases = [
  ["disabled main push skips", { eventName: "push", vars: disabled }, false],
  ["disabled trusted PR skips", { vars: disabled }, false],
  ["disabled fork PR still skips", { head: "contributor/fork", vars: disabled }, false],
  ["unset variable runs a main push", { eventName: "push" }, true],
  ["unset variable runs a trusted PR", {}, true],
  ["empty variable runs", { vars: { SONAR_ANALYSIS: "" } }, true],
  ["enabled runs", { vars: { SONAR_ANALYSIS: "enabled" } }, true],
  ["a near-miss value runs", { vars: { SONAR_ANALYSIS: "Disabled" } }, true],
  ["untrusted PR with the default still skips", { actor: "dependabot[bot]" }, false],
];

for (const [name, event, expected] of switchCases) {
  test(`Sonar analysis switch: ${name}`, () => {
    assert.equal(runs(workflow, context(event)), expected);
  });
}

test("removing the analysis switch makes a disabled trusted event run", () => {
  const predicate = "vars.SONAR_ANALYSIS != 'disabled'";
  assert.ok(conditionFor(workflow).includes(predicate), `missing switch predicate: ${predicate}`);
  assert.equal(runs(workflow.replace(predicate, "true"), context({ vars: disabled })), true);
  assert.equal(runs(workflow.replace(predicate, "true"), context({ eventName: "push", vars: disabled })), true);
});

test("removing the job guard reproduces scheduling analysis without secrets", () => {
  const unguarded = workflow.replace(/^    if: >-\n(?:      .+\n)+/m, "");
  assert.equal(runs(unguarded, context({ actor: "dependabot[bot]" })), true);
  assert.equal(runs(unguarded, context({ head: "contributor/fork" })), true);
});

test("each trust predicate prevents a distinct untrusted event from running", () => {
  const mutations = [
    ["github.actor != 'dependabot[bot]'", { actor: "dependabot[bot]" }],
    ["github.event.pull_request.user.login != 'dependabot[bot]'", { author: "dependabot[bot]" }],
    ["github.event.pull_request.head.repo.full_name == github.repository", { head: "contributor/fork" }],
  ];
  for (const [predicate, event] of mutations) {
    assert.ok(conditionFor(workflow).includes(predicate), `missing trust predicate: ${predicate}`);
    assert.equal(runs(workflow.replace(predicate, "true"), context(event)), true);
  }
});

test("untrusted events retain static and mutation checks", () => {
  for (const job of ["ci", "sdk", "contract", "design-pattern-governance", "coverage"]) {
    assert.doesNotMatch(jobHeader(workflow, job), /^    if:/m, `${job} must stay unconditional`);
  }
});
