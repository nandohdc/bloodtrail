/**
 * Contract Reuse Assessment schema and structural-rule adapter.
 *
 * The four canonical records establish a passing structural baseline before any
 * mutation runs. Each negative case changes exactly the relationship it names
 * from a canonical form and asserts the specific diagnostic rather than merely
 * a non-zero result. In particular, the trust_levelz arm remains structurally
 * valid: contract-reference resolution belongs to #100, not this schema phase.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  CRA_SCHEMA_PATH,
  checkCraRecord,
  craAssessmentRuleIds,
  loadCraSchema,
  validateCraRecord,
} from "../../scripts/contract-reuse/schema.mjs";
import { DiagnosticSink } from "../../scripts/design-pattern-governance/diagnostics.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const ADAPTER = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts/contract-reuse/schema.mjs");
const RULE_IDS = [
  "cra-alternatives-rejected-and-unique",
  "cra-assessment-disposition-fields",
  "cra-mechanism-references-unique",
];

function fixture(name) {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function check(record, path = "openspec/changes/example/contract-reuse.json") {
  return checkCraRecord(ROOT, record, { documentPath: path });
}

function ids(sink) {
  return sink.failures.map((entry) => entry.id);
}

function assertPasses(sink, context = "") {
  assert.equal(sink.ok, true, `${context} expected structural acceptance, got [${ids(sink).join(", ") || "none"}]`);
}

function assertDiagnostic(sink, expected, context = "") {
  assert.ok(ids(sink).includes(expected),
    `${context} expected ${expected}, got [${ids(sink).join(", ") || "none"}]`);
}

function assess(mutate) {
  const record = clone(fixture("canonical-reuse.json"));
  mutate(record);
  return check(record);
}

function extend(mutate) {
  const record = clone(fixture("canonical-extend.json"));
  mutate(record);
  return check(record);
}

function newContract(mutate) {
  const record = clone(fixture("canonical-new-contract.json"));
  mutate(record);
  return check(record);
}

describe("CRA closed schema", () => {
  it("loads the two named, closed shapes with the declared CRA-local relation sets", () => {
    const sink = new DiagnosticSink();
    const schema = loadCraSchema(ROOT, sink);

    assertPasses(sink);
    assert.equal(schema?.id, "contract-reuse");
    assert.deepEqual(schema?.supported_versions, ["1.0"]);
    assert.deepEqual(Object.keys(schema?.records ?? {}).sort(), ["assessment", "exemption"]);
    assert.deepEqual(schema?.records.assessment.fields.contract.enum, ["security-audit@1.0.0"]);
    assert.deepEqual(schema?.records.exemption.fields.contract.enum, ["security-audit@1.0.0"]);
    assert.deepEqual(schema?.records.assessment.rules.map((rule) => rule.id).sort(), RULE_IDS);
    assert.deepEqual(schema?.records.exemption.rules, []);
    assert.deepEqual(craAssessmentRuleIds, RULE_IDS);
    assert.equal(CRA_SCHEMA_PATH, "openspec/governance/schemas/contract-reuse.schema.json");
  });

  it("accepts each canonical record structurally", () => {
    for (const name of [
      "canonical-reuse.json",
      "canonical-extend.json",
      "canonical-new-contract.json",
      "canonical-exemption.json",
    ]) {
      assertPasses(check(fixture(name)), name);
    }
  });

  it("accepts a misspelled but safe mechanism path structurally without resolving the canonical contract", () => {
    const sink = assess((record) => {
      record.mechanism_references = ["registries.trust_levelz"];
    });

    assertPasses(sink);
  });

  it("keeps persisted negative fixtures bound to their intended diagnostics", () => {
    for (const [name, expected] of [
      ["negative-mode-unknown.json", "cra-mode-unknown"],
      ["negative-mechanism-reference-duplicate.json", "cra-mechanism-reference-duplicate"],
      ["negative-alternative-selected.json", "cra-alternative-selected"],
      ["negative-exemption-record-path.json", "schema-unknown-field"],
    ]) {
      assertDiagnostic(check(fixture(name)), expected, name);
    }
  });
});

describe("CRA mode dispatch", () => {
  it("rejects an unknown mode without selecting a fallback record shape", () => {
    const sink = assess((record) => {
      record.mode = "not_applicable";
    });

    assertDiagnostic(sink, "cra-mode-unknown");
  });

  it("rejects assessment fields on the exemption mode through its closed field table", () => {
    const record = clone(fixture("canonical-exemption.json"));
    record.disposition = "reuse";
    const sink = check(record);

    assertDiagnostic(sink, "schema-unknown-field");
  });

  it("rejects exemption fields on the assessment mode through its closed field table", () => {
    const sink = assess((record) => {
      record.governance_locator = { change: "example-exempted-change" };
    });

    assertDiagnostic(sink, "schema-unknown-field");
  });

  it("rejects a combined assessment and exemption record", () => {
    const sink = assess((record) => {
      record.scope_paths = ["contracts/security-audit/docs/"];
    });

    assertDiagnostic(sink, "schema-unknown-field");
  });

  it("rejects not_applicable as an assessment disposition", () => {
    const sink = assess((record) => {
      record.disposition = "not_applicable";
    });

    assertDiagnostic(sink, "schema-enum");
  });

  it("rejects an unknown assessment disposition", () => {
    const sink = assess((record) => {
      record.disposition = "something_else";
    });

    assertDiagnostic(sink, "schema-enum");
  });
});

describe("CRA identity and shared field-table failures", () => {
  it("rejects a missing required assessment field", () => {
    const sink = assess((record) => {
      delete record.rationale;
    });

    assertDiagnostic(sink, "schema-missing-field");
  });

  it("rejects a newer schema version distinctly", () => {
    const sink = assess((record) => {
      record.schema_version = "1.1";
    });

    assertDiagnostic(sink, "unknown-new-version");
  });

  it("rejects an older schema version distinctly", () => {
    const sink = assess((record) => {
      record.schema_version = "0.9";
    });

    assertDiagnostic(sink, "unsupported-old-version");
  });

  it("rejects a malformed schema version", () => {
    const sink = assess((record) => {
      record.schema_version = "1";
    });

    assertDiagnostic(sink, "schema-version-malformed");
  });

  it("rejects every unsupported contract version", () => {
    const sink = assess((record) => {
      record.contract = "security-audit@1.1.0";
    });

    assertDiagnostic(sink, "schema-enum");
  });

  it("rejects a contract list instead of one exact contract identity", () => {
    const sink = assess((record) => {
      record.contract = ["security-audit@1.0.0"];
    });

    assertDiagnostic(sink, "schema-type");
  });

  it("rejects an unknown field because the selected record shape is closed", () => {
    const sink = assess((record) => {
      record.review_approval = true;
    });

    assertDiagnostic(sink, "schema-unknown-field");
  });

  it("rejects an author handle outside the exact lowercase GitHub-style pattern", () => {
    const sink = assess((record) => {
      record.author.handle = "Fernando_Costa";
    });

    assertDiagnostic(sink, "schema-pattern");
  });
});

describe("CRA assessment disposition fields", () => {
  it("rejects reuse without its required mechanism references", () => {
    const sink = assess((record) => {
      delete record.mechanism_references;
    });

    assertDiagnostic(sink, "cra-disposition-fields-invalid");
  });

  it("rejects reuse with a compatibility classification", () => {
    const sink = assess((record) => {
      record.compatibility_classification = "minor";
    });

    assertDiagnostic(sink, "cra-disposition-fields-invalid");
  });

  it("rejects reuse with a proposed contract identifier", () => {
    const sink = assess((record) => {
      record.proposed_contract_id = "client-evidence-envelope";
    });

    assertDiagnostic(sink, "cra-disposition-fields-invalid");
  });

  it("rejects extend without its required compatibility classification", () => {
    const sink = extend((record) => {
      delete record.compatibility_classification;
    });

    assertDiagnostic(sink, "cra-disposition-fields-invalid");
  });

  it("rejects an invalid extend compatibility classification", () => {
    const sink = extend((record) => {
      record.compatibility_classification = "breaking";
    });

    assertDiagnostic(sink, "schema-enum");
  });

  it("rejects new_contract without its required proposed boundary", () => {
    const sink = newContract((record) => {
      delete record.proposed_contract_id;
    });

    assertDiagnostic(sink, "cra-disposition-fields-invalid");
  });

  it("rejects security-audit as a new-contract identifier", () => {
    const sink = newContract((record) => {
      record.proposed_contract_id = "security-audit";
    });

    assertDiagnostic(sink, "cra-disposition-fields-invalid");
  });

  it("rejects a proposed contract identifier outside the lowercase kebab dialect", () => {
    const sink = newContract((record) => {
      record.proposed_contract_id = "ClientEvidenceEnvelope";
    });

    assertDiagnostic(sink, "schema-pattern");
  });

  it("rejects mechanism references and compatibility on a new contract", () => {
    const sink = newContract((record) => {
      record.mechanism_references = ["registries.trust_levels"];
      record.compatibility_classification = "minor";
    });

    assertDiagnostic(sink, "cra-disposition-fields-invalid");
  });
});

describe("CRA bounded mechanism reference evidence", () => {
  it("rejects an empty mechanism-reference set", () => {
    const sink = assess((record) => {
      record.mechanism_references = [];
    });

    assertDiagnostic(sink, "schema-cardinality");
  });

  it("rejects an unsafe mechanism-reference string", () => {
    const sink = assess((record) => {
      record.mechanism_references = ["registries/../trust_levels"];
    });

    assertDiagnostic(sink, "schema-pattern");
  });

  it("rejects an overlong mechanism-reference string", () => {
    const sink = assess((record) => {
      record.mechanism_references = [`a.${"b".repeat(199)}`];
    });

    assertDiagnostic(sink, "schema-length");
  });

  it("rejects more than eight mechanism references", () => {
    const sink = assess((record) => {
      record.mechanism_references = Array.from({ length: 9 }, (_, index) => `registries.trust_level_${index}`);
    });

    assertDiagnostic(sink, "schema-cardinality");
  });

  it("rejects duplicate mechanism references with the CRA-local diagnostic", () => {
    const sink = assess((record) => {
      record.mechanism_references = ["registries.trust_levels", "registries.trust_levels"];
    });

    assertDiagnostic(sink, "cra-mechanism-reference-duplicate");
  });
});

describe("CRA rejected alternatives", () => {
  it("rejects an alternative that repeats the selected disposition", () => {
    const sink = assess((record) => {
      record.alternatives[0].approach = "reuse";
    });

    assertDiagnostic(sink, "cra-alternative-selected");
  });

  it("rejects a repeated alternative disposition", () => {
    const sink = extend((record) => {
      record.alternatives[1].approach = "reuse";
    });

    assertDiagnostic(sink, "cra-alternative-duplicate");
  });

  it("rejects an alternative outside the closed disposition vocabulary", () => {
    const sink = assess((record) => {
      record.alternatives[0].approach = "not_applicable";
    });

    assertDiagnostic(sink, "schema-enum");
  });
});

describe("CRA exemption form", () => {
  it("accepts a symbolic locator without reading or resolving its external governance evidence", () => {
    const record = clone(fixture("canonical-exemption.json"));
    record.governance_locator.change = "does-not-exist-anywhere";
    const sink = check(record);

    assertPasses(sink);
  });

  it("rejects a malformed same-change locator", () => {
    const record = clone(fixture("canonical-exemption.json"));
    record.governance_locator.change = "X";
    const sink = check(record);

    assertDiagnostic(sink, "schema-pattern");
  });

  it("rejects a caller-selected governance-record source", () => {
    const record = clone(fixture("canonical-exemption.json"));
    record.governance_locator.source = "other-records.json";
    const sink = check(record);

    assertDiagnostic(sink, "schema-unknown-field");
  });

  it("rejects a caller-selected governance-record path", () => {
    const record = clone(fixture("canonical-exemption.json"));
    record.governance_locator.record_path = "governanceRecords[0]";
    const sink = check(record);

    assertDiagnostic(sink, "schema-unknown-field");
  });

  it("rejects a scope path that is not lexically repository-relative", () => {
    const record = clone(fixture("canonical-exemption.json"));
    record.scope_paths = ["../contracts/security-audit/"];
    const sink = check(record);

    assertDiagnostic(sink, "schema-path");
  });
});

describe("CRA adapter contract", () => {
  it("does not name later-checker contract, history, or governance-record inputs", () => {
    const source = readFileSync(ADAPTER, "utf8");

    for (const forbidden of [
      "contract.source.json",
      "verification-lifecycle.json",
      "design-pattern-governance/git.mjs",
      "node:child_process",
    ]) {
      assert.equal(source.includes(forbidden), false, `adapter must not read later-checker input ${forbidden}`);
    }
  });

  it("does not depend on a context object to validate an explicitly dispatched record", () => {
    const schemaSink = new DiagnosticSink();
    const schema = loadCraSchema(ROOT, schemaSink);
    assertPasses(schemaSink);

    const sink = new DiagnosticSink();
    validateCraRecord(schema, fixture("canonical-reuse.json"), {
      documentPath: "openspec/changes/example/contract-reuse.json",
      sink,
    });

    assertPasses(sink);
  });
});
