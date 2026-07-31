import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(await readFile(resolve(root, "compatibility.json"), "utf8"));
const major = Number(process.versions.node.split(".")[0]);
if (!policy.node.supportedMajors.includes(major)) throw new Error(`unsupported Node major ${major}`);
if (policy.contractVersion !== "1.0.0") throw new Error("compatibility policy contract drift");
console.log(`Node ${process.versions.node} is within the declared Node 24/26 policy`);
