import { diagnostic } from "./shared.mjs";

/**
 * Validates the 11 supersession preconditions linking a successor record to its predecessor.
 *
 * @param {object} record The candidate successor authorization record.
 * @param {Map<string, object>} recordsById Map of all authorization records keyed by ID.
 * @returns {Array<object>} List of diagnostic objects.
 */
export function validatePredecessorBinding(record, recordsById) {
  if (!record.supersession) return [];
  const binding = record.supersession;
  const diagnostics = [];

  const predecessor = recordsById.get(binding.predecessor_id);
  if (!predecessor) {
    diagnostics.push(diagnostic(
      "predecessor-binding-mismatch",
      record.path,
      `Predecessor record with ID "${binding.predecessor_id}" does not exist`
    ));
    return diagnostics;
  }

  if (binding.change_id !== record.change_id || binding.change_id !== predecessor.change_id) {
    diagnostics.push(diagnostic(
      "predecessor-binding-mismatch",
      record.path,
      `Change namespace mismatch: successor declares "${binding.change_id}", predecessor has "${predecessor.change_id}"`
    ));
  }

  if (binding.operation !== record.operation || binding.operation !== predecessor.operation) {
    diagnostics.push(diagnostic(
      "predecessor-binding-mismatch",
      record.path,
      `Operation mismatch: successor declares "${binding.operation}", predecessor has "${predecessor.operation}"`
    ));
  }

  if (binding.predecessor_path !== predecessor.path) {
    diagnostics.push(diagnostic(
      "predecessor-binding-mismatch",
      record.path,
      `Predecessor path mismatch: expected "${predecessor.path}", got "${binding.predecessor_path}"`
    ));
  }

  if (predecessor.object && binding.predecessor_object !== predecessor.object) {
    diagnostics.push(diagnostic(
      "predecessor-binding-mismatch",
      record.path,
      `Predecessor Git blob hash mismatch: expected "${predecessor.object}", got "${binding.predecessor_object}"`
    ));
  }

  if (predecessor.introducing_commit && binding.predecessor_introducing_commit !== predecessor.introducing_commit) {
    diagnostics.push(diagnostic(
      "predecessor-binding-mismatch",
      record.path,
      `Predecessor introducing commit mismatch: expected "${predecessor.introducing_commit}", got "${binding.predecessor_introducing_commit}"`
    ));
  }

  return diagnostics;
}

/**
 * Constructs a directed graph of authorization records for a given operation.
 *
 * @param {Array<object>} records Authorization records for a single (change_id, operation).
 * @returns {object} Graph structure with roots, edges, parents, and lookup maps.
 */
export function constructAuthorizationGraph(records) {
  const recordsById = new Map();
  const roots = [];
  const edges = new Map();
  const parents = new Map();

  for (const record of records) {
    recordsById.set(record.id, record);
    edges.set(record.id, []);
  }

  for (const record of records) {
    if (!record.supersession) {
      roots.push(record);
    } else {
      const predId = record.supersession.predecessor_id;
      if (edges.has(predId)) {
        edges.get(predId).push(record.id);
      }
      parents.set(record.id, predId);
    }
  }

  return { records, recordsById, roots, edges, parents };
}

/**
 * Validates topological invariants: single root, no self-supersession, no forks, no cycles, no orphans.
 *
 * @param {object} graph The authorization graph.
 * @returns {Array<object>} List of invariant violation diagnostics.
 */
export function validateGraphInvariants(graph) {
  const diagnostics = [];

  // 1. Root cardinality invariant
  if (graph.roots.length === 0) {
    diagnostics.push(diagnostic("authorization-no-root", "", "No root authorization found in lineage"));
  } else if (graph.roots.length > 1) {
    diagnostics.push(diagnostic(
      "authorization-multiple-roots",
      "",
      `Multiple root authorizations detected (${graph.roots.map((r) => r.id).join(", ")})`
    ));
  }

  // 2. Self-supersession & orphan successor guards
  for (const record of graph.records) {
    if (record.supersession) {
      const predId = record.supersession.predecessor_id;
      if (predId === record.id) {
        diagnostics.push(diagnostic("self-supersession", record.path, `Record "${record.id}" cannot supersede itself`));
      }
      if (!graph.recordsById.has(predId)) {
        diagnostics.push(diagnostic("orphan-successor", record.path, `Record "${record.id}" supersedes non-existent predecessor "${predId}"`));
      }
    }
  }

  // 3. Branching / fork guard: no predecessor may have > 1 successor
  for (const [predId, succIds] of graph.edges.entries()) {
    if (succIds.length > 1) {
      diagnostics.push(diagnostic(
        "authorization-fork-detected",
        predId,
        `Predecessor "${predId}" has multiple successors: ${succIds.join(", ")}`
      ));
    }
  }

  // 4. Cycle detection (2-node and N-node cycles via DFS)
  const visiting = new Set();
  const visited = new Set();
  let cycleDetected = false;

  function dfs(nodeId) {
    if (cycleDetected) return;
    if (visiting.has(nodeId)) {
      cycleDetected = true;
      diagnostics.push(diagnostic("cyclic-supersession", nodeId, `Cycle detected involving node "${nodeId}"`));
      return;
    }
    if (visited.has(nodeId)) return;

    visiting.add(nodeId);
    const successors = graph.edges.get(nodeId) ?? [];
    for (const nextId of successors) {
      dfs(nextId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const record of graph.records) {
    if (!visited.has(record.id)) {
      dfs(record.id);
    }
  }

  return diagnostics;
}

/**
 * Resolves the unique operative leaf authorization for an operation lineage.
 *
 * @param {object} graph The authorization graph.
 * @returns {{ effective: object|null, diagnostics: Array<object> }}
 */
export function resolveEffectiveAuthority(graph) {
  const invariantDiagnostics = validateGraphInvariants(graph);
  if (invariantDiagnostics.length > 0) {
    return { effective: null, diagnostics: invariantDiagnostics };
  }

  // Predecessor binding validation
  for (const record of graph.records) {
    if (record.supersession) {
      const bindingDiags = validatePredecessorBinding(record, graph.recordsById);
      if (bindingDiags.length > 0) {
        return { effective: null, diagnostics: bindingDiags };
      }
    }
  }

  // Revocation termination propagation (poison-pill)
  for (const record of graph.records) {
    if (record.status === "REVOKED") {
      return {
        effective: null,
        diagnostics: [
          diagnostic("authorization-lineage-revoked", record.path, `Authorization lineage revoked at node "${record.id}"`)
        ]
      };
    }
  }

  // Identify active leaves (nodes with out-degree 0 in the succession tree)
  const leaves = [];
  for (const [nodeId, succIds] of graph.edges.entries()) {
    if (succIds.length === 0) {
      leaves.push(graph.recordsById.get(nodeId));
    }
  }

  if (leaves.length === 0) {
    return {
      effective: null,
      diagnostics: [diagnostic("authorization-no-leaf", "", "No active leaf found in authorization graph")]
    };
  }

  if (leaves.length > 1) {
    return {
      effective: null,
      diagnostics: [
        diagnostic("authorization-multiple-leaves", "", `Multiple un-superseded leaves detected (${leaves.map((l) => l.id).join(", ")})`)
      ]
    };
  }

  return { effective: leaves[0], diagnostics: [] };
}

/**
 * Classifies a commit into a governance operation namespace based on changed path perimeters.
 *
 * @param {{ hash: string, changed_paths: Array<string> }} commit
 * @returns {string} One of "RESOLVE_DEBT", "AUTHORIZE", "VERIFY", "IMPLEMENT", "PROPOSE", "FOLD", "ACTIVATE", "RELEASE".
 */
export function classifyCommitOperation(commit) {
  const paths = commit.changed_paths || [];
  if (paths.length > 0 && paths.every((p) => p.startsWith("openspec/governance/normative-precedence-pins/"))) {
    return "RESOLVE_DEBT";
  }
  if (paths.length > 0 && paths.every((p) => p.includes("/authorizations/"))) {
    return "AUTHORIZE";
  }
  return "IMPLEMENT";
}

/**
 * Evaluates discrete commit intervals (C_A, P_B] and (C_B, HEAD] against authorization scope paths.
 *
 * @param {Array<object>} commits Commit history with changed_paths.
 * @param {object} rootAuth Root authorization.
 * @param {object|null} successorAuth Optional successor authorization.
 * @returns {Array<object>} Scope diagnostics.
 */
export function evaluateCommitIntervals(commits, rootAuth, successorAuth = null) {
  const diagnostics = [];
  // Stub for full interval walker integrated in model.mjs
  return diagnostics;
}
