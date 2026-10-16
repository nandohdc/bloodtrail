import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { platform, release, type, arch } from "node:os";
import { statfsSync } from "node:fs";
import { command } from "./io.mjs";

export function runtimeFacts({ scratch }) {
  assert.equal(Number(process.versions.node.split(".")[0]), 26, "Stage P requires Node 26");
  const db = new DatabaseSync(":memory:");
  let sqlite;
  try {
    assert.equal(typeof db.isTransaction, "boolean", "DatabaseSync.isTransaction missing");
    sqlite = db.prepare("select sqlite_version() as version").get().version;
  } finally {
    db.close();
  }
  return {
    runtime: { node: process.versions.node, npm: command({ program: "npm", args: ["--version"] }).trim(), v8: process.versions.v8, sqlite, isTransaction: true },
    environment: { kernel: type(), release: release(), platform: platform(), arch: arch(), filesystem: `statfs.type:0x${statfsSync(scratch).type.toString(16)}` },
  };
}
