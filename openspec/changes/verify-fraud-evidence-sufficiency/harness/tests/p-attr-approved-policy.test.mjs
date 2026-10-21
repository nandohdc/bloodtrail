import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fieldPolicy, POLICY_FILE, verifiedPolicies, withPolicies, withPolicySource } from "../p-attr/policy.mjs";
import { evaluateProbe } from "../p-attr/evaluate.mjs";
import { evaluateWithGuard } from "../lib/probe-runner.mjs";
import { withTarget } from "./p-attr-analysis-fixtures.mjs";

const PROTECTED = { path: "actor.id", authority: "authenticated_identity", trust: "authoritative_server" };
const CLAIMED = { ...PROTECTED, authority: "client_claim", trust: "client_claim" };
const PLAN = { evaluate: evaluateProbe };

function git(repo, args) {
  return execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture-opaque", ...args], { cwd: repo, encoding: "utf8" }).trim();
}
function commitPolicy(repo, entry) {
  writeFileSync(join(repo, POLICY_FILE), `${JSON.stringify([entry])}\n`);
  git(repo, ["add", POLICY_FILE]);
  git(repo, ["-c", "commit.gpgsign=false", "commit", "-qm", "fixture policy"]);
  return { repo, approvedHead: git(repo, ["rev-parse", "HEAD"]) };
}
function checkout(root, name, entry) {
  const repo = join(root, name);
  mkdirSync(dirname(join(repo, POLICY_FILE)), { recursive: true });
  git(repo, ["init", "-q"]);
  return commitPolicy(repo, entry);
}
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "p-attr-approved-policy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = checkout(root, "first", PROTECTED);
  const second = checkout(root, "second", CLAIMED);
  return { root, first, second };
}
function evaluate(source) {
  const observations = [{ records: [withTarget({ id: "AF-fixture", path: "actor.id" })], public_calls: [] }];
  const result = evaluateWithGuard({ plan: PLAN,
    context: { evaluationSource: source, expectations: { cases: [], declared_join_pairs: [], linkage_expectations: {} } },
    observations, invalidations: [],
  });
  return { result, observations };
}
function reasons(result) {
  return result.cases.verdict.findings.accepted_misrepresenting_carriers[0].reasons;
}

test("runner evaluation receives the requested checkout and head, independent of cwd and prior evaluation", (t) => {
  const { first, second } = fixture(t);
  const cwd = process.cwd();
  try {
    process.chdir(second.repo);
    const protectedResult = evaluate(first).result;
    const claimedResult = evaluate(second).result;
    assert.deepEqual(protectedResult.invalidations, []);
    assert.deepEqual(claimedResult.invalidations, []);
    assert(reasons(protectedResult).includes("provenance ambiguity"));
    assert(!reasons(claimedResult).includes("provenance ambiguity"));
    assert(reasons(evaluate(first).result).includes("provenance ambiguity"));
  } finally { process.chdir(cwd); }
});

test("same-root head changes and repeated evaluations reverify bytes rather than reuse a cached map", (t) => {
  const { first } = fixture(t);
  assert.equal(verifiedPolicies(first).get("actor.id").trust, PROTECTED.trust);
  const next = commitPolicy(first.repo, CLAIMED);
  assert.notEqual(next.approvedHead, first.approvedHead);
  assert.equal(withPolicySource(next, () => fieldPolicy("actor.id").trust), CLAIMED.trust);
  assert.throws(() => verifiedPolicies(first), /field policy bytes differ from approved head/);
  writeFileSync(join(next.repo, POLICY_FILE), `${JSON.stringify([PROTECTED])}\n`);
  assert.throws(() => verifiedPolicies(next), /field policy bytes differ from approved head/);
});

test("dirty policy is an evaluation invalidation, with every original observation still intact", (t) => {
  const { first } = fixture(t);
  assert.deepEqual(evaluate(first).result.invalidations, []);
  // Whitespace drift is enough: compare bytes, not only parsed JSON.
  writeFileSync(join(first.repo, POLICY_FILE), `${JSON.stringify([PROTECTED])} \n`);
  const { result, observations } = evaluate(first);
  assert.deepEqual(result.cases, { evaluations: [], verdict: null });
  assert.deepEqual(result.invalidations, [{ message: "evaluation fault: field policy bytes differ from approved head", attribution: "harness_fault" }]);
  assert.equal(observations[0].records[0].step_id, "AF-fixture/main");
  assert.equal(observations[0].records[0].events.length, 1);
});

test("wrong root, incomplete source and symbolic heads cannot silently fall back to the importing checkout", (t) => {
  const { root, first, second } = fixture(t);
  assert.throws(() => verifiedPolicies({ ...first, repo: root }), /ENOENT/);
  assert.throws(() => verifiedPolicies({ ...second, approvedHead: first.approvedHead }));
  assert.throws(() => verifiedPolicies({ ...first, approvedHead: "HEAD" }), /exact approved head/);
  assert.throws(() => verifiedPolicies({ ...first, repo: "." }), /absolute approved repository root/);
  assert.throws(() => withPolicySource({}, () => fieldPolicy("actor.id")), /absolute approved repository root/);
});

test("sandboxed offline analysis can inject verified policy without reading a contract file or spawning Git", (t) => {
  const { root, first } = fixture(t);
  const policies = verifiedPolicies(first);
  const service = join(root, "service");
  mkdirSync(service);
  writeFileSync(join(service, "policy.mjs"), readFileSync(new URL("../p-attr/policy.mjs", import.meta.url)));
  writeFileSync(join(service, "fixture.mjs"), `import { fieldPolicy, withPolicies } from "./policy.mjs";
const policies = new Map(${JSON.stringify([...policies])});
process.stdout.write(withPolicies(policies, () => fieldPolicy("actor.id").trust));\n`);
  const output = execFileSync(process.execPath, ["--permission", `--allow-fs-read=${service}`, join(service, "fixture.mjs")], { encoding: "utf8" });
  assert.equal(output, PROTECTED.trust);
  assert.equal(withPolicies(policies, () => fieldPolicy("actor.id").trust), PROTECTED.trust);
});
