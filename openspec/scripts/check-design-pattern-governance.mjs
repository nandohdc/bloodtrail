#!/usr/bin/env node
/**
 * Design-pattern governance checker.
 *
 * Read-only, dependency-free, deterministic: identical committed bytes, history,
 * and arguments produce identical classification and identical diagnostics, in
 * identical order. Nothing here branches on who is running it.
 *
 * Usage:
 *   node openspec/scripts/check-design-pattern-governance.mjs [options]
 *
 *   --phase <assessment|implementation|final|bootstrap|activation>   default: final
 *   --repo-root <path>      repository to inspect (default: this file's repository)
 *   --policy <path>         policy file, repository-relative
 *   --change <id>           restrict assessment evidence to one OpenSpec change
 *   --base <commit>         baseline for range inspection (default: the merge base with the protected mainline)
 *   --json                  emit a machine-readable report on stdout
 *   --help
 *
 * Exit codes: 0 on success, 1 on any objective failure, 2 on a usage error.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DiagnosticSink, formatDiagnostics } from "./design-pattern-governance/diagnostics.mjs";
import { GitUnavailableError, blobAt, resolveCommit, tryGit } from "./design-pattern-governance/git.mjs";
import { loadPolicy } from "./design-pattern-governance/policy.mjs";
import {
  checkDocumentVersion,
  compareSchemaCompatibility,
  loadSchema,
  validateDocument,
} from "./design-pattern-governance/schema.mjs";
import { loadCatalog, loadRegistry } from "./design-pattern-governance/catalog.mjs";
import { applyAssessmentRules } from "./design-pattern-governance/rules.mjs";
import { checkActorNeutralDocuments, checkCiJob, checkTemplates } from "./design-pattern-governance/documentation.mjs";
import {
  checkHiddenImplementation,
  checkOpenSpecAssociation,
  checkUnclassifiedPaths,
  classifyPaths,
  collectOpenSpecChanges,
  collectRangePaths,
  isGovernanceCore,
} from "./design-pattern-governance/perimeter.mjs";
import { matchesSelection } from "./design-pattern-governance/paths.mjs";
import {
  reportRetrospectiveException,
  requireCompleteHistory,
  verifyAssessmentOrdering,
} from "./design-pattern-governance/ancestry.mjs";
import { activationState, verifyActivation, verifyBootstrap } from "./design-pattern-governance/activation.mjs";
import {
  checkEmergencyTermination,
  checkGrandfatheredScope,
  emergencyPathSet,
  mainlineRevision,
  validateEmergencyRecords,
  validateGrandfathering,
  validateOptIns,
} from "./design-pattern-governance/provenance.mjs";

const DEFAULT_POLICY = "openspec/governance/design-pattern-policy.json";
const PHASES = new Set(["assessment", "implementation", "final", "bootstrap", "activation"]);

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const sink = new DiagnosticSink();
let report;
try {
  report = run(options, sink);
} catch (error) {
  if (error instanceof GitUnavailableError) {
    sink.fail("history-unavailable", ".", error.message);
    report = { phase: options.phase, activation: "unknown" };
  } else {
    throw error;
  }
}

// Diagnostics are attached here rather than by each return path. An early return
// that forgot them produced a report with no `failures` key, which read to a
// consumer as "no failures" — the fail-open this checker exists to prevent,
// reproduced in its own output format.
emit({ ...report, failures: sink.failures, warnings: sink.warnings, truncated: sink.truncated }, sink, options);
process.exit(sink.ok ? 0 : 1);

function run(opts, diagnostics) {
  const repositoryRoot = opts.repoRoot ?? discoverRepositoryRoot();
  const cwd = repositoryRoot;

  const { policy } = loadPolicy(repositoryRoot, opts.policyPath, diagnostics);
  if (policy === null) return { phase: opts.phase, activation: "unknown", repositoryRoot };

  const registry = loadRegistry(repositoryRoot, policy.invariant_registry.path, diagnostics);
  const catalog = registry
    ? loadCatalog(repositoryRoot, policy.catalog.path, policy.catalog.entry_count, registry, diagnostics)
    : null;

  const schemas = loadSchemas(repositoryRoot, policy, diagnostics);
  const state = activationState(repositoryRoot, policy, diagnostics);

  const context = {
    repositoryRoot,
    cwd,
    policy,
    registry,
    catalog,
    assessmentSchema: schemas.assessment,
    controlledValues: policy.controlled_values,
    memberships: {
      full_assessment_triggers: policy.full_assessment_triggers ?? [],
      security_dimensions: policy.security_dimensions ?? [],
    },
    securityDimensions: policy.security_dimensions ?? [],
    mainlineRevision: mainlineRevision(policy, cwd),
    earliestImplementationByChange: new Map(),
    observedTriggersByChange: new Map(),
    previouslyOptedIn: state.record?.opted_in_changes ?? [],
    provenanceExpansionTriggers: schemas.provenance?.scope_expansion_triggers ?? [],
  };

  if (opts.phase === "bootstrap") {
    verifyBootstrap(context, diagnostics);
    return summarise(opts, context, state, diagnostics);
  }

  if (opts.phase === "activation") {
    if (!state.active) {
      diagnostics.fail("activation-commit-absent", state.path ?? DEFAULT_POLICY,
        "activation was requested but no activation record exists; enforcement has not begun");
    } else {
      verifyActivation(state.record, state.path, context, diagnostics);
    }
    return summarise(opts, context, state, diagnostics);
  }

  checkAssessments(opts, context, schemas, diagnostics);

  if (opts.phase === "implementation" || opts.phase === "final") {
    checkPerimeter(opts, context, diagnostics);
  }

  if (opts.phase === "final") {
    checkActorNeutralDocuments(repositoryRoot, policy, diagnostics);
    checkTemplates(repositoryRoot, diagnostics);
    checkCiJob(repositoryRoot, policy, diagnostics);
    checkProvenance(context, schemas, diagnostics);
    if (state.active) verifyActivation(state.record, state.path, context, diagnostics);
  }

  return summarise(opts, context, state, diagnostics);
}

function loadSchemas(repositoryRoot, policy, diagnostics) {
  const loaded = {};
  for (const [key, path] of Object.entries(policy.schemas ?? {})) {
    loaded[key] = loadSchema(repositoryRoot, path, diagnostics);
  }
  return loaded;
}

/**
 * Assessment evidence is `assessment.json` beside the change's other artifacts.
 * Discovery is by path rather than by scanning prose, so an assessment cannot be
 * hidden from the checker by moving where it is described.
 */
function checkAssessments(opts, context, schemas, diagnostics) {
  const schema = schemas.assessment;
  if (!schema) return;

  for (const { changeId, path, document } of discoverAssessments(context.repositoryRoot, opts.change, diagnostics)) {
    if (!checkDocumentVersion(document, schema, path, diagnostics)) continue;

    // Structural and relational checks both run. Stopping at the first structural
    // failure would report a cardinality violation and hide the requirement it
    // actually breaches — and a reader who fixed only what was reported would
    // then meet the second diagnostic on the next run.
    validateDocument(document, schema, path, context, diagnostics);
    applyAssessmentRules(document, schema, context, path, diagnostics);

    if (reportRetrospectiveException(document.retrospective_exception, path, diagnostics)) {
      // A retrospective exception is the recorded reason ordering cannot be
      // reconstructed, so re-deriving it would fail on exactly the history the
      // exception exists to acknowledge is missing.
    } else if (document.ordering) {
      verifyAssessmentOrdering(document.ordering, governedPatterns(context.policy), context.cwd, path, diagnostics);
    }
    for (const trigger of document.applicability?.triggers_matched ?? []) {
      const existing = context.observedTriggersByChange.get(changeId) ?? [];
      context.observedTriggersByChange.set(changeId, [...existing, trigger]);
    }
  }
}

function discoverAssessments(repositoryRoot, only, diagnostics) {
  const changesRoot = resolve(repositoryRoot, "openspec/changes");
  const found = [];
  let entries;
  try {
    entries = readdirSync(changesRoot, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries.filter((candidate) => candidate.isDirectory() && candidate.name !== "archive")) {
    if (only && entry.name !== only) continue;
    const relativePath = `openspec/changes/${entry.name}/assessment.json`;
    const absolute = resolve(repositoryRoot, relativePath);
    try {
      statSync(absolute);
    } catch {
      continue;
    }
    try {
      found.push({ changeId: entry.name, path: relativePath, document: JSON.parse(readFileSync(absolute, "utf8")) });
    } catch (error) {
      diagnostics.fail("assessment-invalid-json", relativePath,
        `assessment JSON did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    }
  }
  if (only && found.length === 0) {
    diagnostics.fail("assessment-absent", `openspec/changes/${only}/assessment.json`,
      "the named change carries no assessment evidence");
  }
  return found;
}

function checkPerimeter(opts, context, diagnostics) {
  const { policy, cwd } = context;
  if (!requireCompleteHistory(cwd, diagnostics)) return;

  const base = opts.base ?? defaultBase(context);
  if (base === null) {
    diagnostics.fail("history-unavailable", ".",
      "cannot determine a baseline for range inspection; supply --base");
    return;
  }
  const head = resolveCommit("HEAD", cwd);
  if (head === null) {
    diagnostics.fail("history-unavailable", ".", "HEAD does not resolve to a commit");
    return;
  }
  if (base === head) return;

  const range = collectRangePaths(base, head, cwd, diagnostics);
  if (range === null) return;

  const byClass = classifyPaths(range.paths, policy);
  const emergencyPaths = emergencyPathSet(policy.emergency_records);
  checkUnclassifiedPaths(byClass, emergencyPaths, diagnostics);
  checkHiddenImplementation(range.paths, byClass, base, head, cwd, diagnostics);

  const governed = range.paths.filter((path) => matchesSelection(path, governedPatterns(policy)));
  const changes = collectOpenSpecChanges(
    range.paths,
    (id) => readAssessmentFor(context.repositoryRoot, id),
    activeChangeIds(context.repositoryRoot),
  );
  checkOpenSpecAssociation(governed, changes, diagnostics);
  checkGrandfatheredScopes(policy, governed, changes, context, diagnostics);
  checkSchemaEvolution(range.paths, base, policy, context, diagnostics);

  context.governanceCore = isGovernanceCore(range.paths, policy);
  context.rangeBase = base;
  context.rangeHead = head;
  context.rangePathCount = range.paths.length;
  context.rangeCommitCount = range.commits.length;
}

function checkProvenance(context, schemas, diagnostics) {
  const provenance = schemas.provenance;
  if (!provenance) return;
  const { policy, repositoryRoot } = context;
  const documentPath = "openspec/governance/design-pattern-policy.json";

  validateGrandfathering(policy.grandfathering, provenance, context, documentPath, diagnostics);
  validateOptIns(policy.opt_ins, policy.withdrawals, provenance, context, documentPath, diagnostics);
  validateEmergencyRecords(policy.emergency_records, provenance, context, documentPath, diagnostics);

  // An emergency record ends when its change merges or is abandoned. Reading
  // that from the change's actual presence is what keeps termination free of a
  // clock: a record left pending for a change that no longer exists is stale.
  for (const record of policy.emergency_records ?? []) {
    const changeExists = existsSync(resolve(repositoryRoot, "openspec/changes", record.change));
    const merged = archivedChangeExists(repositoryRoot, record.change);
    checkEmergencyTermination(record, changeExists, merged, documentPath, diagnostics);
  }
}

/**
 * Grandfathering covers the recorded scope and nothing else.
 *
 * The paths judged are the ones the grandfathered change *owns* — from its own
 * assessment — not the ones already inside its recorded bounds. Filtering to the
 * bounded paths first was the original mistake: it removed precisely the
 * out-of-scope paths the check exists to find, so the control could never fire.
 */
function checkGrandfatheredScopes(policy, governedPaths, changes, context, diagnostics) {
  const expansionTriggers = context.provenanceExpansionTriggers ?? [];
  for (const entry of policy.grandfathering ?? []) {
    const change = changes.find((candidate) => candidate.id === entry.change);
    const ownedPatterns = change?.ownedPaths ?? [`openspec/changes/${entry.change}/`];
    const touched = governedPaths.filter((path) => matchesSelection(path, ownedPatterns));
    if (touched.length === 0) continue;
    const observed = context.observedTriggersByChange?.get(entry.change) ?? [];
    checkGrandfatheredScope(entry, touched, observed, expansionTriggers, diagnostics);
  }
}

/**
 * A schema changed in this range is compared against its own baseline copy.
 *
 * This is the control that catches a governance change making its own evidence
 * optional. The comparison is against the version at the merge base, which the
 * candidate cannot edit — comparing a candidate schema to itself would accept
 * any weakening as long as it was internally consistent.
 */
function checkSchemaEvolution(paths, base, policy, context, diagnostics) {
  const schemaPaths = Object.values(policy.schemas ?? {}).filter((path) => paths.includes(path));
  for (const relativePath of schemaPaths) {
    const baselineText = blobAt(base, relativePath, context.cwd);
    if (baselineText === null) continue; // introduced by this change: nothing to weaken

    let baseline;
    try {
      baseline = JSON.parse(baselineText);
    } catch {
      diagnostics.fail("schema-invalid-json", relativePath, "the baseline copy of this schema does not parse");
      continue;
    }
    const candidate = loadSchema(context.repositoryRoot, relativePath, diagnostics);
    if (candidate === null) continue;
    compareSchemaCompatibility(baseline, candidate, relativePath, diagnostics);
  }
}

function activeChangeIds(repositoryRoot) {
  try {
    return readdirSync(resolve(repositoryRoot, "openspec/changes"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "archive")
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function readAssessmentFor(repositoryRoot, changeId) {
  try {
    return JSON.parse(readFileSync(resolve(repositoryRoot, "openspec/changes", changeId, "assessment.json"), "utf8"));
  } catch {
    return null;
  }
}

function archivedChangeExists(repositoryRoot, changeId) {
  try {
    return readdirSync(resolve(repositoryRoot, "openspec/changes/archive"))
      .some((entry) => entry.endsWith(`-${changeId}`));
  } catch {
    return false;
  }
}

/**
 * Patterns that count as governed *implementation* for ordering purposes.
 *
 * Planning artifacts are excluded. They are normative — changing one after
 * signing makes the record stale — but they are not implementation, and counting
 * them would mean the assessment commit always "introduces implementation" by
 * virtue of containing the assessment.
 */
function governedPatterns(policy) {
  return {
    include: (policy.path_classes ?? [])
      .filter((entry) => entry.class === "governed_implementation" || entry.class === "governance_core")
      .flatMap((entry) => entry.patterns ?? []),
    exclude: policy.planning_artifact_patterns ?? [],
  };
}

function defaultBase(context) {
  const reference = context.mainlineRevision;
  if (reference === null) return null;
  const result = tryGit(["merge-base", reference, "HEAD"], { cwd: context.cwd });
  return result.ok ? result.value.trim() : null;
}

function summarise(opts, context, state, diagnostics) {
  return {
    phase: opts.phase,
    repositoryRoot: context.repositoryRoot,
    policy: opts.policyPath,
    activation: state.active ? "active" : "pending",
    catalogEntries: context.policy?.catalog?.entry_count ?? null,
    governanceCore: context.governanceCore ?? null,
    rangeBase: context.rangeBase ?? null,
    rangeCommits: context.rangeCommitCount ?? null,
    rangePaths: context.rangePathCount ?? null,
    failures: diagnostics.failures,
    warnings: diagnostics.warnings,
    truncated: diagnostics.truncated,
  };
}

function emit(result, diagnostics, opts) {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const warnings = formatDiagnostics(diagnostics.warnings, "warnings");
  if (warnings) process.stdout.write(warnings);

  if (diagnostics.ok) {
    const activation = result.activation === "active"
      ? "enforcement active"
      : "enforcement pending: no activation record in protected history";
    const scope = result.rangePaths === null
      ? ""
      : `; inspected ${result.rangeCommits} commit(s) and ${result.rangePaths} path(s) from ${String(result.rangeBase).slice(0, 12)}`;
    process.stdout.write(`design-pattern governance passed in ${result.phase} phase: ${activation}${scope}\n`);
    return;
  }
  process.stderr.write(formatDiagnostics(diagnostics.failures, `design-pattern governance failed in ${result.phase} phase`));
  if (diagnostics.truncated) {
    process.stderr.write("  diagnostics were truncated at the bounded limit\n");
  }
}

function parseArguments(argv) {
  const parsed = { phase: "final", policyPath: DEFAULT_POLICY, json: false, help: false, repoRoot: null, change: null, base: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [flag, inlineValue] = argument.includes("=") ? splitOnce(argument, "=") : [argument, null];
    const value = () => inlineValue ?? argv[++index];
    switch (flag) {
      case "--phase": parsed.phase = value(); break;
      case "--repo-root": parsed.repoRoot = resolve(value()); break;
      case "--policy": parsed.policyPath = value(); break;
      case "--change": parsed.change = value(); break;
      case "--base": parsed.base = value(); break;
      case "--json": parsed.json = true; break;
      case "--help": case "-h": parsed.help = true; break;
      default:
        process.stderr.write(`unsupported argument: ${argument}\n${usage()}`);
        process.exit(2);
    }
  }
  if (!PHASES.has(parsed.phase)) {
    process.stderr.write(`unsupported phase: ${parsed.phase}\n${usage()}`);
    process.exit(2);
  }
  return parsed;
}

function splitOnce(value, separator) {
  const index = value.indexOf(separator);
  return [value.slice(0, index), value.slice(index + 1)];
}

function discoverRepositoryRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  const result = tryGit(["rev-parse", "--show-toplevel"], { cwd: here });
  if (result.ok) return result.value.trim();
  return resolve(here, "../..");
}

function usage() {
  return [
    "usage: node openspec/scripts/check-design-pattern-governance.mjs [options]",
    "",
    "  --phase <assessment|implementation|final|bootstrap|activation>  default: final",
    "  --repo-root <path>   repository to inspect",
    `  --policy <path>      policy file, repository-relative (default: ${DEFAULT_POLICY})`,
    "  --change <id>        restrict assessment evidence to one OpenSpec change",
    "  --base <commit>      baseline for range inspection",
    "  --json               emit a machine-readable report",
    "  --help",
    "",
  ].join("\n");
}
