// Code-derived inventory. No frozen plan or SDK code is loaded here.
import { LOGOUT_CASES } from "./logout-cases.mjs";
import { MFA_CASES } from "./mfa-cases.mjs";
import { CONTACT_CASES, BRAND_CASES } from "./contact-cases.mjs";
import { LOCKOUT_CASES, UNLOCK_CASES } from "./lock-cases.mjs";
import { ROTATION_CASES } from "./rotation-cases.mjs";

export const CONCRETE_CASES = [...LOGOUT_CASES, ...MFA_CASES, ...CONTACT_CASES,
  ...BRAND_CASES, ...LOCKOUT_CASES, ...UNLOCK_CASES, ...ROTATION_CASES];
export const CASES_BY_ID = new Map(CONCRETE_CASES.map((entry) => [entry.case_id, entry]));
export const SIGNAL_IDS = ["S-LOGOUT", "S-MFA", "S-CONTACT", "S-LOCK", "S-UNLOCK", "S-ROTATE", "S-CRIT2"];
export const CASE_IDS = [...SIGNAL_IDS, ...CASES_BY_ID.keys()];
export const CORRECTED_AT = "8e6cdf781445574c67883a465eb37581ca14b5ab";
export const COMMENT = "https://github.com/nandohdc/bloodtrail/issues/804#issuecomment-6137646538";
