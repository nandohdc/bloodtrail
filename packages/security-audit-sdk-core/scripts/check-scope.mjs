import { readFile, readdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (Object.keys(pkg.dependencies ?? {}).length !== 0) throw new Error("runtime dependencies require explicit ADR amendment");
const forbidden = /(?:express|fastify|nestjs|opentelemetry|otlp|kafka|amqp|rabbit|collector|outbox|durable.queue|siem|splunk|elastic|browser.telemetry|instrumentation|cryptographic.chain)/i;
const forbiddenImplementation = /(?:from\s+["']node:(?:http|https|http2|net|tls|dgram|fs|child_process|cluster)["']|\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(|\bconsole\.(?:log|warn|error|info|debug)\s*\()/;
async function walk(url) {
  for (const entry of await readdir(url, { withFileTypes: true })) {
    if (["node_modules", "dist", "dist-tests"].includes(entry.name)) continue;
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, url);
    if (entry.isDirectory()) await walk(child);
    else if (/\.(?:ts|mts|js|mjs|json)$/.test(entry.name)) {
      const text = await readFile(child, "utf8");
      if (forbidden.test(text) && !child.pathname.endsWith("check-scope.mjs")) throw new Error(`prohibited production scope reference: ${child.pathname}`);
      if (forbiddenImplementation.test(text)) throw new Error(`prohibited production or diagnostic implementation: ${child.pathname}`);
    }
  }
}
await walk(new URL("src/", root));
console.log("package dependency and production-scope checks passed");
