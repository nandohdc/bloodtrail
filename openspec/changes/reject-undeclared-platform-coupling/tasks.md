## 1. Mutation Controls

- [x] 1.1 Add a package-copy harness with an unmutated null control that runs the real scope gate and passes, reporting the declared inventory per role.
- [x] 1.2 Add M-71-A authored global mutation (`process.env.X`) failing closed with `[platform-coupling:undeclared-global]` naming the artifact and `process`.
- [x] 1.3 Add M-71-B evasion mutation (`globalThis["fe" + "tch"](u)`) failing closed with `[platform-coupling:undeclared-global]` naming `globalThis`.
- [x] 1.4 Add M-71-C generated global mutation (`Buffer.byteLength` in `schema-validator.generated.cjs`) failing closed for role-unauthorized global.
- [x] 1.5 Add M-71-D generated specifier mutation (`require(...)` in `schema-validator.generated.cjs`) failing closed with `[platform-coupling:undeclared-specifier]`.
- [x] 1.6 Add M-71-E negative control with a function parameter named `process` and block-scoped `Buffer` passing at exit 0.
- [x] 1.7 Add M-71-F negative control with type-position utility types and `Uint8Array` passing at exit 0.
- [x] 1.8 Add M-71-G and M-71-H fail-closed mutation arms for unparseable artifact, unreadable artifact, and empty inspection set.
- [x] 1.9 Add M-71-I distinguishability mutation (`src/transport.ts`) proving existing production-integration diagnostic is emitted without coupling codes.
- [x] 1.10 Assert bounding, escaping, and source-marker absence across all failing mutation arms.
- [x] 1.11 Add M-71-J, M-71-K, and M-71-L loop-header arms (for-of expression, for-statement condition, dynamic import inside a header) failing closed, proving the header is inspected and not only the loop body.
- [x] 1.12 Add M-71-M and M-71-N arms for a destructuring default and a computed method name failing closed, with M-71-S negative control proving defaults built from language globals still pass.
- [x] 1.13 Add M-71-O and M-71-P dynamic-evaluation evasion arms (`Function("return pro" + "cess")()`, `eval("process")`) failing closed alongside the existing `globalThis` arm.
- [x] 1.14 Add M-71-Q and M-71-R structural arms for an unreadable source directory and a symlinked source entry, skipping M-71-H/M-71-Q when mode bits do not deny the running user.

## 2. Platform Coupling Policy and Scope Gate Integration

- [x] 2.1 Create `packages/security-audit-sdk-core/scripts/platform-coupling-policy.mjs` defining frozen `PLATFORM_COUPLING_POLICY` for `authored` and `generated` roles.
- [x] 2.2 Implement AST-based reference collector `collectCouplingReferences` with lexical scope tracking, type-position skipping, and property-position skipping.
- [x] 2.3 Implement `inspectPlatformCoupling` walking all runtime code artifacts, classifying references, and generating sorted violations.
- [x] 2.4 Integrate coupling inspection into `packages/security-audit-sdk-core/scripts/check-scope.mjs` while preserving legacy rules and reporting coupling inventory.
- [x] 2.5 Run null control, negative controls, and positive mutations against the wired scope gate and prove deterministic pass/fail signals.
- [x] 2.6 Harden the reference collector across loop headers, binding-pattern defaults and computed binding keys, computed member names, and decorator expressions, and withdraw `eval`/`Function` from the admitted language globals.
- [x] 2.7 Fail closed on an unreadable source directory (`directory-read-failure`) and a non-regular source entry (`unsupported-entry`), and walk the source tree once, sharing it between the legacy and coupling stages.
- [x] 2.8 Prove every added arm fails on the pre-hardening gate and passes on the hardened gate, so no control passes for the wrong reason.

## 3. Documentation and Verification

- [x] 3.1 Append platform coupling domain terms to `packages/security-audit-sdk-core/CONTEXT.md`.
- [x] 3.2 Add root ADR `docs/adr/0004-declare-platform-coupling-at-the-scope-gate.md` recording AST inspection, role-keyed policy data, and retention of `Buffer`.
- [x] 3.3 Update `CLAUDE.md`, `.hermes.md`, and repository `README.md` to reflect platform coupling enforcement in the scope gate.
- [x] 3.4 Run full verification chains (SDK, contract, OpenSpec strict, governance) and code review with an empty index.
- [ ] 3.5 Commit and push verified implementation candidate for PR 1.

## 4. Canonical Spec Fold and Archive

- [ ] 4.1 Fold ADDED requirement into canonical `openspec/specs/security-audit-sdk-core/spec.md` in PR 2 while change is active.
- [ ] 4.2 Close issue #71 with comprehensive evidence linking PR merges and matrix verification.
- [ ] 4.3 Relocate active change into dated archive with `archive-evidence.md` in PR 3.
