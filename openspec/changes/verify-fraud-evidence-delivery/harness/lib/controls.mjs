// Planted-defect controls that run inside the live role processes before any probe traffic. Each must
// fire on its planted defect and stay silent on its null control; a control that does neither
// invalidates the run, because a green result would not show the check could have failed.
import { connect } from "node:net";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertSynthetic } from "./workload.mjs";

// The guard must refuse a documentation-range address before connecting (port 80: fetch itself blocks
// some ports, which would hide whether the guard fired).
const PLANTED_TARGET = "http://192.0.2.1:80/";

async function plantedGuard({ guard }) {
  const before = guard.violations.length;
  let refused = false;
  try {
    await fetch(PLANTED_TARGET);
  } catch {
    refused = true;
  }
  const fired = guard.violations.length === before + 1 && guard.violations.at(-1).host === "192.0.2.1";
  return { refused, fired };
}

function nullGuard({ guard, port }) {
  const before = guard.violations.length;
  return new Promise((resolveControl) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.end();
      resolveControl({ connected: true, silent: guard.violations.length === before });
    });
    socket.on("error", () => resolveControl({ connected: false, silent: guard.violations.length === before }));
  });
}

export async function guardControls({ guard, port }) {
  const planted = await plantedGuard({ guard });
  const control = await nullGuard({ guard, port });
  return { planted, null_control: control, holds: planted.refused && planted.fired && control.connected && control.silent };
}

function writeRefused(path) {
  try {
    writeFileSync(path, "planted");
  } catch (error) {
    return error.code === "ERR_ACCESS_DENIED";
  }
  unlinkSync(path);
  return false;
}

function writeAllowed(path) {
  try {
    writeFileSync(path, "null control");
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

function readAllowed(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

// S2 stop: writes outside scratch. The permission model must refuse a write outside the role's grant, and
// its null control must pass: a write inside the grant for a role that has one (the ingress), or else a
// read inside the read grant (the sender, which may write nowhere), so a model that refuses everything
// cannot pass for one that enforces the grant.
export function writeControls({ refusedPath, allowedPath, allowedReadPath }) {
  const planted = writeRefused(refusedPath);
  const control = allowedPath === undefined ? readAllowed(allowedReadPath) : writeAllowed(allowedPath);
  return { planted_refused: planted, null_control_allowed: control, holds: planted && control };
}

// A live control that did not fire on its planted defect, or fired on its null control, stops its role
// before any probe traffic: the run is invalidated rather than evaluated.
export function requireControls(controls) {
  const failed = Object.entries(controls).filter(([, control]) => control.holds !== true).map(([name]) => name);
  if (failed.length > 0) throw new Error(`planted-defect control failed before traffic: ${failed.join(", ")}`);
  return controls;
}

// S2 stop: non-synthetic data. A planted email-like identifier must be refused; synthetic ones pass.
export function syntheticControls() {
  let planted = false;
  try {
    assertSynthetic({ ids: ["alice@example.com"], addresses: [] });
  } catch {
    planted = true;
  }
  let control = true;
  try {
    assertSynthetic({ ids: ["syn-account-0000000a"], addresses: ["192.0.2.10"] });
  } catch {
    control = false;
  }
  return { planted_refused: planted, null_control_passed: control, holds: planted && control };
}

// Every sender role's live controls, run in the role's own service directory before any probe traffic.
export async function senderControls({ guard, port }) {
  return requireControls({
    loopback_guard: await guardControls({ guard, port }),
    write_outside_grant: writeControls({ refusedPath: join(process.cwd(), "planted-write"), allowedReadPath: join(process.cwd(), "package.json") }),
    synthetic_data: syntheticControls(),
  });
}
