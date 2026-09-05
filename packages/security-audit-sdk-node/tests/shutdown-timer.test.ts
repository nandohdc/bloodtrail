import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Child-process shutdown timer", () => {
  it("terminates promptly when an unreferenced timer is scheduled and installs no signal handlers", async () => {
    const fixtureCode = `
      import { nodeTimers } from "./dist/index.js";

      // Verify no signal handlers are installed on import
      const sigtermListeners = process.listeners("SIGTERM");
      const sigintListeners = process.listeners("SIGINT");

      if (sigtermListeners.length > 0 || sigintListeners.length > 0) {
        console.error("Signal listeners detected on process");
        process.exit(2);
      }

      // Schedule a 60-second shutdown timer with unref
      const handle = nodeTimers.setTimeout(() => {
        console.error("Timer callback should not execute");
        process.exit(3);
      }, 60_000);

      if (typeof handle.unref === "function") {
        handle.unref();
      } else {
        console.error("Handle does not have unref method");
        process.exit(4);
      }

      console.log("timer-unref:pass");
      // Execution reaches end of synchronous script; event loop should exit immediately
    `;

    const start = Date.now();
    const child = spawn("node", ["--input-type=module", "-e", fixtureCode], {
      cwd: resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    // Enforce 5 second timeout on child process exit
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, 5000);

    const exitCode = await new Promise<number>((resolveExit) => {
      child.on("exit", (code) => {
        clearTimeout(timeout);
        resolveExit(code ?? -1);
      });
    });

    const duration = Date.now() - start;

    assert.equal(exitCode, 0, `Child process exited with code ${exitCode}. Stderr: ${stderr}`);
    assert.ok(stdout.includes("timer-unref:pass"), `Expected pass marker in output: ${stdout}`);
    assert.ok(duration < 3000, `Process took ${duration}ms, expected prompt exit (<3000ms) without hanging on unreferenced timer`);
  });
});
