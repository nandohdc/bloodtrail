import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { platform, release, type, arch } from "node:os";
import { statfsSync } from "node:fs";
import { command } from "./io.mjs";

export function runtimeFactsSnapshot() {
  const db = new DatabaseSync(":memory:");
  try {
    return { node: process.versions.node, isTransaction: db.isTransaction };
  } finally {
    db.close();
  }
}

// Shared runtime precondition. sessionPreflight runs it before claimOnce, so a
// wrong runtime refuses the run without spending the approval; runtimeFacts
// re-uses the same assertions so provenance facts stay consistent.
export function assertRuntimePrerequisites(facts = runtimeFactsSnapshot()) {
  assert.equal(Number(facts.node.split(".")[0]), 26, "Stage 2 requires Node 26");
  assert.equal(typeof facts.isTransaction, "boolean", "DatabaseSync.isTransaction missing");
}

export function runtimeFacts({ scratch }) {
  const db = new DatabaseSync(":memory:");
  let sqlite;
  let isTransaction;
  try {
    isTransaction = db.isTransaction;
    assertRuntimePrerequisites({ node: process.versions.node, isTransaction });
    sqlite = db.prepare("select sqlite_version() as version").get().version;
  } finally {
    db.close();
  }
  // Observed on a fresh connection: the property is present (a boolean), and no transaction is open.
  return {
    runtime: {
      node: process.versions.node, npm: command({ program: "npm", args: ["--version"] }).trim(), v8: process.versions.v8, sqlite,
      is_transaction_present: typeof isTransaction === "boolean", is_transaction_on_fresh_connection: isTransaction,
    },
    environment: { kernel: type(), release: release(), platform: platform(), arch: arch(), filesystem: `statfs.type:0x${statfsSync(scratch).type.toString(16)}` },
  };
}
