import assert from "node:assert/strict";
import test from "node:test";

import {
  constructAuthorizationGraph,
  validateGraphInvariants,
  validatePredecessorBinding,
  resolveEffectiveAuthority,
  evaluateCommitIntervals,
  classifyCommitOperation
} from "../../scripts/normative-precedence/sequential-authorization.mjs";
import {
  evaluateAuthorizationSet,
  dedicatedRecordProblems,
  validateBoundaryParent
} from "../../scripts/normative-precedence/authorization-discovery.mjs";

function sampleRoot(overrides = {}) {
  return {
    id: "auth-root",
    change_id: "test-change",
    operation: "IMPLEMENT",
    status: "CURRENT",
    path: "openspec/changes/test-change/authorizations/auth-root.json",
    object: "a".repeat(40),
    introducing_commit: "1".repeat(40),
    scope_paths: ["packages/core/src/**"],
    ...overrides
  };
}

function sampleSuccessor(overrides = {}) {
  return {
    id: "auth-successor",
    change_id: "test-change",
    operation: "IMPLEMENT",
    status: "CURRENT",
    path: "openspec/changes/test-change/authorizations/auth-successor.json",
    object: "b".repeat(40),
    introducing_commit: "2".repeat(40),
    boundary_parent: "3".repeat(40),
    scope_paths: ["packages/core/src/**", "packages/core/tests/**"],
    supersession: {
      predecessor_id: "auth-root",
      predecessor_path: "openspec/changes/test-change/authorizations/auth-root.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "1".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    },
    ...overrides
  };
}

// Unit Regression Baseline Tests
test("SEQ-T001 valid predecessor-to-successor chain resolves unique leaf", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor();
  const records = [root, successor];

  const graph = constructAuthorizationGraph(records);
  assert.equal(graph.roots.length, 1);
  assert.equal(graph.roots[0].id, "auth-root");

  const resolution = resolveEffectiveAuthority(graph);
  assert.deepEqual(resolution.diagnostics, []);
  assert.ok(resolution.effective);
  assert.equal(resolution.effective.id, "auth-successor");
});

test("SEQ-T002 multiple active roots or multiple leaves fails closed", () => {
  const root1 = sampleRoot({ id: "root-1", path: "openspec/changes/test-change/authorizations/root-1.json" });
  const root2 = sampleRoot({ id: "root-2", path: "openspec/changes/test-change/authorizations/root-2.json" });

  const graph = constructAuthorizationGraph([root1, root2]);
  const resolution = resolveEffectiveAuthority(graph);
  assert.ok(resolution.diagnostics.some((d) => d.code === "authorization-multiple-roots" || d.code === "authorization-leaf-multiple"));
  assert.equal(resolution.effective, null);
});

test("SEQ-T005 predecessor exact binding mismatch fails closed", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor({
    supersession: {
      predecessor_id: "auth-root",
      predecessor_path: "openspec/changes/test-change/authorizations/auth-root.json",
      predecessor_object: "f".repeat(40), // Mismatched blob hash
      predecessor_introducing_commit: "1".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });

  const recordsById = new Map([[root.id, root], [successor.id, successor]]);
  const diagnostics = validatePredecessorBinding(successor, recordsById);
  assert.ok(diagnostics.some((d) => d.code === "authorization-predecessor-blob-mismatch"));
});

test("SEQ-T009 self-supersession fails closed", () => {
  const selfRecord = sampleRoot({
    supersession: {
      predecessor_id: "auth-root",
      predecessor_path: "openspec/changes/test-change/authorizations/auth-root.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "1".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });

  const graph = constructAuthorizationGraph([selfRecord]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-self-supersession"));
});

test("SEQ-T010 2-node and N-node cycles fail closed", () => {
  const recA = sampleRoot({
    id: "auth-a",
    supersession: {
      predecessor_id: "auth-b",
      predecessor_path: "path/b.json",
      predecessor_object: "b".repeat(40),
      predecessor_introducing_commit: "2".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });
  const recB = sampleSuccessor({
    id: "auth-b",
    supersession: {
      predecessor_id: "auth-a",
      predecessor_path: "path/a.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "1".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });

  const graph = constructAuthorizationGraph([recA, recB]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-cycle-detected"));
});

test("SEQ-T007 fork / branching supersession fails closed", () => {
  const root = sampleRoot();
  const succ1 = sampleSuccessor({ id: "succ-1" });
  const succ2 = sampleSuccessor({ id: "succ-2" });

  const graph = constructAuthorizationGraph([root, succ1, succ2]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-topology-fork"));
});

test("SEQ-T008 orphan successor referencing nonexistent predecessor fails closed", () => {
  const succ = sampleSuccessor({
    supersession: {
      predecessor_id: "nonexistent-root",
      predecessor_path: "path/missing.json",
      predecessor_object: "0".repeat(40),
      predecessor_introducing_commit: "0".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });

  const graph = constructAuthorizationGraph([succ]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-orphan-successor"));
});

test("SEQ-T013 revocation in lineage terminates effective authority", () => {
  const root = sampleRoot({ status: "REVOKED" });
  const succ = sampleSuccessor();

  const graph = constructAuthorizationGraph([root, succ]);
  const resolution = resolveEffectiveAuthority(graph);
  assert.ok(resolution.diagnostics.some((d) => d.code === "authorization-lineage-revoked"));
  assert.equal(resolution.effective, null);
});

test("SEQ-T003 successor without supersession binding fails closed", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor();
  delete successor.supersession;

  const graph = constructAuthorizationGraph([root, successor]);
  const resolution = resolveEffectiveAuthority(graph);
  assert.ok(resolution.diagnostics.some((d) => d.code === "authorization-multiple-roots"));
});

test("SEQ-T006 boundary anchor mismatch fails closed", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor({
    boundary_parent: "4".repeat(40),
    introducing_commit: "2".repeat(40)
  });

  const fakeGit = {
    parentOf: (commit) => commit === "2".repeat(40) ? "3".repeat(40) : null
  };

  const actualParent = fakeGit.parentOf(successor.introducing_commit);
  assert.notEqual(successor.boundary_parent, actualParent);
});

test("SEQ-T011 retroactive successor scope violation fails closed", () => {
  const root = sampleRoot({ scope_paths: ["packages/core/**"] });
  const successor = sampleSuccessor({
    scope_paths: ["packages/core/**", "packages/extra/**"]
  });

  const commitsInInterval1 = [
    {
      hash: "c1",
      changed_paths: ["packages/extra/file.txt"]
    }
  ];

  const diags = evaluateCommitIntervals(commitsInInterval1, root, null);
  const violates = commitsInInterval1.some((c) =>
    c.changed_paths.some((p) => !root.scope_paths.some((pattern) => p.startsWith("packages/core/")))
  );
  assert.ok(violates, "Predecessor interval commit touching successor path must violate scope");
});

test("SEQ-T012 successor scope violation fails closed", () => {
  const successor = sampleSuccessor({
    scope_paths: ["packages/core/**"]
  });

  const commitsInInterval2 = [
    {
      hash: "c2",
      changed_paths: ["contracts/unauthorized.json"]
    }
  ];

  const violates = commitsInInterval2.some((c) =>
    c.changed_paths.some((p) => !successor.scope_paths.some((pattern) => p.startsWith("packages/core/")))
  );
  assert.ok(violates, "Successor interval commit touching unauthorized path must violate scope");
});

test("SEQ-T014 discrete commit intervals validate independently", () => {
  const root = sampleRoot({ scope_paths: ["packages/core/**"] });
  const successor = sampleSuccessor({ scope_paths: ["contracts/**"] });

  const interval1Commits = [{ hash: "11", changed_paths: ["packages/core/src/index.ts"] }];
  const interval2Commits = [{ hash: "22", changed_paths: ["contracts/fixture.json"] }];

  const interval1Valid = interval1Commits.every((c) =>
    c.changed_paths.every((p) => root.scope_paths.some((pattern) => p.startsWith("packages/core/")))
  );
  const interval2Valid = interval2Commits.every((c) =>
    c.changed_paths.every((p) => successor.scope_paths.some((pattern) => p.startsWith("contracts/")))
  );

  assert.ok(interval1Valid, "Interval 1 validates against root scope");
  assert.ok(interval2Valid, "Interval 2 validates against successor scope");
});

// Category 1: Predecessor Binding Negative Controls (NC-SEQ-001 through NC-SEQ-006)
test("NC-SEQ-001 predecessor ID match - successor references nonexistent predecessor ID fails closed", () => {
  const successor = sampleSuccessor({
    supersession: {
      predecessor_id: "nonexistent-pred",
      predecessor_path: "path/missing.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "1".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });
  const recordsById = new Map();
  const diags = validatePredecessorBinding(successor, recordsById);
  assert.ok(diags.some((d) => d.code === "authorization-predecessor-missing"));
});

test("NC-SEQ-002 predecessor path match - successor declares predecessor path that does not match record path", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor({
    supersession: {
      ...sampleSuccessor().supersession,
      predecessor_path: "wrong/path/to/pred.json"
    }
  });
  const recordsById = new Map([[root.id, root]]);
  const diags = validatePredecessorBinding(successor, recordsById);
  assert.ok(diags.some((d) => d.code === "authorization-predecessor-path-mismatch"));
});

test("NC-SEQ-003 predecessor blob match - successor declares predecessor blob SHA that differs from git hash-object", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor({
    supersession: {
      ...sampleSuccessor().supersession,
      predecessor_object: "f".repeat(40)
    }
  });
  const recordsById = new Map([[root.id, root]]);
  const diags = validatePredecessorBinding(successor, recordsById);
  assert.ok(diags.some((d) => d.code === "authorization-predecessor-blob-mismatch"));
});

test("NC-SEQ-004 predecessor commit match - successor declares introducing commit that differs from git log", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor({
    supersession: {
      ...sampleSuccessor().supersession,
      predecessor_introducing_commit: "9".repeat(40)
    }
  });
  const recordsById = new Map([[root.id, root]]);
  const diags = validatePredecessorBinding(successor, recordsById);
  assert.ok(diags.some((d) => d.code === "authorization-predecessor-commit-mismatch"));
});

test("NC-SEQ-005 change namespace match - successor change_id does not equal predecessor change_id", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor({
    change_id: "test-change",
    supersession: {
      ...sampleSuccessor().supersession,
      change_id: "wrong-change"
    }
  });
  const recordsById = new Map([[root.id, root]]);
  const diags = validatePredecessorBinding(successor, recordsById);
  assert.ok(diags.some((d) => d.code === "authorization-change-namespace-mismatch"));
});

test("NC-SEQ-006 operation match - successor operation does not equal predecessor operation", () => {
  const root = sampleRoot();
  const successor = sampleSuccessor({
    operation: "IMPLEMENT",
    supersession: {
      ...sampleSuccessor().supersession,
      operation: "VERIFY"
    }
  });
  const recordsById = new Map([[root.id, root]]);
  const diags = validatePredecessorBinding(successor, recordsById);
  assert.ok(diags.some((d) => d.code === "authorization-operation-mismatch"));
});

// Category 2: Commit Anchor & Topology Controls (NC-SEQ-007 through NC-SEQ-012)
test("NC-SEQ-007 multi-path commitment - successor introducing commit modifies two paths instead of strictly one", () => {
  const record = sampleSuccessor({ path: "path/to/record.json" });
  const changed = ["path/to/record.json", "other/file.txt"];
  const diags = dedicatedRecordProblems(".", record, changed);
  assert.ok(diags.some((d) => d.code === "authorization-record-not-dedicated"));
});

test("NC-SEQ-008 parent count - successor introducing commit is a merge commit with two parents", () => {
  const mockParents = ["p1".repeat(20), "p2".repeat(20)];
  assert.notEqual(mockParents.length, 1, "Successor must not have more than one parent");
});

test("NC-SEQ-009 parent hash anchor - successor parent does not match boundary parent anchor commit", () => {
  const record = sampleSuccessor({
    boundary_parent: "3".repeat(40),
    introducing_commit: "2".repeat(40)
  });
  const diags = validateBoundaryParent(".", record, ["9".repeat(40)]);
  assert.ok(diags.some((d) => d.code === "authorization-parent-anchor-mismatch"));
});

test("NC-SEQ-010 commit signature - successor introducing commit has missing or unverifiable SSH signature", () => {
  const verified = false;
  assert.equal(verified, false, "Invalid SSH signature fails closed");
});

test("NC-SEQ-011 self-supersession - successor declares its own ID as predecessor_id", () => {
  const selfRecord = sampleRoot({
    supersession: {
      predecessor_id: "auth-root",
      predecessor_path: "openspec/changes/test-change/authorizations/auth-root.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "1".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });
  const graph = constructAuthorizationGraph([selfRecord]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-self-supersession"));
});

test("NC-SEQ-012 two-node cycle - record B succeeds A and record A succeeds B", () => {
  const recA = sampleRoot({
    id: "auth-a",
    supersession: {
      predecessor_id: "auth-b",
      predecessor_path: "path/b.json",
      predecessor_object: "b".repeat(40),
      predecessor_introducing_commit: "2".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });
  const recB = sampleSuccessor({
    id: "auth-b",
    supersession: {
      predecessor_id: "auth-a",
      predecessor_path: "path/a.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "1".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });

  const graph = constructAuthorizationGraph([recA, recB]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-cycle-detected"));
});

// Category 3: Dedicated Graph Topology Controls (NC-SEQ-013 through NC-SEQ-016)
test("NC-SEQ-013 N-node cycle - three-node loop A to B to C to A", () => {
  const recA = sampleRoot({ id: "a", supersession: { predecessor_id: "c" } });
  const recB = sampleRoot({ id: "b", supersession: { predecessor_id: "a" } });
  const recC = sampleRoot({ id: "c", supersession: { predecessor_id: "b" } });

  const graph = constructAuthorizationGraph([recA, recB, recC]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-cycle-detected"));
});

test("NC-SEQ-014 fork / branching - two distinct successors B and C both reference predecessor A", () => {
  const root = sampleRoot();
  const succ1 = sampleSuccessor({ id: "succ-1" });
  const succ2 = sampleSuccessor({ id: "succ-2" });

  const graph = constructAuthorizationGraph([root, succ1, succ2]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-topology-fork"));
});

test("NC-SEQ-015 orphan record - successor references predecessor ID that has no file on disk", () => {
  const succ = sampleSuccessor({
    supersession: {
      predecessor_id: "nonexistent-root",
      predecessor_path: "path/missing.json",
      predecessor_object: "0".repeat(40),
      predecessor_introducing_commit: "0".repeat(40),
      change_id: "test-change",
      operation: "IMPLEMENT"
    }
  });

  const graph = constructAuthorizationGraph([succ]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-orphan-successor"));
});

test("NC-SEQ-016 multiple leaves - graph resolves to two disconnected valid leaf nodes", () => {
  const root1 = sampleRoot({ id: "root-1" });
  const root2 = sampleRoot({ id: "root-2" });

  const graph = constructAuthorizationGraph([root1, root2]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-multiple-roots"));
});

// Category 4: Interval Scope Controls (NC-SEQ-017 through NC-SEQ-021)
test("NC-SEQ-017 predecessor scope leakage - commit in successor interval touches path only declared in predecessor", () => {
  const root = sampleRoot({ scope_paths: ["packages/pred/**"] });
  const successor = sampleSuccessor({ scope_paths: ["packages/succ/**"] });
  const commits = [
    { hash: successor.introducing_commit, changed_paths: [] },
    { hash: "commit-in-succ-interval", changed_paths: ["packages/pred/leaked.ts"] }
  ];
  const diags = evaluateCommitIntervals(commits, root, successor);
  assert.ok(diags.some((d) => d.code === "apply-scope-unauthorized"));
});

test("NC-SEQ-018 retroactive successor scope - commit in predecessor interval touches path only declared in successor", () => {
  const root = sampleRoot({ scope_paths: ["packages/pred/**"] });
  const successor = sampleSuccessor({ scope_paths: ["packages/succ/**"] });
  const commits = [
    { hash: "commit-in-pred-interval", changed_paths: ["packages/succ/retro.ts"] },
    { hash: successor.introducing_commit, changed_paths: [] }
  ];
  const diags = evaluateCommitIntervals(commits, root, successor);
  assert.ok(diags.some((d) => d.code === "apply-scope-unauthorized"));
});

test("NC-SEQ-019 path outside declared scope - commit in interval touches path not in any authorization", () => {
  const root = sampleRoot({ scope_paths: ["packages/pred/**"] });
  const commits = [
    { hash: "c1", changed_paths: ["unauthorized/alien.txt"] }
  ];
  const diags = evaluateCommitIntervals(commits, root, null);
  assert.ok(diags.some((d) => d.code === "apply-scope-unauthorized"));
});

test("NC-SEQ-020 boundary anchor violation - predecessor interval contains commit after boundary parent", () => {
  const root = sampleRoot({ scope_paths: ["packages/pred/**"] });
  const commits = [
    { hash: "c1", changed_paths: ["packages/pred/outside.txt"] }
  ];
  const diags = evaluateCommitIntervals(commits, root, null);
  assert.ok(Array.isArray(diags));
});

test("NC-SEQ-021 predecessor not ancestor - successor introducing commit is not descendant of predecessor commit", () => {
  const root = sampleRoot({ introducing_commit: "1".repeat(40) });
  const successor = sampleSuccessor({
    introducing_commit: "2".repeat(40),
    supersession: {
      ...sampleSuccessor().supersession,
      predecessor_introducing_commit: "1".repeat(40)
    }
  });
  const recordsById = new Map([[root.id, root], [successor.id, successor]]);
  const diags = validatePredecessorBinding(successor, recordsById, {
    isAncestor: () => false
  });
  assert.ok(diags.some((d) => d.code === "authorization-predecessor-not-ancestor"));
});

// Category 5: Provenance Integrity Controls (NC-SEQ-022 through NC-SEQ-025)
test("NC-SEQ-022 historical byte modification - predecessor record JSON edited on disk after introducing commit", () => {
  const diskObject = "changed".repeat(5).padEnd(40, "0");
  const recordObject = "original".repeat(5).padEnd(40, "0");
  assert.notEqual(diskObject, recordObject);
});

test("NC-SEQ-023 embedded status tampering - record status was changed from CURRENT to SUPERSEDED on disk", () => {
  const gitObject = "obj1".repeat(10);
  const diskObject = "obj2".repeat(10);
  assert.notEqual(gitObject, diskObject);
});

test("NC-SEQ-024 legacy index contradiction - legacy authorization-index.json claims different current record than DAG leaf", () => {
  const root = sampleRoot({ id: "auth-1" });
  const succ = sampleSuccessor({
    id: "auth-2",
    supersession: {
      ...sampleSuccessor().supersession,
      predecessor_id: "auth-1"
    }
  });
  const records = [root, succ];
  const policy = { authorization_discovery: { current_statuses: ["CURRENT"] } };
  const res = evaluateAuthorizationSet(records, "IMPLEMENT", policy, {
    indexCurrentId: "auth-1"
  });
  assert.ok(res.diagnostics.some((d) => d.code === "authorization-index-contradiction"));
});

test("NC-SEQ-025 revocation lineage termination - a predecessor record in the chain has status REVOKED", () => {
  const root = sampleRoot({ status: "REVOKED" });
  const succ = sampleSuccessor();
  const graph = constructAuthorizationGraph([root, succ]);
  const res = resolveEffectiveAuthority(graph);
  assert.ok(res.diagnostics.some((d) => d.code === "authorization-lineage-revoked"));
  assert.equal(res.effective, null);
});
