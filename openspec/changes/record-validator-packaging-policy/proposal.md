## Why

The project owner selected exactly one validator packaging policy on 2026-08-16 in issue #67 — **A — `BUNDLED_STANDALONE_VALIDATOR`** — and that decision currently exists only as an issue comment. Issue #67's remaining acceptance criterion is that the decision be recorded in-repo as an SDK ADR that enumerates the manifest, lockfile, generator, license, and gate consequences, and that binds the decision to the reproduced S-6 failure.

S-6 is a live defect at `main`: the packed `dist/generated/schema-validator.generated.cjs` `require()`s ajv runtime helpers (`ajv/dist/runtime/ucs2length` and related) that are declared as devDependencies only, so a production-only install fails at import with `MODULE_NOT_FOUND`. It is reproduced and recorded in `openspec/changes/archive/2026-08-11-remediate-security-audit-sdk-adversarial-review/technical-review-packet.md` (S-6 section). Until the policy is recorded, `compatibility.json`'s `runtimeDependencyCount: 0` and `modulePolicy: "esm-public-cjs-standalone-validator"` remain unreconciled assertions rather than decided policy, and issues #68–#71 stay blocked behind an undocumented decision.

## What Changes

- Add `packages/security-audit-sdk-core/adr/011-validator-runtime-packaging-policy.md` recording the owner's selection of `BUNDLED_STANDALONE_VALIDATOR`, its enumerated manifest, lockfile, generator, license, and gate consequences, the rejected alternative, and its binding to the reproduced S-6 failure.
- Update `packages/security-audit-sdk-core/scripts/check-coherence.mjs` so the `adr-count` and `adr-sequence` rules admit ADR-SDK-011 (10 → 11). This is a two-literal constant change; no rule semantics change.
- No runtime code, no public API, no contract, and no `compatibility.json` change. `runtimeDependencyCount: 0` and `modulePolicy: "esm-public-cjs-standalone-validator"` are ratified as explicit decided policy by the ADR rather than rewritten.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change records a decision; it modifies no requirement of `security-audit-sdk-core`. Its `.openspec.yaml` therefore sets `skip_specs: true`. The assessment binds the change to the `security-audit-sdk-core` capability because the recorded policy governs that capability's packaging, but the canonical spec change rides #68's implementation change, not this decision record.

## Impact

- **Scope**: `openspec/changes/record-validator-packaging-policy/`, `packages/security-audit-sdk-core/adr/011-validator-runtime-packaging-policy.md`, and `packages/security-audit-sdk-core/scripts/check-coherence.mjs`. Nothing else.
- **Code**: none. The only executable change is two literals in a verification script.
- **Dependencies**: none. `dependencies`, `peerDependencies`, and `optionalDependencies` stay empty; ajv and ajv-formats remain devDependencies.
- **Non-goals**: this change does not repair S-6 (#68), does not harden the dependency, package-closure, or scope gates (#69/#70/#71), does not authorize production deployment or package publication, and is not archived as part of this work.
