import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repositoryRoot = resolve(packageRoot, "../..");

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    throw new Error(`${command} ${args.join(" ")} failed with exit status ${String(result.status)}`);
  }
  return result.stdout ?? "";
}

export const byCodePoint = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
