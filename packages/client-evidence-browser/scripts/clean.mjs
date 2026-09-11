import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const path of ["dist", "dist-tests", ".test-dist", ".verification-output"]) {
  await rm(resolve(packageRoot, path), { recursive: true, force: true });
}
for (const entry of await readdir(packageRoot)) {
  if (entry.endsWith(".tgz")) await rm(resolve(packageRoot, entry), { force: true });
}
