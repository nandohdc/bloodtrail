// Pure observation accessors for the Stage 2 copies probe (#839, Q162, Q169, Q172).
import { accountFor, accountingInputs } from "../lib/accounting.mjs";

function hasSenderPrerequisites(sender) {
  if (!sender) return false;
  if (!sender.deliveries) return false;
  return Array.isArray(sender.exchanges);
}

function hasPhaseRoles(phase) {
  if (!phase) return false;
  if (!phase.sender) return false;
  return Boolean(phase.ingress);
}

function hasAccountingPrerequisites(phase, planned) {
  if (!Number.isSafeInteger(planned) || planned <= 0) return false;
  if (!hasPhaseRoles(phase)) return false;
  if (!hasSenderPrerequisites(phase.sender)) return false;
  return Array.isArray(phase.ingress.read_back);
}

export function computeAccounting(phase, planned) {
  if (!hasAccountingPrerequisites(phase, planned)) {
    return { counts: { abandoned: -1, unexplained: -1 } };
  }
  return accountFor(accountingInputs({
    sender: phase.sender,
    ingress: phase.ingress,
    planned,
  }));
}
