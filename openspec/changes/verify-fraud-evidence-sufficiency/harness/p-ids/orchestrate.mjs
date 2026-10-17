import * as generic from "../lib/orchestrate.mjs";
import { ROLES } from "./roles.mjs";

export function runApprovedSession(input) {
  return generic.runApprovedSession({ ...input, probe: "P-ids", ticket: 800 });
}

export function runRoles(input) {
  return generic.runRoles({ ...input, probe: "P-ids", ticket: 800, roles: ROLES });
}

export function runSession(input) {
  return generic.runSession({ ...input, probe: "P-ids", ticket: 800, roles: ROLES });
}
