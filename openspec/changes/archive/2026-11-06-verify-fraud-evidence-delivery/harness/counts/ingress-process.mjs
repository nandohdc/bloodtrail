import { reportViolations } from "../lib/role-guard.mjs";
import * as collector from "@bloodtrail/security-audit-collector";
import { bindIngressProcess, defaultControlsProducer } from "./ingress-role.mjs";

reportViolations((violation) => process.send({ type: "violation", message: `non-loopback connection to ${violation.host}` }));
bindIngressProcess({
  collector, proc: process, controlsFor: defaultControlsProducer,
  resolved: { collector: import.meta.resolve("@bloodtrail/security-audit-collector") },
});
