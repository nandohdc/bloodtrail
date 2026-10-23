// The files copied into the own service for the outages probe's two role processes, relative to harness/.
// Its role scripts load the tracer's, so the inventory is the two shims plus the tracer's inventory. The
// runner checks before any approval is spent that each role script's relative import closure is inside this
// list, and that every copied byte equals its blob at the approved head.
import { PROBE_FILES as TRACER_FILES } from "../tracer/files.mjs";

export const PROBE_FILES = Object.freeze(["outages/sender-process.mjs", "outages/ingress-process.mjs", ...TRACER_FILES]);
