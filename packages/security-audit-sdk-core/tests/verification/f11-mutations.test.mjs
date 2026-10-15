import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { buildAndCompileMutation } from "./mutation-build.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-f11-mutations-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const mutations = [
  {
    name: "M-F11-A collapse redelivery into emit",
    file: "src/sdk.ts",
    oldText: "  async redeliver(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {\n    return this.#deliverValidatedEvent(event, { kind: \"pure_redelivery\" });\n  }",
    newText: "  async redeliver(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {\n    return this.#deliverValidatedEvent(event, { kind: \"generic_emit\" });\n  }",
  },
  {
    name: "M-F11-B regenerate redelivery identity",
    file: "src/sdk.ts",
    oldText: "  async redeliver(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {\n    return this.#deliverValidatedEvent(event, { kind: \"pure_redelivery\" });\n  }",
    newText: "  async redeliver(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {\n    this.#config.identifiers.eventId();\n    return this.#deliverValidatedEvent(event, { kind: \"pure_redelivery\" });\n  }",
  },
  {
    name: "M-F11-C preserve identity during re-execution",
    file: "src/events.ts",
    oldText: "  const eventId = config.identifiers.eventId();",
    newText: "  const eventId = normalizedInput.retry?.original_event_id ?? config.identifiers.eventId();",
  },
  {
    name: "M-F11-D rerun transformations on redelivery",
    file: "src/events.ts",
    oldText: "    const binding = validateNamedRedeliveryBinding(validated.value, operation);",
    newText: "    config.transformations[0]?.hook.transform({ path: \"actor.id\", value: validated.value.actor?.id ?? \"\", purpose: definition.name });\n    const binding = validateNamedRedeliveryBinding(validated.value, operation);",
  },
  {
    name: "M-F11-E remove named-redelivery compatibility validation",
    file: "src/events.ts",
    oldText: "    if (validated.value.event.name !== definition.name) return failure(\"UNKNOWN_CATALOG_VALUE\", \"validation\", \"/event/name\");\n",
    newText: "",
  },
  {
    name: "M-F11-F consume terminal-completion path during redelivery",
    file: "src/sdk.ts",
    oldText: "    if (built.value.deliveryIntent.kind === \"named_redelivery\") {\n      return this.#deliverNamedEvent(built.value.event, built.value.deliveryIntent);\n    }",
    newText: "    if (built.value.deliveryIntent.kind === \"named_redelivery\" && false) {\n      return this.#deliverNamedEvent(built.value.event, built.value.deliveryIntent);\n    }",
  },
  {
    name: "M-F11-G restore unchecked early return",
    file: "src/events.ts",
    oldText: "    const validated = validateSecurityAuditEvent(redelivery, config.schemaRuntime);\n    if (!validated.ok) return validated;\n    if (validated.value.event.name !== definition.name) return failure(\"UNKNOWN_CATALOG_VALUE\", \"validation\", \"/event/name\");\n    const binding = validateNamedRedeliveryBinding(validated.value, operation);\n    if (!binding.ok) return binding;\n    return {\n      ok: true,\n      value: {\n        event: validated.value as Readonly<EventForName<EventName>>,\n        deliveryIntent: { kind: \"named_redelivery\" },\n      },\n    };",
    newText: "    const validated: AuditResult<SecurityAuditEvent> = { ok: true, value: redelivery };\n    return {\n      ok: true,\n      value: {\n        event: validated.value as Readonly<EventForName<EventName>>,\n        deliveryIntent: { kind: \"named_redelivery\" },\n      },\n    };",
  },
];

for (const mutation of mutations) {
  test(mutation.name, () => {
    const caseRoot = resolve(suiteRoot, mutation.name.replaceAll(/[^A-Za-z0-9]+/g, "-"));
    const root = resolve(caseRoot, "packages/security-audit-sdk-core");
    copyPackageStable(packageRoot, root);
    cpSync(resolve(repositoryRoot, "contracts"), resolve(caseRoot, "contracts"), { recursive: true, force: true });
    symlinkSync(resolve(packageRoot, "node_modules"), resolve(root, "node_modules"), "dir");
    replace(resolve(root, mutation.file), mutation.oldText, mutation.newText);

    buildAndCompileMutation(root, mutation.name);
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ["--test", "dist-tests/f11-delivery-intent.test.js"], {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
      env: environment,
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, `${mutation.name} unexpectedly survived its F-11 guard:\n${output}`);
    assert.match(output, /tests\s+[1-9][0-9]*/i, `${mutation.name} had zero test discovery:\n${output}`);
    assert.match(output, /fail\s+[1-9][0-9]*/i, `${mutation.name} did not fail an intended guard:\n${output}`);
  });
}

function copyPackageStable(source, destination) {
  const excluded = new Set(["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output", "_vp_dummy.ts"]);
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      cpSync(source, destination, {
        recursive: true,
        force: true,
        filter: (entry) => !excluded.has(basename(entry)),
      });
      return;
    } catch (error) {
      if (error && error.code === "ENOENT" && String(error.path ?? "").endsWith("_vp_dummy.ts")) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("package copy remained unstable");
}

function replace(path, oldText, newText) {
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText));
}
