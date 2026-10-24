#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function directory(path, optional = false) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (optional && error.code === "ENOENT") return false;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`symbolic link in harness discovery: ${path}`);
  if (!stat.isDirectory()) throw new Error(`not a directory in harness discovery: ${path}`);
  return true;
}

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symbolic link in harness discovery: ${path}`);
    if (entry.isDirectory()) return testFiles(path);
    return entry.name.endsWith(".test.mjs") ? [path] : [];
  });
}

export function runActiveHarnessTests({ root = REPOSITORY, timeoutMs = 600_000 } = {}) {
  try {
    const changes = join(root, "openspec/changes");
    directory(changes);
    const files = [];
    for (const entry of readdirSync(changes, { withFileTypes: true })) {
      if (entry.name === "archive") continue;
      if (entry.isSymbolicLink()) throw new Error(`symbolic link in harness discovery: ${entry.name}`);
      if (!entry.isDirectory()) continue;
      const harness = join(changes, entry.name, "harness");
      if (!directory(harness, true)) continue;
      const tests = join(harness, "tests");
      directory(tests);
      const suite = testFiles(tests);
      if (suite.length === 0) throw new Error(`no self-tests in ${relative(root, harness)}`);
      files.push(...suite);
    }
    files.sort();
    if (files.length === 0) {
      console.log("Active harness self-tests not applicable: no active change harnesses");
      return 0;
    }
    for (const file of files) console.log(`Active harness self-test: ${relative(root, file)}`);
    const result = spawnSync(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit", timeout: timeoutMs, killSignal: "SIGKILL" });
    if (result.error || result.signal) throw result.error ?? new Error(`test process terminated: ${result.signal}`);
    return result.status ?? 1;
  } catch (error) {
    console.error(`Active harness self-tests failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = runActiveHarnessTests();
