## 1. Mutation Controls

- [ ] 1.1 Add a package-copy harness with an unmutated null control that runs the real scope gate and passes, reporting the declared inventory per role.
- [ ] 1.2 Add M-71-A authored global mutation (`process.env.X`) failing closed with `[platform-coupling:undeclared-global]` naming the artifact and `process`.
- [ ] 1.3 Add M-71-B evasion mutation (`globalThis["fe" + "tch"](u)`) failing closed with `[platform-coupling:undeclared-global]` naming `globalThis`.
- [ ] 1.4 Add M-71-C generated global mutation (`Buffer.byteLength` in `schema-validator.generated.cjs`) failing closed for role-unauthorized global.
- [ ] 1.5 Add M-71-D generated specifier mutation (`require(...)` in `schema-validator.generated.cjs`) failing closed with `[platform-coupling:undeclared-specifier]`.
- [ ] 1.6 Add M-71-E negative control with a function parameter named `process` and block-scoped `Buffer` passing at exit 0.
- [ ] 1.7 Add M-71-F negative control with type-position utility types and `Uint8Array` passing at exit 0.
- [ ] 1.8 Add M-71-G and M-71-H fail-closed mutation arms for unparseable artifact, unreadable artifact, and empty inspection set.
- [ ] 1.9 Add M-71-I distinguishability mutation (`src/transport.ts`) proving existing production-integration diagnostic is emitted without coupling codes.
- [ ] 1.10 Assert bounding, escaping, and source-marker absence across all failing mutation arms.

## 2. Platform Coupling Policy and Scope Gate Integration

- [ ] 2.1 Create `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs` defining frozen `PLATFORM_COUPLING_POLICY` for `authored` and `generated` roles.
- [ ] 2.2 Implement AST-based reference collector `collectCouplingReferences` with lexical scope tracking, type-position skipping, and property-position skipping.
- [ ] 2.3 Implement `inspectPlatformCoupling` walking all runtime code artifacts, classifying references, and generating sorted violations.
- [ ] 2.4 Integrate coupling inspection into `packages/security-audit-sdk-core/scripts/check-scope.mjs` while preserving legacy rules and reporting coupling inventory.
- [ ] 2.5 Run null control, negative controls, and positive mutations against the wired scope gate and prove deterministic pass/fail signals.

## 3. Documentation and Verification

- [ ] 3.1 Append platform coupling domain terms to `packages/security-audit-sdk-core/CONTEXT.md`.
- [ ] 3.2 Add root ADR `docs/adr/0004-declare-platform-coupling-at-the-scope-gate.md` recording AST inspection, role-keyed policy data, and retention of `Buffer`.
- [ ] 3.3 Update `CLAUDE.md`, `.hermes.md`, and repository `README.md` to reflect platform coupling enforcement in the scope gate.
- [ ] 3.4 Run full verification chains (SDK, contract, OpenSpec strict, governance) and code review with an empty index.
- [ ] 3.5 Commit and push verified implementation candidate for PR 1.

## 4. Canonical Spec Fold and Archive

- [ ] 4.1 Fold ADDED requirement into canonical `openspec/specs/security-audit-sdk-core/spec.md` in PR 2 while change is active.
- [ ] 4.2 Close issue #71 with comprehensive evidence linking PR merges and matrix verification.
- [ ] 4.3 Relocate active change into dated archive with `archive-evidence.md` in PR 3.
