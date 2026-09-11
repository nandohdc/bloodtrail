#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "source/envelope.source.json");
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const check = process.argv.includes("--check");
const generated = [];

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function emit(relPath, content) {
  const full = resolve(root, relPath);
  generated.push(relPath);
  if (check) {
    let existing;
    try {
      existing = await readFile(full, "utf8");
    } catch {
      assert.fail(`${relPath} is missing; run node contracts/client-evidence-envelope/scripts/generate-artifacts.mjs`);
    }
    assert.equal(existing, content, `${relPath} is stale; run node contracts/client-evidence-envelope/scripts/generate-artifacts.mjs`);
    return;
  }
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
}

function buildProvenanceSchema(regs) {
  return {
    description: "Low-assurance client claim provenance metadata.",
    type: "object",
    additionalProperties: false,
    unevaluatedProperties: false,
    required: ["source", "trust_level", "platform", "capture_scope"],
    properties: {
      source: {
        type: "string",
        const: "client_reported"
      },
      trust_level: {
        type: "string",
        const: "client_claim"
      },
      platform: {
        type: "string",
        enum: regs.platforms
      },
      capture_scope: {
        type: "string",
        const: "interaction_ephemeral"
      }
    }
  };
}

function buildSingleClaimSchema(bounds, regs) {
  return {
    type: "object",
    additionalProperties: false,
    unevaluatedProperties: false,
    required: ["name", "trust_level", "value"],
    properties: {
      name: {
        type: "string",
        pattern: "^[a-z][a-z0-9_]{1,31}$",
        maxLength: bounds.max_claim_name_length,
        not: {
          enum: regs.forbidden_claim_names
        }
      },
      trust_level: {
        type: "string",
        const: "client_claim"
      },
      value: {
        oneOf: [
          {
            type: "string",
            maxLength: bounds.max_claim_value_length
          },
          {
            type: "number"
          },
          {
            type: "boolean"
          }
        ]
      }
    }
  };
}

function buildClaimsProperty(bounds, regs) {
  return {
    description: "Bounded collection of unverified client-asserted claim key-value pairs.",
    type: "array",
    maxItems: bounds.max_claims,
    items: buildSingleClaimSchema(bounds, regs)
  };
}

function buildTransformHistoryProperty(bounds) {
  return {
    description: "Bounded record of client-applied transformations.",
    type: "array",
    maxItems: bounds.max_transforms,
    items: {
      type: "object",
      additionalProperties: false,
      unevaluatedProperties: false,
      required: ["transform", "timestamp"],
      properties: {
        transform: {
          type: "string",
          maxLength: bounds.max_transform_name_length
        },
        timestamp: {
          type: "integer",
          minimum: bounds.min_client_timestamp,
          maximum: bounds.max_client_timestamp
        }
      }
    }
  };
}

function buildRootProperties(bounds, regs) {
  return {
    envelope_version: {
      description: "Envelope schema version discriminator. Explicitly 1 for v1.",
      type: "integer",
      const: 1
    },
    interaction_id: {
      description: "Interaction-scoped correlation UUID v4 in canonical lowercase hyphenated format.",
      type: "string",
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
      minLength: bounds.interaction_id_length,
      maxLength: bounds.interaction_id_length
    },
    interaction_kind: {
      description: "Closed vocabulary of at most 8 interaction categories.",
      type: "string",
      enum: regs.interaction_kinds
    },
    client_timestamp: {
      description: "Client-observed millisecond epoch timestamp.",
      type: "integer",
      minimum: bounds.min_client_timestamp,
      maximum: bounds.max_client_timestamp
    },
    provenance: buildProvenanceSchema(regs),
    nonce: {
      description: "Mode A echoed server-issued nonce for freshness and single-use binding.",
      type: "string",
      pattern: "^[0-9a-f]{32,64}$",
      minLength: bounds.min_nonce_length,
      maxLength: bounds.max_nonce_length
    },
    claims: buildClaimsProperty(bounds, regs),
    transform_history: buildTransformHistoryProperty(bounds)
  };
}

function buildJsonSchema(src) {
  const meta = src.metadata;
  const bounds = src.bounds;
  const regs = src.registries;

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: meta.schema_id,
    title: "ClientEvidenceEnvelope",
    description: "Closed, versioned, low-assurance client evidence envelope for interaction-scoped correlation (P1). Attacker-controlled; all claims carry client_claim trust.",
    type: "object",
    additionalProperties: false,
    unevaluatedProperties: false,
    required: [
      "envelope_version",
      "interaction_id",
      "interaction_kind",
      "client_timestamp",
      "provenance"
    ],
    properties: buildRootProperties(bounds, regs)
  };
}

function buildSpecificationMarkdown(src) {
  const meta = src.metadata;
  const bounds = src.bounds;
  const regs = src.registries;

  return `# ClientEvidenceEnvelope v1 Specification

> ${meta.generated_artifact_notice}

## Overview

- **Contract ID:** \`${meta.contract}\`
- **Schema Name:** \`${meta.schema_name}\`
- **Schema Version:** \`${meta.schema_version}\`
- **Discriminator:** \`envelope_version = ${meta.envelope_version}\`
- **Decision Source:** \`${meta.decision_source}\`

## Assurance Limitations

${meta.assurance_limitations}

## Canonical Boundary

${meta.canonical_boundary}

## Structural Bounds

| Bound | Value | Rationale |
|---|---|---|
| \`max_envelope_bytes\` | ${bounds.max_envelope_bytes} bytes | Must sit strictly below the 64 KB audit event bound (PLAN-049) |
| \`interaction_id_length\` | ${bounds.interaction_id_length} characters | RFC 4122 UUID v4 representation |
| \`max_claims\` | ${bounds.max_claims} items | Closed, bounded claim collection |
| \`max_claim_name_length\` | ${bounds.max_claim_name_length} characters | Bound on claim key identifier |
| \`max_claim_value_length\` | ${bounds.max_claim_value_length} characters | Bound on claim scalar payload |
| \`max_transforms\` | ${bounds.max_transforms} items | Bound on client-side transform records |
| \`nonce_length\` | ${bounds.min_nonce_length}..${bounds.max_nonce_length} characters | Server-issued hex token |

## Interaction Kinds (Closed Vocabulary, <= 8 items)

${regs.interaction_kinds.map((k) => `- \`${k}\``).join("\n")}

## Prohibited Claims (Privacy & Fingerprinting Inventory)

The following claims are strictly prohibited and cause deterministic validation failure:

${regs.forbidden_claim_names.map((n) => `- \`${n}\``).join("\n")}
`;
}

// 1. Emit JSON Schema
const schema = buildJsonSchema(source);
await emit("schema/client-evidence-envelope.schema.json", stableJson(schema));

// 2. Emit Registries
await emit("registries/registries.json", stableJson(source.registries));

// 3. Emit Documentation
await emit("docs/envelope-specification.md", buildSpecificationMarkdown(source));

if (!check) {
  process.stdout.write(`Generated ${generated.length} artifact(s) successfully.\n`);
}
