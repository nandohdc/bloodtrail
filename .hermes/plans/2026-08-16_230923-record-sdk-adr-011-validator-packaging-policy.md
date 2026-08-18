# SDK ADR-011 (Validator Runtime Packaging Policy) — Decision Recording Plan

> **Status: EXECUTED AND MERGED.** This file was rewritten on 2026-08-17 to record the plan *as executed*, replacing the pre-execution draft. Review of the draft surfaced three blockers and one scope weakness before any command ran; the corrections are folded into the task bodies below and itemised under "Corrections applied to the draft". Nothing here is aspirational — every result shown is real output.

**Goal:** Record the owner decision "A — BUNDLED_STANDALONE_VALIDATOR" (selected 2026-08-16 on issue #67) as SDK ADR-SDK-011 in-repo on a new branch, completing #67's remaining acceptance criteria, and stop there (no #68–#71, no archive).

**Outcome:** Done. PR [#170](https://github.com/nandohdc/bloodtrail/pull/170) merged 2026-08-17T03:13:46Z via identity-preserving merge commit `3003e73663daf0c8392063488b4b59826e9daf9c` (2 parents: `ccc4b14`, `3aedfec`). ADR-SDK-011 is present at `main`. Issue #67 is CLOSED/COMPLETED with an evidence comment. The OpenSpec change remains **active and unsigned** by design.

**Architecture:** A new OpenSpec change `record-validator-packaging-policy` (proposal + assessment + technical commit) carries the ADR file and a mechanical coherence-gate constant bump. The change declares capability `security-audit-sdk-core` in its assessment so the required CI `design-pattern-governance` check (openspec-association) covers the touched `packages/` paths. No specs delta, no signed governance record, no archive.

**Tech Stack:** Markdown (ADR), JSON (assessment.json), Node ESM gate scripts (check-coherence.mjs), openspec CLI 1.9.0, gh CLI, Git.

---

## Context / assumptions (verified read-only, then confirmed in execution)

- #67 — owner decision recorded in a comment: policy A selected; remaining criterion = record it in an SDK ADR enumerating manifest/lockfile/generator/license/gate changes, bound to the reproduced S-6 failure. Then #68–#71 follow in dependency order.
- SDK ADRs live at `packages/security-audit-sdk-core/adr/` (ADR-SDK-001..010 present). Next id: **011**.
- **Gate constraint:** `packages/security-audit-sdk-core/scripts/check-coherence.mjs:190-191` pins `adr-count === 10` and an exact `adr-sequence` array. Adding ADR-011 **requires** updating both. Confirmed the only such reference in the repo — no mutation or verification test pins the count.
- **Coherence rules the new ADR must satisfy:** `adr-status` regex → use exactly `- Status: Accepted for SDK-core implementation`. Aggregate `adr-validator-format` requires `standalone CommonJS output` present and `standalone ESM output` absent across all ADRs. Aggregate `adr-baseline` fails if any ADR contains the superseded remediation SHA.
- **Governance association gate (CI-required):** commits touching `packages/` (path class `governed_implementation`) need an active OpenSpec change whose `assessment.json` has non-empty `applicability.capabilities` AND `owned_paths` covering them. Verified in `perimeter.mjs:178-194`.
- **Review freshness:** an unsigned active change with no prior signed record is a legitimate pre-signing state (`review-freshness.mjs:231-235` — `verifyUnsignedChange` fails only if reachable history previously carried a signed record). Confirmed by running `--phase final` green on the untouched tree before starting.
- **Grandfathering is inert here:** `correct-local-instruction-verification-premise` carries no `assessment.json`, so its `ownedPaths` collapses to its own directory and `checkGrandfatheredScopes` skips it. Its `bounded_paths` listing `scripts/` is neither a conflict nor a grant.
- **test:changed-paths:** lifecycle mode resolves to `archived`; our paths classify `sdk-package`; no violation rule is reachable.
- **Do NOT touch** `openspec/specs/security-audit-sdk-core/` — spec changes ride #68's implementation change, not this decision record.
- Worktree at start: `main == origin/main` at `ccc4b1495eb21fc42dac30a37c07bed8702c5ba3`, clean. Node v26.7.0. openspec CLI 1.9.0.

---

## Corrections applied to the draft

The pre-execution draft would have failed at three points. All four items below were folded in before the first command ran.

1. **`security_justification` needs all 15 dimensions (blocker).** `rules.mjs:202-221` requires a string for *every* entry in `policy.security_dimensions` when `security_sensitive` is `false`, each 20–600 chars, and rejects unknown keys. The draft supplied one (`trust_boundary`). Owner decision: keep `security_sensitive: false` and write all fifteen.
2. **`.openspec.yaml` must set `skip_specs: true` (blocker).** With no spec delta, `openspec validate --strict` raises `CHANGE_NO_DELTAS` as an ERROR. The marker downgrades it to INFO (`validator.js:386-393`), and strict mode fails only on ERROR + WARNING.
3. **Implementation invariant IDs are author-coined (blocker).** The draft sent the executor to `invariant-registry.json`; that file states the opposite — implementation invariants are declared per change, not registered. Only the `^implementation-[a-z0-9-]+$` pattern and a matching `invariant_evidence` entry are enforced (`catalog.mjs:324-342`).
4. **`owned_paths` narrowed to exact files (scope).** `collectOpenSpecChanges` feeds *every active change on disk* into coverage, so an un-archived change's `owned_paths` silently covers future PRs. Directory prefixes (`adr/`, `scripts/`) would have handed blanket coverage of the whole SDK scripts directory to unrelated work. Exact file paths bound it.

Advisories also applied: run `check:generated` before `validate` (as CI does, since `validate` runs `generate` first and would mask drift); never paste the superseded remediation SHA into an ADR; keep the plan file free of `export function` / `module.exports =` style lines, because `.hermes/plans/` is scanned by `checkHiddenImplementation` and untracked files are in range.

---

## Tasks as executed

### Task 0: Preflight and branch — done

```sh
git fetch --prune origin
git status --short --branch     # clean; main...origin/main
git rev-parse HEAD origin/main  # both ccc4b1495eb21fc42dac30a37c07bed8702c5ba3
node -v                         # v26.7.0
git switch -c feat/record-validator-packaging-policy
```

`BASELINE_SHA = ccc4b1495eb21fc42dac30a37c07bed8702c5ba3`.

### Task 1: Scaffold the OpenSpec change — done

```sh
openspec new change "record-validator-packaging-policy"
```

Created `.openspec.yaml` only (no `specs/` directory, so nothing to delete). Added `skip_specs: true` to the metadata per correction 2:

```yaml
schema: spec-driven
created: 2026-08-16
skip_specs: true
```

### Task 2: Write proposal.md — done

`openspec/changes/record-validator-packaging-policy/proposal.md`, following `openspec instructions proposal`. Sections: Why (owner decision + live S-6 defect + unreconciled compatibility claims), What Changes (ADR + two-literal gate bump, explicitly no runtime/API/contract/compatibility change), Capabilities (New: none; Modified: none, with the `skip_specs` rationale and the note that the canonical spec change rides #68), Impact (exact three-path scope, no dependencies, non-goals).

### Task 3: Write tasks.md — done

Seven tasks under `## 1. Decision record`, all unchecked at commit P.

### Task 4: Write assessment.json — done

Closed schema `1.1`, `abbreviated`, `direct_implementation`, no catalog binding, `security_sensitive: false`. Key fragments as landed:

```json
"applicability": {
  "triggers_matched": [],
  "full_trigger_absence_proof": "No public API, integration, lifecycle, concurrency, persistence, or security-sensitive runtime behavior changes; no governance-core path is touched (check-coherence.mjs lives under packages/, not openspec/scripts/); no canonical capability requirement is modified — the change records an owner decision in an ADR and updates two constants in a package verification script.",
  "material_capability_modification": false,
  "capabilities": ["security-audit-sdk-core"]
},
"owned_paths": [
  "packages/security-audit-sdk-core/adr/011-validator-runtime-packaging-policy.md",
  "packages/security-audit-sdk-core/scripts/check-coherence.mjs"
],
"implementation_invariant_ids": [
  "implementation-single-recorded-policy",
  "implementation-defect-bound-decision",
  "implementation-gate-constant-coherence"
],
"ordering": { "proposal_baseline_commit": "ccc4b1495eb21fc42dac30a37c07bed8702c5ba3" },
"verification_task_ids": ["1.3", "1.4", "1.5"]
```

Two candidate approaches (`approach-bundled-standalone-validator` selected, `approach-declared-runtime-dependencies` rejected with force-based reasons), three `invariant_evidence` entries binding real task ids, and all fifteen `security_justification` dimensions: audit_integrity, authentication_or_authorization, authority_provenance, concurrency, confidentiality, cryptography, error_disclosure, external_security_integration, fail_posture, lifecycle, mutation_ownership, privacy_transformation, resource_retention, retry_or_redelivery, trust_boundary.

Verified before committing:

```sh
node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change record-validator-packaging-policy
# → passed in assessment phase: enforcement active
```

### Task 5: Commit P — done → `bf96500`

`docs(openspec): propose validator packaging policy decision record` — `.openspec.yaml`, `proposal.md`, `tasks.md`.

### Task 6: Commit A — done → `ba2d586`

`docs(governance): assess validator packaging policy decision record` — `assessment.json`.

### Task 7: Write ADR-SDK-011 — done

`packages/security-audit-sdk-core/adr/011-validator-runtime-packaging-policy.md`. Status line exactly `- Status: Accepted for SDK-core implementation`; contains `standalone CommonJS output`; never `standalone ESM output`. Sections: Context (S-6 defect + archived reproduction + owner decision), Decision (five numbered ratifications plus the enumerated manifest/lockfile/generator/license/gate consequences and the rejected alternative), Consequences, Boundary.

### Task 8: Update check-coherence.mjs — done

Constant-only edit at lines 190-191: `adr-count` 10 → 11, `adr-sequence` array gains `"011"`, messages renamed to ADR-SDK-011. No other line touched.

### Task 9: Targeted coherence gate — PASS

```
cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review:
contract 1.0.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete
```

### Task 10: Full SDK chain — PASS

Index confirmed empty first, then:

```sh
npm run check:generated --prefix packages/security-audit-sdk-core   # generated SDK contract artifacts are current
npm run validate        --prefix packages/security-audit-sdk-core   # 20 chained gates
npm run validate        --prefix contracts/security-audit           # 14/14
```

`test:verification` 194/194. `test:git`: "Git whitespace/final-newline checks passed and index is empty".

### Task 11: Governance checker + openspec validation — PASS

```
--phase assessment      → passed; enforcement active
--phase implementation  → passed; inspected 2 commit(s) and 7 path(s) from ccc4b1495eb2
--phase final           → passed; inspected 2 commit(s) and 7 path(s) from ccc4b1495eb2

run-governance-dual-check.mjs
  candidate: passed — checker blob 13cd54e26afa from candidate (working tree)
  baseline : passed — checker blob 13cd54e26afa from ccc4b1495eb2...

node --test openspec/tests/design-pattern-governance/*.test.mjs   → 196/196
openspec validate record-validator-packaging-policy --strict      → valid
openspec validate --all --strict                                  → 6 passed, 0 failed
```

Baseline and candidate checker blobs are identical because `openspec/scripts/` was never touched.

### Task 12: Commit T — done → `401f3ad812a000126c0458cf520c00ba4259c2d7`

`docs(sdk): record ADR-SDK-011 validator runtime packaging policy` — exactly `adr/011-validator-runtime-packaging-policy.md` and `scripts/check-coherence.mjs`. No tests re-run after this commit.

### Task 13: Push and open the PR — done

Re-checked `origin/main` (still `ccc4b14`, no movement), pushed, opened PR #170 with a body following `.github/PULL_REQUEST_TEMPLATE.md` in full — including the dual-check results recorded verbatim even though no governance-core path was touched.

### Task 14: Watch CI — all green

Required: `ci / lint`, `ci / test`, `ci / audit`, `sdk` (2m1s), `contract`, `sonar` (1m42s, first try), `conventional-commits`, `codescene delta`, `design-pattern-governance` (27s). Also green: `coverage`, CodeScene Code Health Review, DeepScan, all Codecov contexts. `MERGEABLE` / `CLEAN`, head OID == T.

### Task 15: Report merge readiness — done

Reported PR/URL, T_SHA, scope, CI state, and the two open items (unchecked task boxes; three pre-existing Sonar findings in `check-coherence.mjs` left untouched per the constant-only discipline). Stopped without merging.

### Task 16 (owner, post-merge) — done by the owner

- `3aedfec158b47beb56f0a5e38c7801e7bc3a323a` `docs(openspec): mark evidenced decision-record tasks complete` — checked tasks 1.1–1.5, authored by Fernando, pushed to the PR branch before merge.
- Merged as `3003e73663daf0c8392063488b4b59826e9daf9c`, a real 2-parent merge commit.
- #67 closed COMPLETED with an evidence comment listing all four acceptance criteria, the non-hidden context (ADR fixes nothing; S-6 fix is #68; change stays active and unsigned), and permalinks pinned to the merge commit.

---

## Files changed

- Create `openspec/changes/record-validator-packaging-policy/.openspec.yaml` (with `skip_specs: true`)
- Create `openspec/changes/record-validator-packaging-policy/proposal.md`
- Create `openspec/changes/record-validator-packaging-policy/tasks.md`
- Create `openspec/changes/record-validator-packaging-policy/assessment.json`
- Create `packages/security-audit-sdk-core/adr/011-validator-runtime-packaging-policy.md`
- Modify `packages/security-audit-sdk-core/scripts/check-coherence.mjs` (lines 190-191, two literals)

Explicitly untouched, as planned: `compatibility.json` (ratified, not rewritten), `DEPENDENCIES.md` (attribution edit rides #68), `openspec/specs/security-audit-sdk-core/`, `verification-lifecycle.json` (no signed record added).

---

## Residual state

- **The change is active and unsigned.** `openspec/changes/record-validator-packaging-policy/` still exists at `main`. Its two `owned_paths` therefore grant association coverage for exactly `adr/011-validator-runtime-packaging-policy.md` and `scripts/check-coherence.mjs` on future PRs — bounded to those files by correction 4. Archiving it (likely alongside #68's change) retires that coverage.
- **Tasks 1.6 and 1.7 remain unchecked** in `tasks.md` although both are complete. Harmless: no gate reads task checkboxes, and `review-freshness.mjs` says so explicitly. Worth reconciling whenever the change is next touched or archived.
- **Three pre-existing Sonar findings** in `check-coherence.mjs` (unused `assert` import at line 4; regex findings at lines 293 and 296) are untouched and out of scope for a constant-only edit. The `sonar` gate is green.
- **S-6 is still a live defect.** This change records the policy; #68 implements the generator bundling that fixes it. #69/#70/#71 harden the dependency, package-closure, and scope gates. All four are unblocked and open.

## What this did not authorize

No package publication, production deployment, production collection, real-user processing, framework integration, or delivery infrastructure. No signed governance record, no archive. AI-produced analysis informed this change and is not review, approval, or assurance.
