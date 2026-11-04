import { cpus, platform } from "node:os";
import { runtimeFactsSnapshot } from "../lib/runtime-facts.mjs";

export function environmentLabel() {
  return { node: runtimeFactsSnapshot().node, platform: platform(), cpu_count: cpus().length };
}
