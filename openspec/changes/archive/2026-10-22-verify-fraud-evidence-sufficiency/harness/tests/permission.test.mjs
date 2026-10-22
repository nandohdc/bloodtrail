import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command } from "../lib/io.mjs";

// A dummy package, NOT the SDK or kit. No socket can be opened with these flags.
const SCRIPT = `import assert from "node:assert/strict";
import net from "node:net";
import dns from "node:dns/promises";
import { opaque } from "fixture-only";
assert.equal(opaque, "synthetic-fixture");
assert.equal(process.permission.has("net"), false);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("network denial timed out")), 1000);
  const socket = net.connect({host:"127.0.0.1",port:1});
  socket.once("connect", () => reject(new Error("network connection unexpectedly permitted")));
  socket.once("error", (error) => {
    clearTimeout(timer);
    try {
      assert.equal(error.code, "ERR_ACCESS_DENIED");
      resolve();
    } catch (failure) {
      reject(failure);
    }
  });
});
await assert.rejects(dns.lookup("localhost"), {code:"ERR_ACCESS_DENIED"});
console.log(JSON.stringify({imported:true,network:"ERR_ACCESS_DENIED",dns:"ERR_ACCESS_DENIED",net_permission:false}));
`;

test("permission model permits installed dummy import but denies loopback and DNS; deletes fixture", () => {
  const service = mkdtempSync(join(realpathSync(tmpdir()), "pids-permission-fixture-"));
  try {
    writeFileSync(join(service, "package.json"), JSON.stringify({ private: true, type: "module" }) + "\n");
    const packageDir = join(service, "node_modules/fixture-only");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "fixture-only", type: "module", exports: "./index.mjs" }) + "\n");
    writeFileSync(join(packageDir, "index.mjs"), 'export const opaque = "synthetic-fixture";\n');
    const script = join(service, "main.mjs");
    writeFileSync(script, SCRIPT);
    const output = command({ program: process.execPath, args: ["--permission", `--allow-fs-read=${service}`, script], cwd: service });
    assert.deepEqual(JSON.parse(output), { imported: true, network: "ERR_ACCESS_DENIED", dns: "ERR_ACCESS_DENIED", net_permission: false });
  } finally {
    rmSync(service, { recursive: true, force: true });
  }
  assert(!existsSync(service));
});
