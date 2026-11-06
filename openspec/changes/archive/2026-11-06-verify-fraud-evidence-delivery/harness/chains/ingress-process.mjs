// Ingress role for the Stage 2 chains probe (#840, Q210). Runs inside the own service under the permission model.
// Binds process messages to the pure ingress handlers from ingress-role.mjs with the real collector package.
import { reportViolations } from "../lib/role-guard.mjs";
import * as collector from "@bloodtrail/security-audit-collector";
import { bindIngressProcess, defaultControlsProducer } from "./ingress-role.mjs";

reportViolations((violation) => process.send({ type: "violation", message: `non-loopback connection to ${violation.host}` }));

bindIngressProcess({
  collector,
  resolved: { collector: import.meta.resolve("@bloodtrail/security-audit-collector") },
  controlsFor: defaultControlsProducer,
  proc: process,
});
