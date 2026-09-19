import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

import {
  byCodePoint,
  diagnostic,
  gitObject,
  gitObjectAt,
  gitPathsBetween,
  gitStdout,
  introducingCommit,
  isAncestorCommit,
  readJson,
} from "./shared.mjs";
import { validatePolicySchema } from "./policy-validation.mjs";
import {
  constructAuthorizationGraph,
  resolveEffectiveAuthority
} from "./sequential-authorization.mjs";

function jsonAt(repoRoot, commit, path) {
  const value = gitStdout(repoRoot, ["show", `${commit}:${path}`]);
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function authorizationIndexPath(changeDir, policy) {
  return resolve(changeDir, policy.repository_evidence.authorization_index_file);
}

export function loadAuthorizationIndex(changeDir, repoRoot, policy) {
  const path = authorizationIndexPath(changeDir, policy);
  if (!existsSync(path)) return { path: relative(repoRoot, path), value: null, diagnostics: [] };
  const value = readJson(path);
  const diagnostics = [];
  if (value.schema !== policy.authorization_discovery.legacy_index_schema) {
    diagnostics.push(diagnostic("authorization-index-schema-invalid", relative(repoRoot, path), String(value.schema)));
  }
  if (value.change_id !== basename(changeDir)) {
    diagnostics.push(diagnostic("authorization-index-change-mismatch", relative(repoRoot, path), String(value.change_id)));
  }
  const ids = value.records?.map((entry) => entry.id) ?? [];
  if (new Set(ids).size !== ids.length) diagnostics.push(diagnostic("authorization-index-id-duplicate", relative(repoRoot, path), "record IDs must be unique"));
  return { path: relative(repoRoot, path), value, diagnostics };
}

function recordHistoryProblems(repoRoot, record) {
  const diagnostics = [];
  if (gitObject(repoRoot, record.path) !== record.object) {
    diagnostics.push(diagnostic("authorization-record-object-mismatch", record.path, record.id));
  }
  if (introducingCommit(repoRoot, record.path) !== record.introducing_commit) {
    diagnostics.push(diagnostic("authorization-record-history-mismatch", record.path, record.id));
  }
  diagnostics.push(...dedicatedRecordProblems(repoRoot, record));
  return diagnostics;
}

function introducingCommitPaths(repoRoot, commit) {
  const parents = (gitStdout(repoRoot, ["show", "-s", "--format=%P", commit]) ?? "")
    .split(" ").filter(Boolean);
  return parents.length === 1 ? gitPathsBetween(repoRoot, parents[0], commit) : null;
}

function changesOnlyItsOwnPath(changed, path) {
  return Array.isArray(changed) && changed.length === 1 && changed[0] === path;
}

function dedicatedRecordProblems(repoRoot, record) {
  if (record.status !== "CURRENT") return [];
  const changed = introducingCommitPaths(repoRoot, record.introducing_commit);
  if (changesOnlyItsOwnPath(changed, record.path)) return [];
  return [diagnostic("authorization-record-not-dedicated", record.path, record.id)];
}

function schemaRecordPaths(changeDir, policy) {
  const directory = resolve(changeDir, policy.repository_evidence.authorization_records_directory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => resolve(directory, entry.name))
    .sort(byCodePoint);
}

function loadSchemaRecords(changeDir, repoRoot, policy) {
  const schema = readJson(resolve(repoRoot, policy.authorization_discovery.record_schema));
  return schemaRecordPaths(changeDir, policy).map((path) => {
    const value = readJson(path);
    const relativePath = relative(repoRoot, path);
    const introduced = introducingCommit(repoRoot, relativePath);
    return {
      ...value,
      path: relativePath,
      object: gitObject(repoRoot, relativePath),
      introducing_commit: introduced,
      record_format: "SCHEMA_JSON",
      diagnostics: validatePolicySchema(value, schema, relativePath, schema),
    };
  });
}

function activeKey(principal) {
  const keys = principal?.ssh_signing_keys?.filter((entry) => entry.status === "ACTIVE") ?? [];
  return keys.length === 1 ? keys[0] : null;
}

export function verifySignedCommit(repoRoot, commit, principal) {
  const key = activeKey(principal);
  if (!key) return { verified: false, fingerprint: null, reason: "principal must have exactly one active signing key" };
  const directory = mkdtempSync(join(tmpdir(), "bloodtrail-signers-"));
  const allowed = join(directory, "allowed_signers");
  try {
    writeFileSync(allowed, `${principal.id} ${key.public_key}\n`, { encoding: "utf8", mode: 0o600 });
    const result = spawnSync("git", ["-c", `gpg.ssh.allowedSignersFile=${allowed}`, "verify-commit", commit], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    return {
      verified: result.status === 0 && output.includes(key.fingerprint),
      fingerprint: output.match(/SHA256:[A-Za-z0-9+/=]+/)?.[0] ?? null,
      reason: result.status === 0 ? null : output.trim(),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function bootstrapRegistryDiagnostics(repoRoot, registry, path) {
  const diagnostics = [];
  const bootstrap = registry.bootstrap ?? {};
  const principal = registry.principals?.find((entry) => entry.id === "nandohdc");
  if (gitStdout(repoRoot, ["show", "-s", "--format=%P", bootstrap.authorization_commit]) !== bootstrap.expected_parent) {
    diagnostics.push(diagnostic("authority-registry-bootstrap-parent-mismatch", path, String(bootstrap.authorization_commit)));
  }
  if (bootstrap.expected_parent !== bootstrap.authorized_proposal_commit) {
    diagnostics.push(diagnostic("authority-registry-bootstrap-proposal-mismatch", path, String(bootstrap.authorized_proposal_commit)));
  }
  const signed = verifySignedCommit(repoRoot, bootstrap.authorization_commit, principal);
  if (!signed.verified) {
    diagnostics.push(diagnostic("authority-registry-bootstrap-signature-invalid", path, signed.reason ?? "owner signature did not verify"));
  }
  if (!bootstrapRecordBinds(repoRoot, bootstrap, principal)) {
    diagnostics.push(diagnostic("authority-registry-bootstrap-binding-invalid", path,
      "signed bootstrap record does not bind the registry principal, proposal, and scope"));
  }
  return diagnostics;
}

function bootstrapRecordBinds(repoRoot, bootstrap, principal) {
  const record = gitStdout(repoRoot, ["show", `${bootstrap.authorization_commit}:${bootstrap.authorization_path}`]);
  const key = activeKey(principal);
  if (!record || !key) return false;
  return [
    key.fingerprint,
    bootstrap.authorized_proposal_commit,
    "AUTHORIZATION_SCOPE=CB-001-REVISION-3-IMPLEMENTATION",
  ].every((needle) => record.includes(needle));
}

export function loadTrustedAuthorityRegistry(repoRoot, policy, baseCommit) {
  const path = policy.repository_evidence.authority_registry_path;
  const schemaPath = "openspec/governance/schemas/governance-authority-registry.schema.json";
  const schema = readJson(resolve(repoRoot, schemaPath));
  const protectedValue = baseCommit ? jsonAt(repoRoot, baseCommit, path) : null;
  const value = protectedValue ?? readJson(resolve(repoRoot, path));
  const diagnostics = validatePolicySchema(value, schema, path, schema);
  if (protectedValue === null) diagnostics.push(...bootstrapRegistryDiagnostics(repoRoot, value, path));
  if (protectedValue !== null) diagnostics.push(...protectedRegistryDiagnostics(
    gitObjectAt(repoRoot, baseCommit, path), gitObject(repoRoot, path), path));
  return { path, value, source: protectedValue === null ? "BOOTSTRAP_AUTHORIZATION" : "PROTECTED_BASELINE", diagnostics };
}

export function protectedRegistryDiagnostics(protectedObject, candidateObject, path = "authority_registry") {
  if (protectedObject === candidateObject) return [];
  return [diagnostic("authorization-self-enrolled-signer", path,
    "candidate registry differs from the protected baseline registry")];
}

function indexRecords(changeDir, repoRoot, policy) {
  const index = loadAuthorizationIndex(changeDir, repoRoot, policy);
  if (!index.value) return { index, records: [] };
  return {
    index,
    records: index.value.records.map((record) => ({
      ...record,
      change_id: index.value.change_id,
      diagnostics: recordHistoryProblems(repoRoot, record),
    })),
  };
}

function validateBoundaryParent(repoRoot, record) {
  if (!record.boundary_parent || !record.introducing_commit) return [];
  const parents = (gitStdout(repoRoot, ["show", "-s", "--format=%P", record.introducing_commit]) ?? "")
    .split(" ").filter(Boolean);
  if (parents.length !== 1 || parents[0] !== record.boundary_parent) {
    return [diagnostic(
      "boundary-anchor-mismatch",
      record.path,
      `declared boundary_parent "${record.boundary_parent}" does not match sole parent "${parents[0] ?? "none"}"`
    )];
  }
  return [];
}

function validateSchemaRecordHistory(repoRoot, record) {
  const diagnostics = [...(record.diagnostics ?? [])];
  if (!record.introducing_commit) {
    diagnostics.push(diagnostic("authorization-record-history-mismatch", record.path, record.id));
  }
  if (record.introducing_commit && gitObjectAt(repoRoot, `${record.introducing_commit}^`, record.path) !== null) {
    diagnostics.push(diagnostic("authorization-record-history-mismatch", record.path,
      "current authorization record was modified after its first recording"));
  }
  diagnostics.push(...dedicatedRecordProblems(repoRoot, record));
  diagnostics.push(...validateBoundaryParent(repoRoot, record));
  return { ...record, diagnostics };
}

function recordIsCurrent(record, policy) {
  return policy.authorization_discovery.current_statuses.includes(record.status);
}

function currentOperationRecords(records, operation, policy) {
  return records.filter((record) => record.operation === operation && recordIsCurrent(record, policy));
}

function selectionDiagnostics(records, allOperationRecords, { operation, changeId, archived, policy }) {
  if (archived && allOperationRecords.length > 0) {
    return [diagnostic("authorization-archive-only", changeId, `${operation} authorization belongs to an archived change`)];
  }
  if (records.length === 0) {
    if (allOperationRecords.some((record) => !recordIsCurrent(record, policy))) {
      return [diagnostic("authorization-inactive", changeId, `${operation} has only inactive authorization records`)];
    }
    return [diagnostic("authorization-current-missing", changeId, `${operation} has no applicable valid current authorization`)];
  }
  if (records.length > 1) {
    return [diagnostic("authorization-current-conflict", changeId, `${operation} has ${records.length} current authorization records`)];
  }
  return [];
}

export function evaluateAuthorizationSet(records, operation, policy, { changeId = "change", archived = false } = {}) {
  const operationRecords = records.filter((record) => record.operation === operation);

  if (archived && operationRecords.length > 0) {
    return { current: null, diagnostics: [diagnostic("authorization-archive-only", changeId, `${operation} authorization belongs to an archived change`)] };
  }

  // If any record in operationRecords declares supersession, resolve via DAG
  if (operationRecords.some((record) => Boolean(record.supersession))) {
    const cleanRecords = operationRecords.filter((record) => (record.diagnostics ?? []).length === 0);
    const graph = constructAuthorizationGraph(cleanRecords);
    const resolved = resolveEffectiveAuthority(graph);
    if (resolved.diagnostics.length > 0) {
      return { current: null, diagnostics: resolved.diagnostics };
    }
    return { current: resolved.effective, diagnostics: [] };
  }

  const current = currentOperationRecords(records, operation, policy)
    .filter((record) => (record.diagnostics ?? []).length === 0);
  const diagnostics = selectionDiagnostics(current, operationRecords, { operation, changeId, archived, policy });
  return { current: current.length === 1 && !archived ? current[0] : null, diagnostics };
}

const SIGNED_RECORD_FORMATS = Object.freeze(["SIGNED_MARKDOWN_BOOTSTRAP", "SCHEMA_JSON"]);

function signedRecordProblems(record, repoRoot, registry) {
  if (!SIGNED_RECORD_FORMATS.includes(record.record_format)) return [];
  const principal = registry.principals?.find((entry) => entry.id === record.principal_id);
  if (!principal || !principal.roles?.includes(record.authority_role)) {
    return [diagnostic("authorization-authority-invalid", record.path, record.id)];
  }
  const signed = verifySignedCommit(repoRoot, record.introducing_commit, principal);
  if (signed.verified) return [];
  return [diagnostic("authorization-signature-invalid", record.path, signed.reason ?? record.id)];
}

function proposalBindingProblems(record, repoRoot) {
  if (!record.authorized_proposal_commit) return [];
  const diagnostics = [];
  if (gitStdout(repoRoot, ["rev-parse", `${record.authorized_base_commit}^{tree}`]) !== record.authorized_base_tree) {
    diagnostics.push(diagnostic("authorization-base-tree-mismatch", record.path, record.id));
  }
  if (gitStdout(repoRoot, ["rev-parse", `${record.authorized_proposal_commit}^{tree}`]) !== record.authorized_proposal_tree) {
    diagnostics.push(diagnostic("authorization-proposal-tree-mismatch", record.path, record.id));
  }
  const changePath = relative(repoRoot, resolve(repoRoot, policyChangePath(record.change_id)));
  if (gitObjectAt(repoRoot, record.authorized_proposal_commit, changePath) !== record.authorized_change_subtree) {
    diagnostics.push(diagnostic("authorization-proposal-subtree-mismatch", record.path, record.id));
  }
  if (!isAncestorCommit(repoRoot, record.authorized_proposal_commit, "HEAD")) {
    diagnostics.push(diagnostic("authorization-proposal-not-ancestor", record.path, record.id));
  }
  return diagnostics;
}

function currentRecordDiagnostics(record, repoRoot, registry) {
  return [
    ...(record.diagnostics ?? []),
    ...signedRecordProblems(record, repoRoot, registry),
    ...proposalBindingProblems(record, repoRoot),
  ];
}

function policyChangePath(changeId) {
  return `openspec/changes/${changeId}`;
}

export function discoverAuthorizations(changeDir, repoRoot, policy, { operation, baseCommit = null } = {}) {
  const diagnostics = [];
  const indexed = indexRecords(changeDir, repoRoot, policy);
  diagnostics.push(...indexed.index.diagnostics);
  const schemaRecords = loadSchemaRecords(changeDir, repoRoot, policy).map((record) => validateSchemaRecordHistory(repoRoot, record));
  const records = [...indexed.records, ...schemaRecords];
  for (const record of indexed.records) diagnostics.push(...(record.diagnostics ?? []));
  const registry = loadTrustedAuthorityRegistry(repoRoot, policy, baseCommit);
  diagnostics.push(...registry.diagnostics);
  const evaluated = records.map((record) => {
    if (!recordIsCurrent(record, policy)) return record;
    const recordDiagnostics = currentRecordDiagnostics(record, repoRoot, registry.value);
    diagnostics.push(...recordDiagnostics);
    return { ...record, diagnostics: recordDiagnostics };
  });
  const archived = relative(repoRoot, changeDir).startsWith(`${policy.repository_evidence.archive_root}/`);
  const selection = evaluateAuthorizationSet(evaluated, operation, policy, { changeId: basename(changeDir), archived });
  diagnostics.push(...selection.diagnostics);
  return { records: evaluated, current: selection.current, registry, diagnostics };
}

export function authorizationCoversDelta(authorization, capabilityId, deltaObject) {
  if (!authorization) return false;
  if (!(authorization.authorized_capabilities ?? []).includes(capabilityId)) return false;
  return authorization.authorized_delta_objects?.[capabilityId] === deltaObject;
}
