import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Child-process context isolation", () => {
  it("proves concurrent asynchronous operations maintain strict isolation without cross-scope leakage", async () => {
    const fixtureCode = `
      import { setTimeout as delay } from "node:timers/promises";
      import { nodeContextProvider } from "./dist/index.js";
      import { createAuditContextFrame, authoritativeActor, authoritativeTenant } from "@bloodtrail/security-audit-sdk-core";

      const CONCURRENT_TASKS = 50;
      const errors = [];

      async function runWorker(workerId) {
        const frame = createAuditContextFrame({
          actor: authoritativeActor({ id: \`worker-\${workerId}\`, type: "service_account" }),
          tenant: authoritativeTenant({ scope: "tenant", effective_tenant_id: \`tenant-\${workerId}\`, resource_tenant_id: \`tenant-\${workerId}\` }),
        });

        return nodeContextProvider.run(frame, async () => {
          for (let step = 0; step < 5; step += 1) {
            const current = nodeContextProvider.get();
            if (!current) {
              errors.push(\`worker \${workerId} lost context at step \${step}\`);
              return;
            }
            if (current.actor?.id !== \`worker-\${workerId}\`) {
              errors.push(\`worker \${workerId} observed foreign actor \${current.actor?.id} at step \${step}\`);
              return;
            }
            if (current.tenant?.effective_tenant_id !== \`tenant-\${workerId}\`) {
              errors.push(\`worker \${workerId} observed foreign tenant \${current.tenant?.effective_tenant_id} at step \${step}\`);
              return;
            }
            // Variable delay to interleave execution with other workers
            await delay(Math.floor(Math.random() * 15) + 1);
          }
        });
      }

      await Promise.all(Array.from({ length: CONCURRENT_TASKS }, (_, i) => runWorker(i)));

      if (nodeContextProvider.get() !== undefined) {
        errors.push("context leaked outside top-level execution scope");
      }

      if (errors.length > 0) {
        console.error("Errors:", errors.join(", "));
        process.exit(1);
      } else {
        console.log("context-isolation:pass");
        process.exit(0);
      }
    `;

    const child = spawn("node", ["--input-type=module", "-e", fixtureCode], {
      cwd: resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const exitCode = await new Promise<number>((resolveExit) => {
      child.on("exit", (code) => resolveExit(code ?? -1));
    });

    assert.equal(exitCode, 0, `Child process failed with code ${exitCode}. Stderr: ${stderr}`);
    assert.ok(stdout.includes("context-isolation:pass"), `Expected pass marker in output: ${stdout}`);
  });
});
