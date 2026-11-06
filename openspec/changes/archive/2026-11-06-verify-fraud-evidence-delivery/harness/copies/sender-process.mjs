// Sender role for the Stage 2 copies probe (#839, Q155, Q168). Runs inside the own service under the permission model.
// Binds process messages to the pure sender logic from sender-phases.mjs with real SDK packages.
import { roleGuard as guard } from "../lib/role-guard.mjs";
import { randomBytes } from "node:crypto";
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
import { senderControls } from "../lib/controls.mjs";
import { haltOnViolations, kitResolutions, recordedCall, senderSdk, serveSender } from "../lib/sender-role.mjs";
import { awaitProcessMessage, senderRun } from "./sender-phases.mjs";

const mode = haltOnViolations();

serveSender((message) => senderRun({
  message,
  deps: {
    core,
    sdkNode,
    senderSdk,
    senderControls: (port) => senderControls({ guard, port }),
    guardViolations: () => guard.violations,
    resolved: () => kitResolutions((specifier) => import.meta.resolve(specifier)),
    send: (msg) => process.send(msg),
    awaitMessage: (type) => awaitProcessMessage(process, type),
    randomBytes,
    recordedCall,
    onBeforeRun: () => { mode.halt = true; },
  },
}));
