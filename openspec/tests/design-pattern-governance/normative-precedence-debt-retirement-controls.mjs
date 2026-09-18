import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateDebtRetirementEvidence } from "../../scripts/normative-precedence/debt-retirement.mjs";
import {
  inspectFold,
  validateFoldAuthorization,
  validateFoldIdentity,
  validateFoldPreview,
  validateFoldReviewBinding,
} from "../../scripts/normative-precedence/fold-validation.mjs";
import { inspectRepository } from "../../scripts/normative-precedence/model.mjs";
import { gitObject, gitStdout } from "../../scripts/normative-precedence/shared.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const policy = JSON.parse(readFileSync(resolve(root, "openspec/governance/normative-source-precedence.json"), "utf8"));
const base = "49ab0c255a41cc99328ff2cd5d442ffbc80b1bb1";

function codes(diagnostics) {
  return diagnostics.map((entry) => entry.code);
}

function run(cwd, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function withHistoricalConflict(callback) {
  const repo = mkdtempSync(resolve(tmpdir(), "bloodtrail-cb018-conflict-"));
  try {
    run(root, ["git", "clone", "-q", "--shared", root, repo]);
    const path = "openspec/specs/security-audit-event-contract/spec.md";
    const historical = spawnSync("git", ["show", `${base}:${path}`], { cwd: root, encoding: "utf8" });
    assert.equal(historical.status, 0, historical.stderr);
    writeFileSync(resolve(repo, path), historical.stdout);
    callback(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

function retirementFixture() {
  const prior = {
    source_path: "contracts/security-audit/source/contract.source.json",
    source_blob: "1".repeat(40),
    capability_path: "openspec/specs/security-audit-event-contract/spec.md",
    capability_blob: "2".repeat(40),
  };
  const resolving = {
    source_path: prior.source_path,
    source_blob: prior.source_blob,
    capability_path: prior.capability_path,
    capability_blob: "3".repeat(40),
  };
  const authorization = {
    id: "resolve-debt",
    path: "openspec/changes/define-normative-precedence-lifecycle/authorizations/resolve-debt.json",
    object: "4".repeat(40),
    operation: "RESOLVE_DEBT",
    grant: policy.governance_authorities.debt_resolution_grant,
    withheld: ["IMPLEMENT", "MERGE", "FOLD", "ACTIVATE", "RELEASE", "ARCHIVE"],
  };
  const debt = {
    id: "candidate-a-current-capability-version-drift",
    assertion_id: "contract-version-is-current-capability-literal",
    ...prior,
    lineage: ["revision-2-inline-bindings:candidate-a-current-capability-version-drift"],
  };
  const historical = {
    path: "pins/historical.json",
    object: "5".repeat(40),
    value: { id: "historical", debts: [debt] },
  };
  const retirement = {
    id: debt.id,
    assertion_id: debt.assertion_id,
    resolution: "RESOLVED",
    retired_from: `historical:${debt.id}`,
    lineage: [...debt.lineage, `historical:${debt.id}`],
    prior,
    resolving,
    authorization: {
      id: authorization.id,
      path: authorization.path,
      object: authorization.object,
      operation: authorization.operation,
      grant: authorization.grant,
    },
  };
  const selected = {
    path: "pins/current.json",
    object: "6".repeat(40),
    value: {
      id: "current",
      debts: [],
      retired_debts: [retirement],
      repository_state: {
        source: { path: resolving.source_path, object: resolving.source_blob },
        capabilities: [{
          id: "security-audit-event-contract",
          path: resolving.capability_path,
          object: resolving.capability_blob,
        }],
      },
    },
  };
  return { retirement, selected, pinSets: [historical, selected], authorization };
}

function retirementDiagnostics(mutator = () => {}, overrides = {}) {
  const fixture = retirementFixture();
  mutator(fixture);
  return validateDebtRetirementEvidence({
    ...fixture,
    policy,
    assertionResolved: true,
    ...overrides,
  });
}

test("CB018-T001 contract-version debt still blocks activation when the historical conflict persists", () => {
  withHistoricalConflict((repo) => {
    const fixturePolicy = JSON.parse(readFileSync(resolve(repo, "openspec/governance/normative-source-precedence.json"), "utf8"));
    const result = inspectRepository(repo, fixturePolicy, { stage: "activation", baseCommit: base });
    assert.ok(codes(result.diagnostics).includes("baseline-conflict-stage-block"));
  });
});

test("CB018-T002 fold authority still withholds activation", () => {
  const record = { operation: "FOLD", grant: policy.governance_authorities.fold_grant, withheld: [], id: "fold" };
  assert.ok(codes(validateFoldAuthorization(record, policy)).includes("fold-activation-separation-missing"));
});

test("CB018-T003 retirement without exact authorization fails", () => {
  assert.ok(codes(retirementDiagnostics(() => {}, { authorization: null })).includes("debt-retirement-unauthorized"));
});

test("CB018-T004 retirement with wrong object bindings fails", () => {
  assert.ok(codes(retirementDiagnostics(({ retirement }) => {
    retirement.resolving.capability_blob = "0".repeat(40);
  })).includes("debt-retirement-binding-mismatch"));
});

test("CB018-T005 retirement without resolved assertion evidence fails", () => {
  assert.ok(codes(retirementDiagnostics(() => {}, { assertionResolved: false })).includes("debt-retirement-unsubstantiated"));
});

test("CB018-T006 pin-set evidence cannot authorize its own retirement", () => {
  assert.ok(codes(retirementDiagnostics(({ retirement, authorization }) => {
    const path = `${policy.repository_evidence.pin_sets_root}/self.json`;
    retirement.authorization.path = path;
    authorization.path = path;
  })).includes("debt-retirement-self-authorized"));
});

test("CB018-T007 retirement lineage must extend the historical debt", () => {
  assert.ok(codes(retirementDiagnostics(({ retirement }) => {
    retirement.lineage = [retirement.retired_from];
  })).includes("baseline-conflict-not-inherited"));
});

test("CB018-T008 fold without a deterministic preview fails", () => {
  const result = inspectFold(root, policy, { baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("fold-preview-missing"));
});

test("CB018-T009 fold preview must match the target object", () => {
  const path = policy.capabilities[0].path;
  assert.ok(codes(validateFoldPreview(root, {
    targets: [{ capability_id: policy.capabilities[0].id, target_path: path, preview_object: "0".repeat(40) }],
  })).includes("fold-preview-mismatch"));
});

test("CB018-T010 fold identity must bind each required object", () => {
  const technicalCommit = gitStdout(root, ["rev-parse", "HEAD"]);
  const identity = {
    technical_commit: technicalCommit,
    tree: gitStdout(root, ["rev-parse", `${technicalCommit}^{tree}`]),
    governed_path_objects: {},
  };
  const preview = { targets: [{ target_path: policy.capabilities[0].path }] };
  assert.ok(codes(validateFoldIdentity(root, identity, { policy, preview, pinPath: "pins/current.json" }))
    .includes("fold-identity-incomplete"));
});

test("CB018-T011 folded-content review must bind every required path", () => {
  const preview = { targets: [{ target_path: policy.capabilities[0].path }] };
  assert.ok(codes(validateFoldReviewBinding(policy, preview, "pins/current.json", { governed_path_objects: {} }))
    .includes("review-binding-incomplete"));
});
