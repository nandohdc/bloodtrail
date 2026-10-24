#!/usr/bin/env node
import { spawn } from "node:child_process";
import { lstatSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function rejectSymbolicLink(entry, label) {
  if (entry.isSymbolicLink()) throw new Error(`symbolic link in harness discovery: ${label}`);
}

function lstatOptional(path, optional) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (optional && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function directory(path, optional = false) {
  const stat = lstatOptional(path, optional);
  if (!stat) return false;
  rejectSymbolicLink(stat, path);
  if (!stat.isDirectory()) throw new Error(`not a directory in harness discovery: ${path}`);
  return true;
}

function testFilesIn(parent, entry) {
  const path = join(parent, entry.name);
  rejectSymbolicLink(entry, path);
  if (entry.isDirectory()) return testFiles(path);
  return entry.name.endsWith(".test.mjs") ? [path] : [];
}

function testFiles(parent) {
  return readdirSync(parent, { withFileTypes: true }).flatMap((entry) => testFilesIn(parent, entry));
}

function killProcessGroup(child, grouped, onError) {
  try {
    if (grouped && child.pid) process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") onError(error);
  }
}

function listenForTermination(onSignal) {
  const handlers = { SIGINT: () => onSignal("SIGINT"), SIGTERM: () => onSignal("SIGTERM") };
  for (const [signal, handler] of Object.entries(handlers)) process.once(signal, handler);
  return () => {
    for (const [signal, handler] of Object.entries(handlers)) process.removeListener(signal, handler);
  };
}

function assertTimeout(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("invalid harness test timeout");
}

function terminationFailure(failure, signal) {
  if (failure) return failure;
  return signal ? new Error(`test process terminated: ${signal}`) : undefined;
}

function exitCode(failure, code, signal) {
  const error = terminationFailure(failure, signal);
  if (error) console.error(`Active harness self-tests failed: ${error.message}`);
  return error ? 1 : code ?? 1;
}

function spawnTests({ root, files }, grouped) {
  return spawn(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit", detached: grouped });
}

// A separate process group contains both Node's coordinator and its test workers. Killing only the
// coordinator leaves workers alive after a timeout. Wait for its close before reporting the result.
function executeTests({ root, files, timeoutMs }) {
  assertTimeout(timeoutMs);
  return new Promise((resolveResult) => {
    const grouped = process.platform !== "win32";
    const child = spawnTests({ root, files }, grouped);
    let failure;
    const terminate = () => killProcessGroup(child, grouped, (error) => { failure ??= error; });
    const abort = (error) => {
      failure = error;
      terminate();
    };
    const stopListening = listenForTermination((signal) => abort(new Error(`harness tests interrupted: ${signal}`)));
    const timer = setTimeout(() => abort(new Error(`ETIMEDOUT: harness tests exceeded ${timeoutMs} ms`)), timeoutMs);
    child.once("error", (error) => { failure = error; });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      stopListening();
      terminate();
      resolveResult(exitCode(failure, code, signal));
    });
  });
}

function testSuite(root, harness) {
  const tests = join(harness, "tests");
  directory(tests);
  const suite = testFiles(tests);
  if (suite.length === 0) throw new Error(`no self-tests in ${relative(root, harness)}`);
  return suite;
}

function harnessSuite(root, changes, entry) {
  if (entry.name === "archive") return [];
  rejectSymbolicLink(entry, entry.name);
  if (!entry.isDirectory()) return [];
  const harness = join(changes, entry.name, "harness");
  return directory(harness, true) ? testSuite(root, harness) : [];
}

function discoverHarnessFiles(root) {
  const changes = join(root, "openspec/changes");
  directory(changes);
  return readdirSync(changes, { withFileTypes: true })
    .flatMap((entry) => harnessSuite(root, changes, entry))
    .sort();
}

export async function runActiveHarnessTests({ root = REPOSITORY, timeoutMs = 600_000 } = {}) {
  try {
    const files = discoverHarnessFiles(root);
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
