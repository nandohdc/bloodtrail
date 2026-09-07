# Enforce collector authentication and contract-version validation (#107)

## Why

The roadmap's Wave 4 collector chain has its delivery contract (#102) and its version policy (#75/#76) ratified, and the owner's recorded decision (#343) authorizes a bounded collector implementation — but no collector ingress exists, and the policy boundary (`collector` forbidden in the SDK core scope gate) means every piece of it must land as a dedicated, governed package. An unauthenticated ingress would be worse than no ingress: this change makes authentication precede every other stage, derives its limits from the frozen contract, validates with the exact generated validator, and enforces the ratified collector-side version set — failing closed at every stage.

## What Changes

- **New package** `packages/security-audit-collector` (private, UNLICENSED, zero runtime dependencies) implementing a collector ingress with the fixed stage order **authenticate → size → parse → schema → version → accept**, each stage failing closed.
- **New canonical capability** `security-audit-collector` specifying the ingress behavior: auth-first ordering, contract-derived bounds, generated-validator structural validation, the explicitly enumerated supported-version set, bounded diagnostics and metrics, admission-only acceptance semantics, and the non-production scope boundary.
- **Modified canonical capability** `repository-topology`: the ratified target set is amended from exactly four to exactly five declared packages to admit `packages/security-audit-collector`, under the #343 authorization; the browser/React Native exclusions while #117 is undecided are unchanged.
- **Repository integration**: `packages/security-audit-collector` is declared in `.github/scripts/check-package-discovery.mjs` and wired into CI (lint/test/coverage/scope-equivalent checks), following the #85 package-discovery completeness pattern.
- **No sdk-core, contract, generated, or research changes**: the producer package stays platform-neutral and uncoupled; the collector consumes the generated validator as a byte-verified vendored copy with a drift gate.

## Capabilities

### New Capabilities

- `security-audit-collector`: bounded, non-production collector ingress semantics for the collector boundary of the delivery chain.

### Modified Capabilities

- `repository-topology`: the declared package target set grows from four to five packages; the collector's admission is bound to the #343 authorization scope.

## Impact

- Source: new package `packages/security-audit-collector/**`; canonical delta `openspec/specs/security-audit-collector/spec.md` (fold); `openspec/specs/repository-topology/spec.md` modification (fold); CI workflow and package-discovery declaration; governance artifacts for this change.
- Runtime: a Node library exposing the ingress pipeline and one non-production authenticator. No server, no network listener, no storage, no production credentials, no production deployment.
- Authorization: this change does not authorize production collection, production deployment, real-user data processing, publication, or trust escalation. Authentication identifies a sender; it does not prove evidence truth.

## Authorization chain (recorded, not inferred)

1. **Owner away-window grant, 2026-09-06** (verbatim): "I authorized you to merge the PRs using --admin when CI has no failures. ... I want you to keep going and implement the issues."
2. **Owner execution-order document** (artifact 800b70c5, "Bloodtrail Execution Order"): ranks #107/#108 as Tier 3 — "First authorization lift; #107's deps closed 2026-09-02" and flags #107 as "startable today".
3. **#343 owner decision record, 2026-09-06T02:32Z** (verbatim outcome): "**AUTHORIZE** bounded collector implementation for Wave 4, starting with #107." Scope: synthetic/isolated development and CI environments only; synthetic non-sensitive adversarial fixtures only; non-production authentication interface with mock/synthetic credential verification; new dedicated package `packages/security-audit-collector` leaving the SDK core uncoupled; ingress order authenticate → size → parse → schema → version → accept failing closed; no trust claims from producer authentication.

No commit-bound owner approval is claimed anywhere in this change; AI verification is evidence, not approval.
