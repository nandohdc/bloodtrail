import { diagnostic } from "./shared.mjs";

/**
 * Validates the 11 supersession preconditions linking a successor record to its predecessor.
 *
 * @param {object} record The candidate successor authorization record.
 * @param {Map<string, object>} recordsById Map of all authorization records keyed by ID.
 * @returns {Array<object>} List of diagnostic objects.
 */
function checkNamespaceAndOperation(record, predecessor, binding) {
  const diagnostics = [];
  if (binding.change_id !== record.change_id || binding.change_id !== predecessor.change_id) {
    diagnostics.push(diagnostic(
      "authorization-change-namespace-mismatch",
      record.path,
      `Change namespace mismatch: successor declares "${binding.change_id}", predecessor has "${predecessor.change_id}"`
    ));
  }
  if (binding.operation !== record.operation || binding.operation !== predecessor.operation) {
    diagnostics.push(diagnostic(
      "authorization-operation-mismatch",
      record.path,
      `Operation mismatch: successor declares "${binding.operation}", predecessor has "${predecessor.operation}"`
    ));
  }
  return diagnostics;
}

function checkPathBlobAndCommit(record, predecessor, binding) {
  const diagnostics = [];
  if (binding.predecessor_path !== predecessor.path) {
    diagnostics.push(diagnostic(
      "authorization-predecessor-path-mismatch",
      record.path,
      `Predecessor path mismatch: expected "${predecessor.path}", got "${binding.predecessor_path}"`
    ));
  }
  if (predecessor.object && binding.predecessor_object !== predecessor.object) {
    diagnostics.push(diagnostic(
      "authorization-predecessor-blob-mismatch",
      record.path,
      `Predecessor Git blob hash mismatch: expected "${predecessor.object}", got "${binding.predecessor_object}"`
    ));
  }
  if (predecessor.introducing_commit && binding.predecessor_introducing_commit !== predecessor.introducing_commit) {
    diagnostics.push(diagnostic(
      "authorization-predecessor-commit-mismatch",
      record.path,
      `Predecessor introducing commit mismatch: expected "${predecessor.introducing_commit}", got "${binding.predecessor_introducing_commit}"`
    ));
  }
  return diagnostics;
}

function checkCommitAncestry(record, predecessor, isAncestor) {
  if (!isAncestor) return [];
  const predCommit = predecessor.introducing_commit;
  const succCommit = record.introducing_commit;
  if (!predCommit || !succCommit) return [];
  if (!isAncestor(predCommit, succCommit)) {
    return [diagnostic(
      "authorization-predecessor-not-ancestor",
      record.path,
      `Predecessor commit "${predCommit}" is not an ancestor of successor commit "${succCommit}"`
    )];
  }
  return [];
}

/**
 * Validates the 11 supersession preconditions linking a successor record to its predecessor.
 *
 * @param {object} record The candidate successor authorization record.
 * @param {Map<string, object>} recordsById Map of all authorization records keyed by ID.
 * @returns {Array<object>} List of diagnostic objects.
 */
export function validatePredecessorBinding(record, recordsById, { isAncestor = null } = {}) {
  if (!record.supersession) return [];
  const binding = record.supersession;

  const predecessor = recordsById.get(binding.predecessor_id);
  if (!predecessor) {
    return [diagnostic(
      "authorization-predecessor-missing",
      record.path,
      `Predecessor record with ID "${binding.predecessor_id}" does not exist`
    )];
  }

  return [
    ...checkNamespaceAndOperation(record, predecessor, binding),
    ...checkPathBlobAndCommit(record, predecessor, binding),
    ...checkCommitAncestry(record, predecessor, isAncestor),
  ];
}

function recordPredecessorEdge(record, edges, parents) {
  const predId = record.supersession.predecessor_id;
  edges.get(predId)?.push(record.id);
  parents.set(record.id, predId);
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
    if (record.supersession) {
      recordPredecessorEdge(record, edges, parents);
    } else {
      roots.push(record);
    }
  }

  return { records, recordsById, roots, edges, parents };
}

function checkRootCardinality(roots) {
  if (roots.length === 0) {
    return [diagnostic("authorization-no-root", "", "No root authorization found in lineage")];
  }
  if (roots.length > 1) {
    return [diagnostic(
      "authorization-multiple-roots",
      "",
      `Multiple root authorizations detected (${roots.map((r) => r.id).join(", ")})`
    )];
  }
  return [];
}

function checkSupersessionValidity(record, recordsById) {
  if (!record.supersession) return [];
  const predId = record.supersession.predecessor_id;
  const diagnostics = [];
  if (predId === record.id) {
    diagnostics.push(diagnostic("authorization-self-supersession", record.path, `Record "${record.id}" cannot supersede itself`));
  }
  if (!recordsById.has(predId)) {
    diagnostics.push(diagnostic("authorization-orphan-successor", record.path, `Record "${record.id}" supersedes non-existent predecessor "${predId}"`));
  }
  return diagnostics;
}

function checkDirectSupersessionInvariants(records, recordsById) {
  return records.flatMap((record) => checkSupersessionValidity(record, recordsById));
}

function checkTopologyForks(edges) {
  const diagnostics = [];
  for (const [predId, succIds] of edges.entries()) {
    if (succIds.length > 1) {
      diagnostics.push(diagnostic(
        "authorization-topology-fork",
        predId,
        `Predecessor "${predId}" has multiple successors: ${succIds.join(", ")}`
      ));
    }
  }
  return diagnostics;
}

function detectGraphCycles(records, edges) {
  const visiting = new Set();
  const visited = new Set();
  const diagnostics = [];

  function dfs(nodeId) {
    if (diagnostics.length > 0) return;
    if (visiting.has(nodeId)) {
      diagnostics.push(diagnostic("authorization-cycle-detected", nodeId, `Cycle detected involving node "${nodeId}"`));
      return;
    }
    if (visited.has(nodeId)) return;

    visiting.add(nodeId);
    const successors = edges.get(nodeId) ?? [];
    for (const nextId of successors) {
      dfs(nextId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const record of records) {
    if (!visited.has(record.id)) {
      dfs(record.id);
    }
  }

  return diagnostics;
}

/**
 * Validates topological invariants: single root, no self-supersession, no forks, no cycles, no orphans.
 *
 * @param {object} graph The authorization graph.
 * @returns {Array<object>} List of invariant violation diagnostics.
 */
export function validateGraphInvariants(graph) {
  return [
    ...checkRootCardinality(graph.roots),
    ...checkDirectSupersessionInvariants(graph.records, graph.recordsById),
    ...checkTopologyForks(graph.edges),
    ...detectGraphCycles(graph.records, graph.edges),
  ];
}

function findBindingError(records, recordsById) {
  const successors = records.filter((record) => Boolean(record.supersession));
  for (const record of successors) {
    const bindingDiags = validatePredecessorBinding(record, recordsById);
    if (bindingDiags.length > 0) return bindingDiags;
  }
  return null;
}

function findRevocationError(records) {
  const revoked = records.find((record) => record.status === "REVOKED");
  if (!revoked) return null;
  return [diagnostic("authorization-lineage-revoked", revoked.path, `Authorization lineage revoked at node "${revoked.id}"`)];
}

function resolveSingleLeaf(edges, recordsById) {
  const leaves = [];
  for (const [nodeId, succIds] of edges.entries()) {
    if (succIds.length === 0) {
      leaves.push(recordsById.get(nodeId));
    }
  }
  if (leaves.length === 0) {
    return { leaf: null, diagnostic: diagnostic("authorization-no-leaf", "", "No active leaf found in authorization graph") };
  }
  if (leaves.length > 1) {
    return {
      leaf: null,
      diagnostic: diagnostic("authorization-leaf-multiple", "", `Multiple un-superseded leaves detected (${leaves.map((l) => l.id).join(", ")})`)
    };
  }
  return { leaf: leaves[0], diagnostic: null };
}

function copyMissingCapabilities(effective, pred) {
  if (!effective.authorized_capabilities && pred.authorized_capabilities) {
    effective.authorized_capabilities = pred.authorized_capabilities;
  }
  if (!effective.authorized_delta_objects && pred.authorized_delta_objects) {
    effective.authorized_delta_objects = pred.authorized_delta_objects;
  }
}

function hasAllCapabilities(effective) {
  return Boolean(effective.authorized_capabilities && effective.authorized_delta_objects);
}

function resolvePredecessorRecord(curr, recordsById) {
  const predId = curr.supersession?.predecessor_id;
  return predId ? recordsById.get(predId) ?? null : null;
}

function inheritCapabilities(leaf, recordsById) {
  const effective = { ...leaf };
  let curr = leaf;
  while (!hasAllCapabilities(effective)) {
    const pred = resolvePredecessorRecord(curr, recordsById);
    if (!pred) break;
    copyMissingCapabilities(effective, pred);
    curr = pred;
  }
  return effective;
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
  const bindingError = findBindingError(graph.records, graph.recordsById);
  if (bindingError) {
    return { effective: null, diagnostics: bindingError };
  }
  const revocationError = findRevocationError(graph.records);
  if (revocationError) {
    return { effective: null, diagnostics: revocationError };
  }
  const { leaf, diagnostic: leafDiag } = resolveSingleLeaf(graph.edges, graph.recordsById);
  if (leafDiag) {
    return { effective: null, diagnostics: [leafDiag] };
  }
  return { effective: inheritCapabilities(leaf, graph.recordsById), diagnostics: [] };
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

function pathMatchesScope(path, scopePatterns) {
  if (!scopePatterns || scopePatterns.length === 0) return false;
  return scopePatterns.some((pattern) => {
    if (pattern.endsWith("/**")) {
      const prefix = pattern.slice(0, -3);
      return path === prefix || path.startsWith(`${prefix}/`);
    }
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return path.startsWith(`${prefix}/`) && !path.slice(prefix.length + 1).includes("/");
    }
    return path === pattern;
  });
}

function checkCommitScope(commit, auth, intervalKind, diagnostics) {
  const paths = commit.changed_paths || [];
  const scopePaths = auth.scope_paths;
  const unauthorized = paths.filter((path) => !pathMatchesScope(path, scopePaths));
  for (const path of unauthorized) {
    const message = intervalKind
      ? `Path "${path}" in ${intervalKind} interval commit "${commit.hash}" not covered by ${intervalKind} scope`
      : `Path "${path}" in commit "${commit.hash}" outside root authorization scope`;
    diagnostics.push(diagnostic("apply-scope-unauthorized", path, message));
  }
}

function evaluateSingleInterval(commits, rootAuth) {
  const diagnostics = [];
  for (const commit of commits) {
    if (commit.hash !== rootAuth.introducing_commit) {
      checkCommitScope(commit, rootAuth, null, diagnostics);
    }
  }
  return diagnostics;
}

function intervalTarget(inSuccessor, rootAuth, successorAuth) {
  return inSuccessor
    ? { activeAuth: successorAuth, kind: "successor" }
    : { activeAuth: rootAuth, kind: "root" };
}

function partitionDualIntervalCommits(commits, rootAuth, successorAuth) {
  const result = [];
  let inSuccessor = false;
  const nonRootCommits = commits.filter((c) => c.hash !== rootAuth.introducing_commit);
  for (const commit of nonRootCommits) {
    if (commit.hash === successorAuth.introducing_commit) {
      inSuccessor = true;
    } else {
      const target = intervalTarget(inSuccessor, rootAuth, successorAuth);
      result.push({ commit, activeAuth: target.activeAuth, kind: target.kind });
    }
  }
  return result;
}

function evaluateDualIntervals(commits, rootAuth, successorAuth) {
  const diagnostics = [];
  const entries = partitionDualIntervalCommits(commits, rootAuth, successorAuth);
  for (const entry of entries) {
    checkCommitScope(entry.commit, entry.activeAuth, entry.kind, diagnostics);
  }
  return diagnostics;
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
  if (!successorAuth) {
    return evaluateSingleInterval(commits, rootAuth);
  }
  return evaluateDualIntervals(commits, rootAuth, successorAuth);
}
