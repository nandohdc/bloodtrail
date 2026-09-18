import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { discoverAuthorizations } from "./authorization-discovery.mjs";
import {
  diagnostic,
  extractRequirement,
  getJsonPointer,
} from "./shared.mjs";

const REQUIRED_WITHHELD_OPERATIONS = Object.freeze([
  "IMPLEMENT",
  "MERGE",
  "FOLD",
  "ACTIVATE",
  "RELEASE",
  "ARCHIVE",
]);

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameDebtObjects(left, right) {
  return left?.source_path === right?.source_path
    && left?.source_blob === right?.source_blob
    && left?.capability_path === right?.capability_path
    && left?.capability_blob === right?.capability_blob;
}

function debtObjects(debt) {
  if (!debt) return null;
  return {
    source_path: debt.source_path,
    source_blob: debt.source_blob,
    capability_path: debt.capability_path,
    capability_blob: debt.capability_blob,
  };
}

function historicalDebt(retirement, selected, pinSets) {
  const split = retirement.retired_from?.lastIndexOf(":") ?? -1;
  if (split <= 0) return null;
  const pinId = retirement.retired_from.slice(0, split);
  const debtId = retirement.retired_from.slice(split + 1);
  const pin = pinSets.find((entry) => entry.path !== selected.path && entry.value.id === pinId);
  const debt = pin?.value.debts?.find((entry) => entry.id === debtId);
  return pin && debt ? { pin, debt } : null;
}

function resolvingDebtObjects(retirement, selected, policy) {
  const assertion = (policy.semantic_assertions ?? [])
    .find((entry) => entry.id === retirement.assertion_id);
  const capability = selected.value.repository_state.capabilities
    .find((entry) => entry.id === assertion?.capability_id);
  if (!assertion || !capability) return null;
  return {
    source_path: selected.value.repository_state.source.path,
    source_blob: selected.value.repository_state.source.object,
    capability_path: capability.path,
    capability_blob: capability.object,
  };
}

function authorizationMatches(retirement, authorization, policy) {
  if (!authorization) return false;
  const withheld = new Set(authorization.withheld ?? []);
  return authorization.operation === "RESOLVE_DEBT"
    && authorization.grant === policy.governance_authorities.debt_resolution_grant
    && REQUIRED_WITHHELD_OPERATIONS.every((operation) => withheld.has(operation))
    && retirement.authorization.id === authorization.id
    && retirement.authorization.path === authorization.path
    && retirement.authorization.object === authorization.object
    && retirement.authorization.operation === authorization.operation
    && retirement.authorization.grant === authorization.grant;
}

function authorizationSelfReferencesPin(retirement, policy, pinSets) {
  const pinRoot = `${policy.repository_evidence.pin_sets_root.replace(/\/$/, "")}/`;
  const pinObjects = new Set(pinSets.map((entry) => entry.object).filter(Boolean));
  return retirement.authorization.path.startsWith(pinRoot)
    || pinObjects.has(retirement.authorization.object);
}

function lineageMatches(retirement, inherited) {
  if (!inherited || inherited.debt.id !== retirement.id) return false;
  const expected = [...(inherited.debt.lineage ?? []), retirement.retired_from];
  return sameValues(retirement.lineage, expected);
}

function bindingMatches(retirement, selected, policy, inherited) {
  if (!inherited) return false;
  return sameDebtObjects(retirement.prior, debtObjects(inherited.debt))
    && sameDebtObjects(retirement.resolving, resolvingDebtObjects(retirement, selected, policy));
}

export function validateDebtRetirementEvidence({
  retirement,
  selected,
  pinSets,
  policy,
  authorization,
  assertionResolved,
}) {
  const diagnostics = [];
  const subject = `${selected.path}#/retired_debts/${retirement.id}`;
  const inherited = historicalDebt(retirement, selected, pinSets);

  if (!authorizationMatches(retirement, authorization, policy)) {
    diagnostics.push(diagnostic("debt-retirement-unauthorized", subject,
      "retirement requires one exact current RESOLVE_DEBT authorization with all other authorities withheld"));
  }
  if (!bindingMatches(retirement, selected, policy, inherited)) {
    diagnostics.push(diagnostic("debt-retirement-binding-mismatch", subject,
      "prior and resolving objects must exactly bind the historical debt and current repository state"));
  }
  if (!assertionResolved || selected.value.debts?.some((debt) => debt.id === retirement.id)) {
    diagnostics.push(diagnostic("debt-retirement-unsubstantiated", subject,
      "the bound assertion must be evaluable and absent from the resolving objects"));
  }
  if (authorizationSelfReferencesPin(retirement, policy, pinSets)) {
    diagnostics.push(diagnostic("debt-retirement-self-authorized", subject,
      "a pin set cannot authorize its own debt retirement"));
  }
  if (!lineageMatches(retirement, inherited)) {
    diagnostics.push(diagnostic("baseline-conflict-not-inherited", subject,
      "retirement lineage must extend the exact historical debt lineage"));
  }
  return diagnostics;
}

function blobText(repoRoot, object) {
  if (!object) return null;
  const result = spawnSync("git", ["cat-file", "-p", object], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout : null;
}

function assertionResolvedByPinnedObjects(repoRoot, policy, retirement) {
  const assertion = (policy.semantic_assertions ?? [])
    .find((entry) => entry.id === retirement.assertion_id);
  if (!assertion || assertion.adapter !== "source-value-present-in-requirement") return false;
  const sourceText = blobText(repoRoot, retirement.resolving.source_blob);
  const capabilityText = blobText(repoRoot, retirement.resolving.capability_blob);
  if (sourceText === null || capabilityText === null) return false;
  let source;
  let value;
  try {
    source = JSON.parse(sourceText);
    value = getJsonPointer(source, assertion.source_pointer);
  } catch {
    return false;
  }
  const requirement = extractRequirement(capabilityText, assertion.requirement_heading);
  return requirement !== null && requirement.includes(`\`${String(value)}\``);
}

export function validateDebtRetirements(repoRoot, policy, selected, pinSets, { baseCommit = null } = {}) {
  const retirements = selected?.value.retired_debts ?? [];
  if (retirements.length === 0) return [];
  const changeDir = resolve(repoRoot, policy.repository_evidence.active_changes_root, policy.change_id);
  const discovered = discoverAuthorizations(changeDir, repoRoot, policy, {
    operation: "RESOLVE_DEBT",
    baseCommit,
  });
  return retirements.flatMap((retirement) => validateDebtRetirementEvidence({
    retirement,
    selected,
    pinSets,
    policy,
    authorization: discovered.current,
    assertionResolved: assertionResolvedByPinnedObjects(repoRoot, policy, retirement),
  }));
}
