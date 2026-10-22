export const ROLES = Object.freeze([
  { role: "setup", kind: "setup" },
  { role: "core-A", emissions: 100, inspect: true, precondition: true },
  { role: "core-B", emissions: 100, precondition: true },
  { role: "core-C", operations: 10 },
  { role: "core-D", operations: 10 },
  { role: "core-E", emissions: 3 },
  { role: "core-F", operationsFirst: 1, emissions: 3 },
  { role: "core-G", kind: "two-instance" },
  { role: "controls", kind: "controls" },
  { role: "node-A", emissions: 100, operations: 10 },
  { role: "node-B", emissions: 100, operations: 10 },
  { role: "node-C", emissions: 3, undefinedIdentifiers: true },
  { role: "node-D", emissions: 3, undefinedIdentifiers: true },
  { role: "core-H", emissions: 100, randomProvider: true },
  { role: "core-I", emissions: 100, randomProvider: true },
]);

export const PROBE_FILES = [
  "p-ids/probe-process.mjs", "p-ids/roles.mjs", "p-ids/workload.mjs", "p-ids/controls.mjs", "p-ids/measure.mjs",
  "lib/ledger.mjs", "lib/observe.mjs", "lib/io.mjs",
];
