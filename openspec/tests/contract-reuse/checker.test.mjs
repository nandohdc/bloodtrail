/**
 * Contract Reuse Assessment checker proof suite.
 *
 * Every mutation starts from an independently passing null control in a real
 * disposable Git repository. Assertions demand named diagnostics and a parsed
 * report; exit status alone is never evidence that the intended control fired.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import {
  MANIFEST,
  RECORD,
  addTrigger,
  createRepository,
  runCraChecker,
  signExemption,
  writeExemptionRecord,
  writeReuseRecord,
} from "./support/disposable-repo.mjs";

const repositories = [];

function fixture(options) {
  const repository = createRepository(options);
  repositories.push(repository);
  assertNullControl(repository);
  return repository;
}

after(() => {
  for (const repository of repositories) repository.dispose();
});

function assertNullControl(repository) {
  const result = runCraChecker(repository);
  assert.equal(result.status, 0, `null control failed: ${describeResult(result)}`);
  assert.equal(result.report?.outcome, "approved-skip", "an unmodified fixture must be a distinguishable approved skip");
  assert.deepEqual(result.ids, [], "a null control must not emit a CRA failure diagnostic");
}

function assertPasses(result, outcome) {
  assert.equal(result.status, 0, `expected CRA checker to pass: ${describeResult(result)}`);
  assert.equal(result.report?.outcome, outcome, `expected ${outcome}, got ${result.report?.outcome}`);
}

function assertDiagnostic(result, expected) {
  assert.ok(result.report, `checker emitted no JSON report: ${describeResult(result)}`);
  assert.notEqual(result.status, 0, `expected ${expected} to fail closed`);
  assert.ok(result.ids.includes(expected), `expected ${expected}, got [${result.ids.join(", ") || "none"}]`);
}

function describeResult(result) {
  return `status=${result.status}; ids=[${result.ids.join(", ")}]; stderr=${result.stderr}`;
}

function technicalReuseFixture(kind = "contract", options = {}) {
  const repository = fixture(options);
  writeReuseRecord(repository);
  addTrigger(repository, kind);
  repository.commit(`feat: CRA ${kind} trigger`);
  return repository;
}

function technicalExemptionFixture() {
  const repository = fixture();
  writeExemptionRecord(repository);
  addTrigger(repository, "contract");
  repository.commit("feat: CRA exemption trigger");
  return repository;
}

describe("CRA trigger and required-record outcomes", () => {
  for (const kind of ["contract", "generated", "delta"]) {
    it(`requires and validates a CRA for a ${kind} trigger`, () => {
      const repository = technicalReuseFixture(kind, {
        ownedPaths: kind === "contract" ? ["contracts/"]
          : kind === "generated" ? ["packages/security-audit-sdk-core/src/generated/"]
            : [],
      });
      assertPasses(runCraChecker(repository), "cra-validated");
    });
  }

  it("reports an approved skip for an unaffected selected change", () => {
    const repository = fixture();
    repository.write("docs/unaffected.md", "# Unaffected\n");
    repository.commit("docs: unrelated change");

    assertPasses(runCraChecker(repository), "approved-skip");
  });

  it("rejects a required CRA that is absent", () => {
    const repository = fixture();
    addTrigger(repository, "contract");
    repository.commit("feat: required CRA without record");

    assertDiagnostic(runCraChecker(repository), "cra-record-missing");
  });

  it("rejects malformed CRA JSON without exposing parser content", () => {
    const repository = fixture();
    repository.write(RECORD, "{not valid JSON\n");
    addTrigger(repository, "contract");
    repository.commit("feat: malformed CRA record");

    assertDiagnostic(runCraChecker(repository), "cra-record-malformed");
  });

  it("rejects a structurally invalid record without echoing its rationale", () => {
    const repository = fixture();
    const secret = "secret-rationale-leak";
    writeReuseRecord(repository, (record) => ({ ...record, rationale: secret }));
    addTrigger(repository, "contract");
    repository.commit("feat: invalid CRA field");

    const result = runCraChecker(repository);
    assertDiagnostic(result, "cra-record-invalid");
    assert.doesNotMatch(JSON.stringify(result.report), new RegExp(secret));
  });

  it("rejects a record that selects an unsupported contract version", () => {
    const repository = fixture();
    writeReuseRecord(repository, (record) => ({ ...record, contract: "security-audit@2.0.0" }));
    addTrigger(repository, "contract");
    repository.commit("feat: unsupported CRA contract");

    assertDiagnostic(runCraChecker(repository), "cra-contract-unsupported");
  });

  it("rejects an unavailable range base rather than treating it as an empty range", () => {
    const repository = fixture();
    assertDiagnostic(runCraChecker(repository, { base: "0000000000000000000000000000000000000000" }),
      "cra-range-unavailable");
  });

  it("rejects a shallow repository rather than trusting an incomplete merge-base range", () => {
    const repository = fixture();
    repository.write(".git/shallow", `${repository.head()}\n`);

    assertDiagnostic(runCraChecker(repository), "cra-range-unavailable");
  });

  it("rejects a range base that is not an ancestor of the evaluated head", () => {
    const repository = technicalReuseFixture("contract");
    repository.git(["switch", "-c", "side", repository.baseline]);
    repository.write("docs/side.md", "# Side branch\n");
    const sibling = repository.commit("docs: sibling of the technical head");
    repository.git(["switch", "-"]);

    assertDiagnostic(runCraChecker(repository, { base: sibling }), "cra-range-unavailable");
  });

  it("rejects an unresolvable revision string rather than misreading it as a range", () => {
    const repository = fixture();
    assertDiagnostic(runCraChecker(repository, { base: "refs/heads/does-not-exist" }),
      "cra-range-unavailable");
  });
});

describe("CRA trigger attribution fails closed", () => {
  it("rejects a trigger matched by no selected owned-path set", () => {
    const repository = technicalReuseFixture("contract", { ownedPaths: ["packages/example/"] });
    assertDiagnostic(runCraChecker(repository), "cra-trigger-unattributable");
  });

  it("reports an approved skip when trigger is uniquely attributed to another active change", () => {
    const repository = technicalReuseFixture("contract", {
      ownedPaths: ["packages/example/"],
      extraChanges: [{ id: "other-contract-change", ownedPaths: ["contracts/"] }],
    });
    assertPasses(runCraChecker(repository), "approved-skip");
  });

  it("evaluates a required CRA for the active change that uniquely owns the trigger", () => {
    const repository = technicalReuseFixture("contract", {
      ownedPaths: ["packages/example/"],
      extraChanges: [{ id: "other-contract-change", ownedPaths: ["contracts/"] }],
    });
    assertDiagnostic(runCraChecker(repository, { change: "other-contract-change" }), "cra-record-missing");
  });

  it("fails closed when the range contains both a foreign trigger and an unowned trigger", () => {
    const repository = technicalReuseFixture("contract", {
      ownedPaths: ["packages/example/"],
      extraChanges: [{ id: "other-contract-change", ownedPaths: ["contracts/"] }],
    });
    repository.write("packages/security-audit-sdk-core/src/generated/unowned.ts", "export const x = 1;\n");
    repository.commit("feat: add unowned generated trigger");

    assertDiagnostic(runCraChecker(repository), "cra-trigger-unattributable");
  });

  it("rejects a trigger matched by more than one active change", () => {
    const repository = technicalReuseFixture("contract", {
      ownedPaths: ["contracts/"],
      extraChanges: [{ id: "other-contract-change", ownedPaths: ["contracts/"] }],
    });
    assertDiagnostic(runCraChecker(repository), "cra-trigger-unattributable");
  });
});

describe("CRA mechanism resolution follows structural acceptance", () => {
  it("rejects a non-authoritative canonical source before resolving references", () => {
    const repository = fixture();
    repository.mutateJson("contracts/security-audit/source/contract.source.json",
      (source) => ({ ...source, authoritative_source: false }));
    writeReuseRecord(repository);
    addTrigger(repository, "contract");
    repository.commit("feat: tampered CRA canonical source");

    assertDiagnostic(runCraChecker(repository), "cra-contract-source-unavailable");
  });

  it("rejects a structurally valid but unresolved safe reference", () => {
    const repository = fixture();
    writeReuseRecord(repository, (record) => ({
      ...record,
      mechanism_references: ["registries.trust_levelz"],
    }));
    addTrigger(repository, "contract");
    repository.commit("feat: unresolved CRA mechanism");

    const result = runCraChecker(repository);
    assertDiagnostic(result, "cra-mechanism-unresolved");
    const diagnostic = result.report.failures.find((failure) => failure.id === "cra-mechanism-unresolved");
    assert.match(diagnostic.message, /registries\.trust_levelz/);
  });

  it("accepts a new-contract assessment without attempting mechanism resolution", () => {
    const repository = fixture();
    writeReuseRecord(repository, (record) => ({
      ...record,
      disposition: "new_contract",
      proposed_contract_id: "separate-client-evidence",
      mechanism_references: undefined,
      alternatives: [{
        approach: "reuse",
        rejection_reason: "The separately versioned boundary intentionally does not reuse the audit-event contract as its source of canonical semantics.",
      }],
    }));
    addTrigger(repository, "contract");
    repository.commit("feat: separate CRA contract");

    assertPasses(runCraChecker(repository), "cra-validated");
  });
});

describe("CRA owner-bound exemptions", () => {
  it("rejects a structurally valid exemption before its signed direct-child evidence exists", () => {
    const repository = technicalExemptionFixture();
    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("accepts an exemption only when one record-only direct child binds the exact candidate tree", () => {
    const repository = technicalExemptionFixture();
    const { technical, signed } = signExemption(repository);
    assert.equal(repository.git(["rev-parse", `${signed}^`]).trim(), technical,
      "the signed exemption record must be T's direct child");

    assertPasses(runCraChecker(repository), "approved-exemption");
  });

  it("rejects an exemption whose content binding names another candidate tree", () => {
    const repository = technicalExemptionFixture();
    signExemption(repository, (record) => ({
      ...record,
      reviewedContent: { ...record.reviewedContent, candidateRoot: "0000000000000000000000000000000000000000" },
    }));

    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("rejects an exemption signed by a different reviewer identity", () => {
    const repository = technicalExemptionFixture();
    signExemption(repository, (record) => ({
      ...record,
      reviewer: { ...record.reviewer, name: "CRA Fixture Author" },
    }));

    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("rejects an author assertion that is not marked as a signed exemption", () => {
    const repository = technicalExemptionFixture();
    signExemption(repository, (record) => ({ ...record, signed: false }));

    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("rejects an exemption without its exact owner grant token", () => {
    const repository = technicalExemptionFixture();
    signExemption(repository, (record) => ({
      ...record,
      authorizations: { ...record.authorizations, granted: ["different-grant"] },
    }));

    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("rejects a duplicate fixed-source exemption binding", () => {
    const repository = technicalExemptionFixture();
    signExemption(repository);
    repository.mutateJson(MANIFEST, (manifest) => {
      manifest.governanceRecords.push({ ...manifest.governanceRecords[0] });
      return manifest;
    });
    repository.commit("docs: duplicate CRA exemption evidence");

    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("rejects a stale exemption whose signed record is not T's direct child", () => {
    const repository = technicalExemptionFixture();
    const technical = repository.head();
    repository.write("docs/interposed.md", "# Interposed\n");
    repository.commit("docs: interpose after CRA technical candidate");
    signExemption(repository, (record) => ({ ...record, reviewedCommit: technical }));

    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("rejects an exemption whose selected change root has moved past the reviewed candidate", () => {
    const repository = technicalExemptionFixture();
    signExemption(repository);
    writeExemptionRecord(repository, (record) => ({
      ...record,
      rationale: "An edited rationale after signing, so the selected change root no longer matches the reviewed candidate tree.",
    }));
    repository.commit("docs: post-sign CRA record edit");

    assertDiagnostic(runCraChecker(repository), "cra-exemption-unauthorized");
  });

  it("rejects a caller-selected foreign exemption source field", () => {
    const repository = fixture();
    writeExemptionRecord(repository, (record) => ({
      ...record,
      governance_locator: { ...record.governance_locator, source: "other-record.json" },
    }));
    addTrigger(repository, "contract");
    repository.commit("feat: foreign CRA exemption source");

    const result = runCraChecker(repository);
    assertDiagnostic(result, "cra-record-invalid");
    assertDiagnostic(result, "cra-exemption-unauthorized");
  });
});
