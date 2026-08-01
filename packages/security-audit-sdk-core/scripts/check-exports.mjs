import { readFile } from "node:fs/promises";
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const allowed = new Set([".", "./testing"]);
for (const key of Object.keys(pkg.exports ?? {})) {
  if (!allowed.has(key)) throw new Error(`unsupported public subpath: ${key}`);
}
for (const key of allowed) {
  if (!pkg.exports[key]) throw new Error(`missing public subpath: ${key}`);
}
const sdk = await import(new URL("../dist/index.js", import.meta.url));
for (const key of ["createSecurityAuditSdk", "validateSecurityAuditEvent", "CONTRACT_VERSION"]) {
  if (!(key in sdk)) throw new Error(`missing public export: ${key}`);
}
console.log("package exports verified");
