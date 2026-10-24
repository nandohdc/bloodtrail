#!/usr/bin/env node
import { spawn } from "node:child_process";
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

// A separate process group contains both Node's coordinator and its test workers. Killing only the
// coordinator leaves workers alive after a timeout. Wait for its close before reporting the result.
function executeTests({ root, files, timeoutMs }) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("invalid harness test timeout");
  return new Promise((resolveResult) => {
    const grouped = process.platform !== "win32";
    const child = spawn(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit", detached: grouped });
    let failure;
    const terminate = () => {
      try {
        if (grouped && child.pid) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") failure ??= error;
      }
    };
    const interrupted = (signal) => () => {
      failure = new Error(`harness tests interrupted: ${signal}`);
      terminate();
    };
    const signals = { SIGINT: interrupted("SIGINT"), SIGTERM: interrupted("SIGTERM") };
    for (const [signal, handler] of Object.entries(signals)) process.once(signal, handler);
    const timer = setTimeout(() => {
      failure = new Error(`ETIMEDOUT: harness tests exceeded ${timeoutMs} ms`);
      terminate();
    }, timeoutMs);
    child.once("error", (error) => { failure = error; });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      for (const [name, handler] of Object.entries(signals)) process.removeListener(name, handler);
      terminate();
      if (signal) failure ??= new Error(`test process terminated: ${signal}`);
      if (failure) console.error(`Active harness self-tests failed: ${failure.message}`);
      resolveResult(failure ? 1 : code ?? 1);
    });
  });
}

export async function runActiveHarnessTests({ root = REPOSITORY, timeoutMs = 600_000 } = {}) {
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
    return await executeTests({ root, files, timeoutMs });
  } catch (error) {
    console.error(`Active harness self-tests failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runActiveHarnessTests();
