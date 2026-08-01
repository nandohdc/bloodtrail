import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CONTRACT_VERSION,
  SecurityAuditSdkError,
  createSecurityAuditSdk,
} from "../dist/index.js";
import { packageRoot } from "./verification-helpers.mjs";

const compatibility = JSON.parse(await readFile(resolve(packageRoot, "compatibility.json"), "utf8"));
const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(resolve(packageRoot, "package-lock.json"), "utf8"));
const provenance = JSON.parse(await readFile(resolve(packageRoot, "contract-provenance.json"), "utf8"));

const major = Number(process.versions.node.split(".")[0]);
assert(compatibility.node.supportedMajors.join(",") === "24,26", "supported Node majors must be exactly 24 and 26");
assert(compatibility.node.supportedMajors.includes(major), `unsupported Node.js major ${major}`);
assert(packageJson.engines.node === ">=24 <25 || >=26 <27", "package engines must exclude unverified odd/future majors");
assert(packageJson.engines.node === compatibility.node.engines, "package and manifest Node policy differ");
assert(packageJson.type === "module", "public package must remain ESM");
assert(packageJson.version === compatibility.package.version, "package and manifest versions differ");
assert(packageJson.name === compatibility.package.name, "package and manifest names differ");
assert(compatibility.typescript.supported === ">=5.9.2 <6", "TypeScript support policy drift");
assert(packageJson.devDependencies.typescript === compatibility.typescript.ciVersion, "TypeScript compiler pin drift");
assert(packageLock.packages["node_modules/typescript"].version === compatibility.typescript.ciVersion, "locked TypeScript version drift");
assert(compatibility.contractVersion === CONTRACT_VERSION, "runtime and manifest contract versions differ");
assert(compatibility.supportedContractVersions.join(",") === CONTRACT_VERSION, "supported contract range must be exact");
assert(compatibility.contractVersionRange.minimum === CONTRACT_VERSION, "contract minimum drift");
assert(compatibility.contractVersionRange.maximum === CONTRACT_VERSION, "contract maximum drift");
assert(compatibility.normativeTechnicalTarget === provenance.normativeTechnicalTarget, "manifest/provenance target drift");
assert(compatibility.packageExports.join(",") === ".,./testing", "compatibility package exports drift");
assert(Object.keys(packageJson.exports).join(",") === ".,./testing", "package export map drift");
assert(packageJson.exports["."].require === undefined, "CommonJS root package export is unsupported");
assert(packageJson.exports["./testing"].require === undefined, "CommonJS testing package export is unsupported");

const sink = Object.freeze({ emit: async () => Object.freeze({ status: "accepted" }) });
for (const contractVersion of compatibility.unsupportedContractVersions) {
  let rejected = false;
  try {
    createSecurityAuditSdk({
      contractVersion,
      producer: { name: "compatibility-check", version: "1.0.0" },
      service: { name: "compatibility-check" },
      environment: { name: "test" },
      sink,
    });
  } catch (error) {
    rejected = error instanceof SecurityAuditSdkError
      && error.code === "SDK_UNSUPPORTED_CONTRACT_VERSION";
  }
  assert(rejected, `unsupported contract version ${contractVersion} did not fail safely`);
}

process.stdout.write(`compatibility passed on Node ${process.versions.node}; contract ${CONTRACT_VERSION}; TypeScript ${compatibility.typescript.ciVersion}; exports ., ./testing\n`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
