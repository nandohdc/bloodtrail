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
  assert.ok(resolution.diagnostics.some((d) => d.code === "authorization-multiple-roots" || d.code === "authorization-multiple-leaves"));
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
  assert.ok(diagnostics.some((d) => d.code === "predecessor-binding-mismatch"));
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
  assert.ok(invariants.some((d) => d.code === "self-supersession"));
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
  assert.ok(invariants.some((d) => d.code === "cyclic-supersession"));
});

test("SEQ-T007 fork / branching supersession fails closed", () => {
  const root = sampleRoot();
  const succ1 = sampleSuccessor({ id: "succ-1" });
  const succ2 = sampleSuccessor({ id: "succ-2" });

  const graph = constructAuthorizationGraph([root, succ1, succ2]);
  const invariants = validateGraphInvariants(graph);
  assert.ok(invariants.some((d) => d.code === "authorization-fork-detected"));
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
  assert.ok(invariants.some((d) => d.code === "orphan-successor"));
});

test("SEQ-T013 revocation in lineage terminates effective authority", () => {
  const root = sampleRoot({ status: "REVOKED" });
  const succ = sampleSuccessor();

  const graph = constructAuthorizationGraph([root, succ]);
  const resolution = resolveEffectiveAuthority(graph);
  assert.ok(resolution.diagnostics.some((d) => d.code === "authorization-lineage-revoked"));
  assert.equal(resolution.effective, null);
});

test("SEQ-T015 operation-aware attribution: RESOLVE_DEBT commits immune from IMPLEMENT", () => {
  const debtPinCommit = {
    hash: "d".repeat(40),
    changed_paths: ["openspec/governance/normative-precedence-pins/current-pre-fold-cb-018.json"]
  };
  const op = classifyCommitOperation(debtPinCommit);
  assert.equal(op, "RESOLVE_DEBT");

  const implCommit = {
    hash: "e".repeat(40),
    changed_paths: ["packages/core/src/index.ts"]
  };
  assert.equal(classifyCommitOperation(implCommit), "IMPLEMENT");
});
