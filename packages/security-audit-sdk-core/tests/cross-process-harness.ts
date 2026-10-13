import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";

export const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const sdkUrl = new URL("../dist/index.js", import.meta.url).href;

export interface ChildOutput {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

export function runConcurrentChild(script: string, deadlineMs = 10_000): Promise<ChildOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let failure: Error | undefined;
    const terminate = (error: Error): void => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const onStdout = (chunk: string): void => {
      if (stdout.length + chunk.length > 64 * 1024) {
        terminate(new Error("child stdout exceeded 64 KiB"));
      }
      stdout = (stdout + chunk).slice(0, 64 * 1024);
    };
    const onStderr = (chunk: string): void => { stderr = (stderr + chunk).slice(0, 4096); };
    const onError = (error: Error): void => { terminate(error); };
    const onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
      clearTimeout(deadline);
      child.stdout.removeListener("data", onStdout);
      child.stderr.removeListener("data", onStderr);
      child.removeListener("error", onError);
      child.removeListener("close", onClose);
      if (failure !== undefined) {
        reject(new Error(`${failure.message}; stderr=${stderr}`));
      } else {
        resolve({ code, signal, stdout, stderr });
      }
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.once("error", onError);
    child.once("close", onClose);
    const deadline = setTimeout(() => {
      terminate(new Error(`child exceeded ${deadlineMs} ms and was killed`));
      // Settle only on close: the killed child and its pipes must be reaped first.
    }, deadlineMs);
  });
}

// providerSource, when supplied, declares a module-level custom `identifiers` object.
// With no source, the config has no identifiers property and exercises Core defaults.
export function buildIdentifierSamplingScript(sampleCount: number, providerSource?: string): string {
  const providerSetup = providerSource ?? "";
  const providerConfiguration = providerSource === undefined
    ? "// Deliberately omit identifiers: both named events and operations use Core defaults."
    : "identifiers,";
  return `
import { strict as assert } from "node:assert";
import {
  createSecurityAuditSdk, authenticatedHumanActor, authoritativeTenant,
  authenticatedPrincipal, authenticationEvidence, credentialReference,
  sessionEvidence, observedSource,
} from ${JSON.stringify(sdkUrl)};
${providerSetup}
const eventIds = [];
const operationIds = [];
const sdk = createSecurityAuditSdk({
  ${providerConfiguration}
  contractVersion: "2.1.0",
  producer: { name: "cross-process-identifiers", version: "1.0.0" },
  service: { name: "cross-process-identifiers" },
  environment: { name: "test" },
  sink: { async emit(event) { eventIds.push(event.event.id); return { status: "accepted" }; } },
});
const input = {
  actor: authenticatedHumanActor({ id: "actor", tenantId: "tenant", source: "server-authentication-authority" }),
  tenant: authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant", effective_tenant_id: "tenant", resource_tenant_id: "tenant" }),
  authenticated_principal: authenticatedPrincipal({ type: "human_user", id: "principal", issuer: "https://idp.example.test" }),
  authentication: authenticationEvidence({ method: "password_mfa", assurance_level: "aal2", mfa_state: "satisfied", credential_type: "session", authenticated_at: "2026-08-04T00:00:00.000Z", identity_provider: "https://idp.example.test", delegated: false, impersonated: false }),
  credential: credentialReference({ type: "session", reference: "credential", key_id: "key" }),
  session: sessionEvidence({ id: "session", created_at: "2026-08-03T23:00:00.000Z", age_seconds: 3600, assurance_level: "aal2" }),
  source: observedSource({ observed: { address: "192.0.2.11", port: 443 } }),
};
try {
  for (let index = 0; index < ${sampleCount}; index += 1) {
    const operation = sdk.beginOperation({ transactional: false });
    assert.equal(operation.ok, true, JSON.stringify(operation));
    operationIds.push(operation.value.operationId);
    const delivery = await sdk.authenticationSucceeded({ ...input, operation: operation.value });
    assert.deepEqual(delivery, { ok: true, value: { status: "accepted" } });
  }
} finally {
  const shutdown = await sdk.shutdown();
  assert.equal(shutdown.ok, true, JSON.stringify(shutdown));
}
console.log(JSON.stringify({ pid: process.pid, eventIds, operationIds }));
`;
}

export interface ChildIdentifiers {
  readonly pid: number;
  readonly identifiers: readonly string[];
}

export function parseChildRecord(stdout: string, context: string): Record<string, unknown> {
  const lines = stdout.trim().split("\n");
  assert.equal(lines.length, 1, `${context}: expected exactly one JSON record`);
  let record: unknown;
  assert.doesNotThrow(() => { record = JSON.parse(lines[0]!); }, `${context}: invalid JSON record`);
  assert.ok(record !== null && typeof record === "object", `${context}: expected a JSON object`);
  const fields = record as Record<string, unknown>;
  assert.deepEqual(Object.keys(fields).sort(), ["eventIds", "operationIds", "pid"], `${context}: unexpected record keys`);
  return fields;
}

export function validateIdentifierSamples(values: unknown, expectedSamples: number, context: string): string[] {
  assert.ok(Array.isArray(values), `${context} must be an array`);
  assert.equal(values.length, expectedSamples, `${context} count`);
  return values.map((identifier: unknown, sample: number) => {
    assert.ok(typeof identifier === "string", `${context}[${sample}] must be a string`);
    assert.match(identifier, uuidV4, `${context}[${sample}] must be lowercase RFC 4122 UUID v4`);
    return identifier;
  });
}

export function parseAndValidateChildResult(
  child: PromiseSettledResult<ChildOutput>, index: number, expectedSamples: number,
): ChildIdentifiers {
  const context = `child ${index}`;
  if (child.status === "rejected") assert.fail(`${context}: ${String(child.reason)}`);
  const output = child.value;
  assert.equal(output.signal, null, `${context}: signal=${output.signal}; stderr=${output.stderr}`);
  assert.equal(output.code, 0, `${context}: exit=${output.code}; stderr=${output.stderr}`);
  const fields = parseChildRecord(output.stdout, context);
  assert.ok(typeof fields.pid === "number", `${context}: pid must be a number`);
  const pid = fields.pid;
  assert.ok(Number.isInteger(pid) && pid > 0, `${context}: pid must be a positive integer`);
  assert.notEqual(pid, process.pid, `${context}: expected a fresh child pid`);
  const identifiers = ["eventIds", "operationIds"].flatMap((key) =>
    validateIdentifierSamples(fields[key], expectedSamples, `${context}: ${key}`));
  return { pid, identifiers };
}

export async function sampleConcurrentChildren(
  script: string, processCount: number, sampleCount: number,
): Promise<ChildIdentifiers[]> {
  // Start every child before awaiting any; allSettled also reaps siblings on failure.
  const children = await Promise.allSettled(Array.from({ length: processCount }, () => runConcurrentChild(script)));
  const results = children.map((child, index) => parseAndValidateChildResult(child, index, sampleCount));
  const pids = new Set(results.map(({ pid }) => pid));
  const identifiers = results.flatMap(({ identifiers }) => identifiers);
  assert.equal(pids.size, processCount, "expected distinct fresh child processes");
  assert.equal(identifiers.length, processCount * sampleCount * 2);
  return results;
}

// Returns each repeated value once, in order of its second encounter in the full union.
// Neither child boundaries nor identifier kinds exempt an occurrence from detection.
export function findRepeatedIdentifiers(results: readonly ChildIdentifiers[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  const identifiers = results.flatMap((result) => result.identifiers);
  for (const identifier of identifiers) {
    if (seen.has(identifier)) repeated.add(identifier);
    seen.add(identifier);
  }
  return [...repeated];
}
