/**
 * Contract Reuse Assessment (CRA) structural validation — the CRA-local
 * structural-rule adapter.
 *
 * This module is deliberately thin. The shared dependency-free closed-schema
 * interpreter (openspec/scripts/design-pattern-governance/schema.mjs) validates
 * every field constraint from the schema's data; this adapter adds only what
 * the generic interpreter deliberately cannot express: dispatching the named
 * record shape from the record's explicit `mode`, then applying the declared
 * cross-field CRA relations by name. Design-pattern-governance code is reused,
 * never modified.
 *
 * The boundary is structural. Nothing here resolves a mechanism reference
 * against the canonical contract, reads Git history, or consults governance
 * records — an exemption locator is validated as a closed symbolic shape and
 * never dereferenced. Structural acceptance is not a CRA-validated pass, owner
 * approval, or implementation authorization; those belong to the later checker
 * phase and to normal OpenSpec governance.
 *
 * Diagnostics come in two families. Generic field-table failures keep the
 * interpreter's stable `schema-*` identifiers. The CRA-local conditions emit
 * `cra-mode-unknown`, `cra-disposition-fields-invalid`,
 * `cra-mechanism-reference-duplicate`, `cra-alternative-selected`, and
 * `cra-alternative-duplicate`, so a fixture can demand each control by name.
 */

import { DiagnosticSink } from "../design-pattern-governance/diagnostics.mjs";
import { checkDocumentVersion, loadSchema, validateRecord } from "../design-pattern-governance/schema.mjs";

export const CRA_SCHEMA_PATH = "openspec/governance/schemas/contract-reuse.schema.json";

const ASSESSMENT_DISPOSITIONS = Object.freeze(["reuse", "extend", "new_contract"]);
const SAFE_MECHANISM_REFERENCE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;

/**
 * Loads and freezes the CRA schema, enforcing the CRA-local shape invariants
 * the generic loader cannot know: exactly the two named record shapes the
 * dialect defines, and an empty exemption relation set — that shape's closed
 * field table fully expresses its form, so a declared exemption relation would
 * have no implementing control.
 */
export function loadCraSchema(repositoryRoot, sink) {
  const schema = loadSchema(repositoryRoot, CRA_SCHEMA_PATH, sink);
  if (schema === null) return null;
  const records = schema.records ?? {};
  for (const name of ["assessment", "exemption"]) {
    if (!Object.hasOwn(records, name)) {
      sink.fail("schema-incomplete", CRA_SCHEMA_PATH, `CRA schema lacks the ${name} record shape`);
      return null;
    }
  }
  for (const name of Object.keys(records)) {
    if (name === "assessment" || name === "exemption") continue;
    sink.fail("schema-incomplete", CRA_SCHEMA_PATH,
      `CRA schema declares unexpected record shape ${name}; the dialect defines exactly assessment and exemption`);
    return null;
  }
  if ((records.exemption.rules ?? []).length !== 0) {
    sink.fail("schema-incomplete", CRA_SCHEMA_PATH,
      "the exemption record shape must declare an empty relation set; its closed field table fully expresses its form");
    return null;
  }
  return schema;
}

/**
 * Structurally validates one parsed CRA record against the named shape its
 * `mode` selects, writing every outcome into the shared sink and returning it.
 *
 * An unsupported schema version stops validation: the adapter selects no
 * fallback version, and dispatching a record whose dialect is not understood
 * would report field failures against a shape the record never claimed.
 */
export function validateCraRecord(schema, document, { documentPath, sink }) {
  if (!isRecord(document)) {
    sink.fail("schema-shape", documentPath, "a CRA record must be a JSON object");
    return sink;
  }
  if (!checkDocumentVersion(document, schema, documentPath, sink)) return sink;

  // hasOwn, not a property lookup: a parsed record whose mode happens to name
  // an Object.prototype member must not dispatch anywhere.
  const mode = document.mode;
  const records = schema.records ?? {};
  const definition = typeof mode === "string" && Object.hasOwn(records, mode) ? records[mode] : undefined;
  if (definition === undefined) {
    sink.fail("cra-mode-unknown", documentPath,
      "mode must be exactly one of assessment, exemption; an unrecognized mode selects no record shape");
    return sink;
  }

  validateRecord(document, definition, { recordPath: documentPath, context: {}, sink });
  if (mode === "assessment") applyCraAssessmentRules(document, definition, { documentPath, sink });
  return sink;
}

/** Convenience evaluation: load the schema once and validate one record with a fresh sink. */
export function checkCraRecord(repositoryRoot, document, { documentPath = "contract-reuse.json" } = {}) {
  const sink = new DiagnosticSink();
  const schema = loadCraSchema(repositoryRoot, sink);
  if (schema !== null) validateCraRecord(schema, document, { documentPath, sink });
  return sink;
}

/**
 * Runs exactly the relations the assessment record shape declares, and closes
 * both directions: a declared rule with no implementation is as much a failure
 * as an implemented rule nobody declared. The exemption shape reaches neither
 * check — it declares an empty relation set and this adapter implements no
 * exemption relation.
 */
function applyCraAssessmentRules(record, definition, { documentPath, sink }) {
  const declared = (definition.rules ?? []).map((rule) => rule.id);
  for (const id of declared) {
    const rule = CRA_ASSESSMENT_RULES[id];
    if (rule === undefined) {
      sink.fail("rule-unimplemented", documentPath, `schema declares rule ${id} which the CRA adapter does not implement`);
      continue;
    }
    rule(record, documentPath, sink);
  }
  for (const id of Object.keys(CRA_ASSESSMENT_RULES)) {
    if (declared.includes(id)) continue;
    sink.fail("rule-undeclared", documentPath, `the CRA adapter implements rule ${id} which the schema does not declare`);
  }
}

/**
 * Echoes a mechanism reference only when it is already known to be a safe,
 * bounded dotted path. Anything else stays out of the diagnostic stream, which
 * may name a safe reference but never unbounded caller-supplied content.
 */
function describeReference(reference) {
  if (typeof reference !== "string") return "a non-string entry";
  if (reference.length <= 200 && SAFE_MECHANISM_REFERENCE.test(reference)) return JSON.stringify(reference);
  return "a reference that is not a safe dotted path";
}

/** Echoes an alternative approach only when it is closed-vocabulary. */
function describeApproach(approach) {
  return ASSESSMENT_DISPOSITIONS.includes(approach) ? JSON.stringify(approach) : "a non-disposition approach";
}

const CRA_ASSESSMENT_RULES = Object.freeze({
  /**
   * Disposition-specific field presence and absence. The field tables own
   * shape and bounds for fields that are present; this relation owns *which*
   * fields a disposition requires or forbids, and the proposed contract
   * identifier's separation from the canonical contract.
   */
  "cra-assessment-disposition-fields"(record, documentPath, sink) {
    const disposition = record.disposition;
    if (!ASSESSMENT_DISPOSITIONS.includes(disposition)) return; // the field table reports the enum failure

    const needsReferences = disposition === "reuse" || disposition === "extend";
    sink.require((record.mechanism_references !== undefined) === needsReferences,
      "cra-disposition-fields-invalid", documentPath,
      needsReferences
        ? `disposition ${disposition} requires mechanism_references (1 to 8 safe dotted paths)`
        : `disposition ${disposition} forbids mechanism_references`);

    sink.require((record.compatibility_classification !== undefined) === (disposition === "extend"),
      "cra-disposition-fields-invalid", documentPath,
      disposition === "extend"
        ? "disposition extend requires compatibility_classification (patch, minor, or major)"
        : `disposition ${disposition} forbids compatibility_classification`);

    sink.require((record.proposed_contract_id !== undefined) === (disposition === "new_contract"),
      "cra-disposition-fields-invalid", documentPath,
      disposition === "new_contract"
        ? "disposition new_contract requires proposed_contract_id"
        : `disposition ${disposition} forbids proposed_contract_id`);

    if (disposition === "new_contract" && typeof record.proposed_contract_id === "string") {
      sink.require(record.proposed_contract_id !== "security-audit",
        "cra-disposition-fields-invalid", documentPath,
        "proposed_contract_id must name a contract other than security-audit");
    }
  },

  /** Mechanism references are a set: repetition adds no evidence and hides one. */
  "cra-mechanism-references-unique"(record, documentPath, sink) {
    const references = record.mechanism_references;
    if (!Array.isArray(references)) return; // the field table reports the type failure
    const seen = new Set();
    const repeated = new Set();
    for (const reference of references) {
      if (typeof reference !== "string") continue; // the field table reports it
      if (seen.has(reference)) repeated.add(reference);
      seen.add(reference);
    }
    for (const duplicate of repeated) {
      sink.fail("cra-mechanism-reference-duplicate", documentPath,
        `mechanism_references must be distinct; ${describeReference(duplicate)} is repeated`);
    }
  },

  /**
   * Alternatives are the rejected dispositions: none may restate the selected
   * disposition, and none may appear twice. Only validated closed-vocabulary
   * values are echoed; anything else is already the field table's failure.
   */
  "cra-alternatives-rejected-and-unique"(record, documentPath, sink) {
    const alternatives = record.alternatives;
    if (!Array.isArray(alternatives)) return; // the field table reports the type failure
    const approaches = [];
    for (const entry of alternatives) {
      if (!isRecord(entry) || typeof entry.approach !== "string") continue; // the field table reports it
      approaches.push(entry.approach);
    }
    if (typeof record.disposition === "string" && ASSESSMENT_DISPOSITIONS.includes(record.disposition)
      && approaches.includes(record.disposition)) {
      sink.fail("cra-alternative-selected", documentPath,
        `alternatives must not contain the selected disposition ${JSON.stringify(record.disposition)}`);
    }
    const seen = new Set();
    for (const approach of approaches) {
      if (seen.has(approach)) {
        sink.fail("cra-alternative-duplicate", documentPath,
          `alternatives must be unique; approach ${describeApproach(approach)} is repeated`);
      }
      seen.add(approach);
    }
  },
});

export const craAssessmentRuleIds = Object.freeze(Object.keys(CRA_ASSESSMENT_RULES).sort());

function isRecord(value) {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  return !Array.isArray(value);
}
