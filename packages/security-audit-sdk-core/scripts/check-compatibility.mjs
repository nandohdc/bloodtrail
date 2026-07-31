import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(await readFile(resolve(root, "compatibility.json"), "utf8"));
const major = Number(process.versions.node.split(".")[0]);
if (!policy.node.supportedMajors.includes(major)) throw new Error(`unsupported Node major ${major}`);
if (policy.contractVersion !== "1.0.0") throw new Error("compatibility policy contract drift");
for (const key of ["patch", "minor", "major"]) {
  if (!Array.isArray(policy.semverClassification?.[key]) || policy.semverClassification[key].length === 0) {
    throw new Error(`missing SDK semver compatibility fixture: ${key}`);
  }
}

const sdk = await import(resolve(root, "dist/index.js"));
if (sdk.CONTRACT_VERSION !== policy.contractVersion) throw new Error("runtime contract version drift");
if (sdk.EVENT_METHODS.length !== 24) throw new Error("named API catalog coverage drift");
for (const method of sdk.EVENT_METHODS) {
  if (typeof sdk.createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "compat-producer", version: "1.0.0" },
    service: { name: "compat-service" },
    environment: { name: "compat" },
    sink: { async emit() { return { status: "accepted" }; } },
  })[method.method] !== "function") {
    throw new Error(`missing named API method: ${method.method}`);
  }
}
for (const code of ["UNSUPPORTED_SCHEMA_VERSION", "AUTHORITY_ESCALATION", "PREMATURE_SUCCESS", "BAD_CAUSALITY"]) {
  if (!sdk.CONTRACT_ERROR_CODES.includes(code)) throw new Error(`missing contract error code fixture: ${code}`);
}
for (const code of ["SDK_UNSUPPORTED_CONTRACT_VERSION", "SDK_INVALID_OPERATION_TRANSITION", "SDK_SINK_FAILURE"]) {
  if (!sdk.SDK_ERROR_CODES.includes(code)) throw new Error(`missing SDK error code fixture: ${code}`);
}
for (const version of policy.unsupportedContractVersions ?? []) {
  let rejected = false;
  try {
    sdk.createSecurityAuditSdk({
      contractVersion: version,
      producer: { name: "compat-producer", version: "1.0.0" },
      service: { name: "compat-service" },
      environment: { name: "compat" },
      sink: { async emit() { return { status: "accepted" }; } },
    });
  } catch (error) {
    rejected = JSON.stringify(error).includes("SDK_UNSUPPORTED_CONTRACT_VERSION");
  }
  if (!rejected) throw new Error(`unsupported contract version was not rejected: ${version}`);
}
console.log(`Node ${process.versions.node} is within the declared Node 24/26 policy and SDK compatibility fixtures passed`);
