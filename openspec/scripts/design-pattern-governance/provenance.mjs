/**
 * Grandfathering, opt-in, withdrawal, and emergency classification.
 *
 * The two grandfathering classes are alternatives. An earlier draft of this
 * policy required a change to be both present in the merge commit's tree and
 * only on a remote branch, which nothing can satisfy; a rule that cannot be met
 * is not a strict rule, it is a dead one.
 *
 * Emergency classification is bound to one exact change and ends when that change
 * merges or is abandoned. It never consults a wall clock, because a time-based
 * exemption expires while nobody is looking and renews itself by being forgotten.
 */

import { objectAtPath, resolveCommit, tryGit } from "./git.mjs";
import { matchesAny } from "./paths.mjs";
import { validateRecord } from "./schema.mjs";

export function validateGrandfathering(entries, provenanceSchema, context, documentPath, sink) {
  const seen = new Set();
  for (const entry of entries ?? []) {
    if (seen.has(entry.change)) {
      sink.fail("grandfathering-duplicate", documentPath, `change ${entry.change} has more than one grandfathering entry`);
    }
    seen.add(entry.change);

    const definition = entry.class === "mainline_present"
      ? provenanceSchema.records.grandfathering_mainline_present
      : provenanceSchema.records.grandfathering_external_in_flight;

    if (!definition) {
      sink.fail("grandfathering-class-unknown", documentPath, `grandfathering class ${String(entry.class)} is not defined`);
      continue;
    }
    validateRecord(entry, definition, documentPath, context, sink);

    if (entry.class === "mainline_present") verifyMainlinePresent(entry, context, documentPath, sink);
    if (entry.class === "external_in_flight") verifyExternalInFlight(entry, context, documentPath, sink);
  }
}

function verifyMainlinePresent(entry, context, documentPath, sink) {
  const { cwd, mainlineRevision } = context;
  if (!mainlineRevision) return;
  const actual = objectAtPath(mainlineRevision, entry.proposal_path, cwd);
  if (actual === null) {
    sink.fail("grandfathering-not-in-mainline", entry.proposal_path,
      `change ${entry.change} is recorded as mainline_present but its proposal is absent from ${mainlineRevision}`);
    return;
  }
  if (actual !== entry.proposal_blob) {
    sink.fail("grandfathering-proposal-blob-mismatch", entry.proposal_path,
      `recorded proposal blob ${entry.proposal_blob.slice(0, 12)} differs from mainline's ${actual.slice(0, 12)}`);
  }
}

function verifyExternalInFlight(entry, context, documentPath, sink) {
  const { cwd, mainlineRevision } = context;
  if (mainlineRevision) {
    const present = objectAtPath(mainlineRevision, `openspec/changes/${entry.change}/proposal.md`, cwd);
    if (present !== null) {
      sink.fail("grandfathering-class-mismatch", documentPath,
        `change ${entry.change} is recorded as external_in_flight but is present in ${mainlineRevision}`);
    }
  }
  if (resolveCommit(entry.branch_head, cwd) === null) {
    sink.fail("grandfathering-branch-head-unresolvable", documentPath,
      `recorded branch head ${String(entry.branch_head).slice(0, 12)} for ${entry.change} is not in this repository`);
  }
}

/**
 * Grandfathering covers the recorded scope and nothing else. Expansion is the
 * failure this guards: a change admitted for one bounded correction quietly
 * growing a public API under the same exemption.
 */
export function checkGrandfatheredScope(entry, changedPaths, observedTriggers, expansionTriggers, sink) {
  for (const path of changedPaths) {
    if (matchesAny(path, entry.bounded_paths ?? [])) continue;
    sink.fail("grandfathered-scope-expanded", path,
      `path is outside the recorded scope of grandfathered change ${entry.change} and requires normal full governance`);
  }
  for (const trigger of observedTriggers) {
    if (!expansionTriggers.includes(trigger)) continue;
    sink.fail("grandfathered-scope-expanded", entry.change,
      `grandfathered change adds ${trigger}, which requires normal full governance for the expanded scope`);
  }
}

export function validateOptIns(optIns, withdrawals, provenanceSchema, context, documentPath, sink) {
  const definition = provenanceSchema.records.opt_in;
  const byChange = new Map();
  for (const entry of optIns ?? []) {
    validateRecord(entry, definition, documentPath, context, sink);
    byChange.set(entry.change, entry);
    if (resolveCommit(entry.commit, context.cwd) === null) {
      sink.fail("optin-commit-unresolvable", documentPath, `opt-in for ${entry.change} names a commit that is not in this history`);
    }
  }

  const withdrawalDefinition = provenanceSchema.records.withdrawal;
  for (const entry of withdrawals ?? []) {
    validateRecord(entry, withdrawalDefinition, documentPath, context, sink);
    const optIn = byChange.get(entry.change);
    if (!optIn) {
      sink.fail("withdrawal-without-optin", documentPath, `withdrawal for ${entry.change} matches no recorded opt-in`);
      continue;
    }
    if (optIn.commit !== entry.withdraws_opt_in_commit) {
      sink.fail("withdrawal-optin-mismatch", documentPath,
        `withdrawal for ${entry.change} names a different opt-in commit than the recorded one`);
    }
    const earliest = context.earliestImplementationByChange?.get(entry.change);
    if (earliest) {
      sink.fail("withdrawal-after-implementation", documentPath,
        `opt-in for ${entry.change} became irrevocable at its first governed implementation commit ${earliest.slice(0, 12)}`);
    }
  }

  // Silent withdrawal: an opt-in that was recorded and is now simply gone. The
  // known set is supplied by the caller from the previous activation evidence,
  // so disappearance is detected rather than inferred from its own absence.
  for (const change of context.previouslyOptedIn ?? []) {
    if (byChange.has(change)) continue;
    const withdrawn = (withdrawals ?? []).some((entry) => entry.change === change);
    if (!withdrawn) {
      sink.fail("withdrawal-silent", documentPath,
        `opt-in for ${change} disappeared without explicit project-owner withdrawal evidence`);
    }
  }
}

export function validateEmergencyRecords(records, provenanceSchema, context, documentPath, sink) {
  const definition = provenanceSchema.records.emergency;
  const forbidden = definition.forbidden_fields ?? [];
  const nonDowngradable = definition.non_downgradable_triggers ?? [];
  const seen = new Set();

  for (const entry of records ?? []) {
    validateRecord(entry, definition, documentPath, context, sink);

    for (const field of forbidden) {
      if (entry[field] !== undefined) {
        sink.fail("emergency-clock-based", documentPath,
          `emergency record for ${entry.change} declares ${field}; emergency classification never expires on a clock`);
      }
    }

    if (seen.has(entry.change)) {
      sink.fail("emergency-record-reused", documentPath, `more than one emergency record binds change ${entry.change}`);
    }
    seen.add(entry.change);

    const attempted = (context.observedTriggersByChange?.get(entry.change) ?? [])
      .filter((trigger) => nonDowngradable.includes(trigger));
    if (attempted.length > 0 && entry.conservative_path_class !== "governed_implementation") {
      sink.fail("emergency-trigger-downgrade", documentPath,
        `emergency record for ${entry.change} attempts to downgrade ${attempted.join(", ")}`);
    }

    if (entry.disposition !== "conservative_full_assessment") {
      sink.fail("emergency-assessment-downgrade", documentPath,
        `emergency record for ${entry.change} must still require a full assessment`);
    }

    if (entry.terminated_by === "pending") {
      sink.warn("emergency-classification-in-effect", documentPath,
        `change ${entry.change} proceeds under emergency classification with a conservative full assessment; follow-up ${entry.follow_up} is mandatory`);
    }
  }
}

/**
 * Termination is read from the change's actual state, not from a date. A merged
 * or abandoned change ends its emergency record; a record still marked pending
 * for a change that is gone is itself a failure.
 */
export function checkEmergencyTermination(entry, changeExists, changeMerged, documentPath, sink) {
  if (entry.terminated_by === "pending" && !changeExists && !changeMerged) {
    sink.fail("emergency-not-terminated", documentPath,
      `emergency record for ${entry.change} is still pending although the change is neither active nor merged`);
  }
  if (entry.terminated_by !== "pending" && changeExists) {
    sink.fail("emergency-terminated-early", documentPath,
      `emergency record for ${entry.change} is marked ${entry.terminated_by} while the change is still active`);
  }
}

export function emergencyPathSet(records) {
  const paths = new Set();
  for (const entry of records ?? []) {
    if (entry.terminated_by !== "pending") continue;
    for (const path of entry.affected_paths ?? []) paths.add(path);
  }
  return paths;
}

export function mainlineRevision(policy, cwd) {
  const reference = policy.protected_mainline?.reference;
  if (typeof reference !== "string") return null;
  for (const candidate of [reference, `refs/remotes/origin/${reference.replace("refs/heads/", "")}`, reference.replace("refs/heads/", "")]) {
    const resolved = tryGit(["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`], { cwd });
    if (resolved.ok) return resolved.value.trim();
  }
  return null;
}
