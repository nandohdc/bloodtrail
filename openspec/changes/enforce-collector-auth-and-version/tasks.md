## 1. Authorization gate and planning baseline

- [x] 1.1 Record the authorization chain verbatim: the #343 owner decision (AUTHORIZE, bounded scope), the 2026-09-06 away-window merge grant, and the execution-order document's tier-3 ranking of #107; confirm no production authority is claimed.
- [x] 1.2 Confirm the frozen contract bounds block (65536 B / depth 8 / 256 B default strings / 32 elements / extension and retry caps) and the `schema.version` declaration path are read from the canonical contract, not re-stated from memory.
- [x] 1.3 Confirm the generated validator artifact exists at `packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs`, is standalone CJS, and records its byte size and sha256 for the drift gate baseline.
- [x] 1.4 Confirm the ratified version policy's collector-side clause (explicit finite set, MAY migration support, no producer broadening) and the delivery conformance contract's validation-before-admission requirement; record the exact spec paths quoted in the proposal.

## 2. Package scaffolding and vendored validator

- [x] 2.1 Create `packages/security-audit-collector` with its own `package.json` (`private: true`, `UNLICENSED`, `engines >=24 <25 || >=26 <27`, zero runtime dependencies, TypeScript 5.9.2 / @types/node 24.2.0 devDependencies), `package-lock.json`, and `tsconfig.json` / `tsconfig.build.json` / `tsconfig.test.json` mirroring the sdk-node skeleton.
- [x] 2.2 Vendor `schema-validator.generated.cjs` into the package byte-identically and add `scripts/check-validator-drift.mjs` recomputing sha256 identity against the canonical artifact; wire `check:generated-validator` into the validate chain.
- [x] 2.3 Add the package's own `scripts/check-scope.mjs`, `scripts/check-dependencies.mjs`, and `scripts/check-package-contents.mjs` gates mirroring the sdk-node shape, with the collector's closed import/export vocabulary and production-exclusion terms.
- [x] 2.4 Add `scripts/clean.mjs` and the `validate` chain (typecheck → build → test:runtime → scope → dependencies → package-contents → validator drift); verify the chain runs green on the scaffold before any ingress code exists.

## 3. RED — the nine arms

- [x] 3.1 Write the nine test arms as `*.test.ts` under `node:test`: E1 authenticated/bounded/valid/supported accept; E2 missing auth rejected before parse (instrumented); E3 malformed auth rejected before parse; E4 invalid auth rejected before parse; E5 oversized body rejected; E6 schema-invalid rejected with the validator's bounded diagnostic; E7 unsupported version rejected distinctly; E8 diagnostics and counters carry no secrets or payloads; N0 null control (E1 repeated, no diagnostics).
- [x] 3.2 Instrument the parse stage so E2's ordering assertion measures runtime invocation, not code shape (F4); observe the RED state against the unimplemented ingress.

## 4. GREEN — the ingress implementation

- [x] 4.1 Implement the authenticator interface and the single non-production `SyntheticFixtureAuthenticator`; authentication runs first, unconditionally, and fails closed on missing/malformed/invalid material.
- [x] 4.2 Implement the size stage deriving every bound from the frozen contract bounds block; no configurable limit exists.
- [x] 4.3 Implement the parse stage as JSON deserialization only; no semantic judgment outside the generated validator.
- [x] 4.4 Implement the schema stage running the vendored generated validator; rejections project to the bounded `{ code, category, path }` diagnostic.
- [x] 4.5 Implement the version stage enforcing the explicit set `{ "1.0.0" }` against `schema.version`, with a diagnostic distinct from schema rejection.
- [x] 4.6 Implement admission: accept records `admitted` with the occurrence's event identity and consumes capacity; no durability, delivery, retry, or downstream claim is made.
- [x] 4.7 Implement the bounded diagnostics and non-secret counters; verify E8 passes with no payload or credential material in any diagnostic or metric label.
- [x] 4.8 Re-run all nine arms and confirm GREEN; keep stage functions small (context-object options, early returns) to stay under CodeScene delta thresholds.

## 5. Repository integration and verification

- [x] 5.1 Amend `DECLARED_PACKAGES` in `.github/scripts/check-package-discovery.mjs` with `packages/security-audit-collector/package.json` and wire the package into `.github/workflows/ci.yml` (job, cache paths, coverage entry) following the #85 pattern; run the discovery check locally.
- [x] 5.2 Run the full read-only battery with an empty index: package `validate`, contract `validate`, `openspec validate --strict`, design-pattern-governance phases, dual check, and `git diff --check`.
- [x] 5.3 Stage the explicit implementation allowlist only; commit; verify the committed head passes the final governance phase and dual check.

## 6. Delivery, fold, archive, and closure

- [ ] 6.1 Open the implementation PR with the full authorization posture section; merge only when every required CI check is green on the exact head, under the away-window grant, as an identity-preserving 2-parent merge.
- [ ] 6.2 Fold the `security-audit-collector` delta into `openspec/specs/security-audit-collector/spec.md` (canonical header + purpose + requirements, no delta headers) and apply the MODIFIED `repository-topology` requirement in a dedicated fold PR, proving byte-identity of requirement blocks and no-op re-application.
- [ ] 6.3 Archive the change with byte-preserving relocation plus `archive-evidence.md`; verify `openspec validate --all --strict` and staged rename similarity 100%.
- [ ] 6.4 Close #107 with an evidence comment (the nine arms, the ingress order, the statement that authentication identifies a sender and does not prove evidence truth) and tick the #107 line in #132's Wave 4 checklist.

## 7. Governance records and honest boundaries

- [ ] 7.1 Confirm the design-pattern-governance final phase and dual check pass at every committed head; if any gate demands a signed owner decision bound to an exact commit, stop and record the pending state instead of fabricating one.
- [ ] 7.2 Keep all PR bodies stating: AI verification is evidence, not approval; the topology amendment is decision-bearing and awaits owner ratification; no production authority is claimed.
