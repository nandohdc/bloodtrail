import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { byCodePoint, packageRoot, readJson, repositoryRoot } from "./verification-helpers.mjs";

export const supportedModes = Object.freeze(["active", "governed", "archived"]);

const PREMATURE_FAILURE_ID_BY_PHASE = Object.freeze({
  "technical-review": "active-technical-review-premature",
  "owner-governance": "active-owner-decision-premature",
  "merge-archive": "active-merge-archive-pending",
});
export const lifecycleMetadata = Object.freeze(
  await readJson(resolve(packageRoot, "verification-lifecycle.json")),
);

export class LifecycleVerificationError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "LifecycleVerificationError";
    this.code = code;
  }
}

export function parseLifecycleArguments(argv = process.argv.slice(2), env = process.env) {
  let mode = env.SDK_VERIFICATION_MODE ?? "auto";
  let change = env.SDK_VERIFICATION_CHANGE ?? lifecycleMetadata.remediationChange.name;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--mode") mode = argv[++index];
    else if (argument.startsWith("--mode=")) mode = argument.slice("--mode=".length);
    else if (argument === "--change") change = argv[++index];
    else if (argument.startsWith("--change=")) change = argument.slice("--change=".length);
    else throw new LifecycleVerificationError("LIFECYCLE_ARGUMENT", `unsupported argument ${argument}`);
  }
  if (!["auto", ...supportedModes].includes(mode)) {
    throw new LifecycleVerificationError("LIFECYCLE_MODE", `mode must be auto, ${supportedModes.join(", ")}`);
  }
  const knownChanges = [lifecycleMetadata.originalSdkChange.name, lifecycleMetadata.remediationChange.name];
  if (!knownChanges.includes(change)) {
    throw new LifecycleVerificationError("LIFECYCLE_CHANGE", `unknown governed change ${change}`);
  }
  return { mode, change };
}

export async function resolveVerificationLifecycle(options = {}) {
  const root = options.repositoryRoot ?? repositoryRoot;
  const parsed = options.mode || options.change
    ? {
        mode: options.mode ?? "auto",
        change: options.change ?? lifecycleMetadata.remediationChange.name,
      }
    : parseLifecycleArguments(options.argv, options.env);
  const original = lifecycleMetadata.originalSdkChange;
  const remediation = lifecycleMetadata.remediationChange;
  const originalActive = resolve(root, "openspec/changes", original.name);
  const originalArchive = resolve(root, original.archive);
  const remediationActive = resolve(root, remediation.active);
  const remediationArchives = await matchingArchives(root, new RegExp(remediation.archivePattern));

  let mode = parsed.mode;
  if (mode === "auto") {
    if (parsed.change === original.name) mode = "archived";
    else if (existsSync(remediationActive)) mode = "active";
    else if (remediationArchives.length === 1) mode = "archived";
    else throw new LifecycleVerificationError(
      "LIFECYCLE_AUTO",
      `cannot select lifecycle for ${parsed.change}: active=${existsSync(remediationActive)}, archives=${remediationArchives.length}`,
    );
  }

  if (parsed.change === original.name && mode !== "archived") {
    throw new LifecycleVerificationError("LIFECYCLE_ORIGINAL", `${original.name} is governed only as archived evidence`);
  }
  if (parsed.change === original.name) {
    requireState(!existsSync(originalActive), "ORIGINAL_ACTIVE_PRESENT", "archived original SDK change must not remain active");
    requireState(existsSync(originalArchive), "ORIGINAL_ARCHIVE_MISSING", `expected archive ${original.archive} is absent`);
  } else if (mode === "active" || mode === "governed") {
    requireState(existsSync(remediationActive), "ACTIVE_CHANGE_MISSING", `${remediation.name} must exist in ${mode} mode`);
    requireState(remediationArchives.length === 0, "ACTIVE_CHANGE_ARCHIVED", `${remediation.name} must not also have a dated archive in ${mode} mode`);
  } else {
    requireState(!existsSync(remediationActive), "ARCHIVED_CHANGE_ACTIVE", `${remediation.name} must be absent from active changes in archived mode`);
    requireState(remediationArchives.length === 1, "ARCHIVE_CARDINALITY", `expected exactly one dated ${remediation.name} archive, found ${remediationArchives.length}`);
  }

  return Object.freeze({
    mode,
    change: parsed.change,
    root,
    originalArchive,
    originalActive,
    remediationActive,
    remediationArchives,
    currentChangeRoot: currentChangeRootFor(parsed, original, mode, originalArchive, remediationArchives, remediationActive),
  });
}

export function parseTaskChecklist(text) {
  return [...text.matchAll(/^- \[([ x])\] (\d+\.\d+)\s+(.+)$/mg)].map((match) => ({
    id: match[2],
    done: match[1] === "x",
    description: match[3],
  }));
}

export function evaluateActiveTaskProgress(taskEntries, options = {}) {
  const groups = options.groups ?? lifecycleMetadata.remediationChange.taskGroups;
  const expectedTaskCount = options.expectedTaskCount ?? lifecycleMetadata.remediationChange.taskCount;
  const failures = [];
  const taskById = new Map();
  for (const task of taskEntries) {
    if (taskById.has(task.id)) failures.push(boundedFailure("active-task-inventory", "tasks.md", `duplicate task ${task.id}`));
    taskById.set(task.id, task);
  }
  if (taskEntries.length !== expectedTaskCount) {
    failures.push(boundedFailure("active-task-total", "tasks.md", `expected ${expectedTaskCount} tasks, found ${taskEntries.length}`));
  }

  const mappedIds = new Set();
  const resolvedGroups = groups.map((group) => {
    const expectedIds = expandTaskRange(group.taskRange);
    const tasks = expectedIds.map((id) => taskById.get(id)).filter(Boolean);
    if (tasks.length !== expectedIds.length) {
      failures.push(boundedFailure("active-task-inventory", "verification-lifecycle.json", `invalid task range for ${group.id}`));
    }
    for (const id of expectedIds) {
      if (mappedIds.has(id)) failures.push(boundedFailure("active-task-inventory", "verification-lifecycle.json", `task ${id} is mapped more than once`));
      mappedIds.add(id);
    }
    return {
      ...group,
      tasks,
      completed: tasks.length > 0 && tasks.every((task) => task.done),
      started: tasks.some((task) => task.done),
    };
  });

  for (const task of taskEntries.filter((entry) => entry.done && !mappedIds.has(entry.id))) {
    failures.push(boundedFailure("active-task-unmapped", "tasks.md", `checked task ${task.id} is not mapped to a lifecycle group`));
  }
  if (mappedIds.size !== expectedTaskCount || taskEntries.some((task) => !mappedIds.has(task.id))) {
    failures.push(boundedFailure("active-task-inventory", "verification-lifecycle.json", `task-group inventory maps ${mappedIds.size}/${expectedTaskCount} tasks`));
  }

  let earliestIncomplete = resolvedGroups.findIndex((group) => !group.completed);
  if (earliestIncomplete === -1) earliestIncomplete = resolvedGroups.length;
  for (let index = earliestIncomplete + 1; index < resolvedGroups.length; index += 1) {
    const group = resolvedGroups[index];
    if (!group.started) continue;
    const prior = resolvedGroups[earliestIncomplete];
    const id = PREMATURE_FAILURE_ID_BY_PHASE[group.phase] ?? "active-task-order";
    failures.push(boundedFailure(id, "tasks.md", `${group.id} started before ${prior?.id ?? "the preceding group"} completed`));
  }

  const ownerGroup = resolvedGroups.find((group) => group.phase === "owner-governance");
  if (ownerGroup?.started && (!options.exactTechnicalCommit || !options.technicalReviewPacket)) {
    failures.push(boundedFailure("active-owner-evidence", "technical-review-packet.md", "owner-decision tasks require an exact technical commit and review packet"));
  }
  const mergeGroup = resolvedGroups.find((group) => group.phase === "merge-archive");
  if (mergeGroup?.started) {
    failures.push(boundedFailure("active-merge-archive-pending", "tasks.md", "merge and archive tasks must remain pending in active mode"));
  }

  return Object.freeze({
    failures: Object.freeze(failures),
    completedGroups: Object.freeze(resolvedGroups.filter((group) => group.completed).map((group) => group.id)),
    nextGroup: resolvedGroups.find((group) => !group.completed)?.id ?? null,
    checkedTasks: taskEntries.filter((task) => task.done).length,
  });
}

function expandTaskRange(range) {
  const [startSection, startItem] = range.start.split(".").map(Number);
  const [endSection, endItem] = range.end.split(".").map(Number);
  if (!Number.isInteger(startSection) || startSection !== endSection || !Number.isInteger(startItem) || !Number.isInteger(endItem) || endItem < startItem) return [];
  return Array.from({ length: endItem - startItem + 1 }, (_, index) => `${startSection}.${startItem + index}`);
}

export function extractRequirementBody(text) {
  const firstRequirement = text.indexOf("### Requirement:");
  return firstRequirement === -1 ? "" : text.slice(firstRequirement).trim();
}

export function extractRequirementBlocks(text) {
  const matches = [...text.matchAll(/^### Requirement:.+$(?:\n(?!### Requirement:)[\s\S]*?)*(?=^### Requirement:|\s*$)/mg)];
  return matches.map((match) => match[0].trim()).filter(Boolean);
}

export function boundedFailure(id, file, message) {
  return Object.freeze({ id: String(id), file: String(file), message: String(message).slice(0, 240) });
}

async function matchingArchives(root, pattern) {
  const archiveRoot = resolve(root, "openspec/changes/archive");
  let entries;
  try {
    entries = await readdir(archiveRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `openspec/changes/archive/${entry.name}`)
    .filter((path) => pattern.test(path))
    .sort(byCodePoint)
    .map((path) => resolve(root, path));
}

function requireState(condition, code, message) {
  if (!condition) throw new LifecycleVerificationError(code, message);
}

export async function readText(path) {
  return readFile(path, "utf8");
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const lifecycle = await resolveVerificationLifecycle();
  process.stdout.write(`verification lifecycle resolved: ${lifecycle.mode} (${lifecycle.change})\n`);
}

function currentChangeRootFor(parsed, original, mode, originalArchive, remediationArchives, remediationActive) {
  if (parsed.change === original.name) return originalArchive;
  if (mode === "archived") return remediationArchives[0];
  return remediationActive;
}
