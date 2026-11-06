import { roleGuard as guard } from "../lib/role-guard.mjs";
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
import { senderControls } from "../lib/controls.mjs";
import { haltOnViolations, kitResolutions, recordedCall, senderSdk, serveSender } from "../lib/sender-role.mjs";
import { awaitProcessMessage, senderRun } from "./sender-phases.mjs";

const mode = haltOnViolations();
serveSender((message) => senderRun({
  message,
  deps: {
    core, sdkNode, senderSdk, recordedCall,
    senderControls: (port) => senderControls({ guard, port }),
    guardViolations: () => guard.violations,
    resolved: () => kitResolutions((specifier) => import.meta.resolve(specifier)),
    send: (value) => process.send(value),
    awaitMessage: (type) => awaitProcessMessage(process, type),
    onBeforeRun: () => { mode.halt = true; },
  },
}));
