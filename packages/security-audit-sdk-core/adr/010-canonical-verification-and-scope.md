# ADR-SDK-010: One clean repository verification entry point and exact scope boundary

## Status

Implemented for Pass 3 technical closure; governance decisions remain pending.

## Context

Separate npm scripts are useful during development but can accidentally reuse stale output, omit repository-level checks, or validate a wider change than the isolated SDK proposal authorizes. Package dry-run evidence must also be intentional rather than inferred from the `files` array alone.

## Decision

1. `npm run verify` is the canonical all-in-one repository entry point.
2. It checks prerequisites, removes `node_modules` and disposable outputs, runs exact `npm ci`, rejects pre-existing generated drift, regenerates and rechecks, then executes type/build/test/example/export/compatibility/contract/scope/dependency/audit/package/path/coherence/OpenSpec/Git checks in deterministic order.
3. The command requires a supported current Node runtime. Exact Node `24.2.0` and `26.5.0` matrix runs remain independent evidence using `npm run test:matrix` after a clean exact install.
4. Lifecycle metadata defines explicit `active`, `governed`, and `archived` modes. Auto-selection is accepted only when active-path/archive cardinality makes the result deterministic. The original SDK change is selected explicitly as immutable archived evidence.
5. Changed paths are measured from remediation proposal commit `b4206f92fc92c7355efaa80d9f878353cf794452`, preserve rename/deletion visibility, and classify only security-sensitive ownership boundaries as enforceable scope. Unrelated repository history is reported but does not become SDK-owned.
6. Active remediation changes may touch `packages/security-audit-sdk-core/` and `openspec/changes/remediate-security-audit-sdk-adversarial-review/`; canonical contract paths, original archived SDK governance, premature capability/archive paths, untracked SDK source, and forbidden integration paths fail. Standard Git-ignored local files are excluded.
7. Governed mode additionally requires exact technical/owner bindings and can compare the package against `SDK_VERIFICATION_REVIEW_TARGET`; archived mode requires active absence, one dated archive, complete tasks, canonical capability equivalence, and retained production/publication restrictions.
8. A separate source/import/dependency scope check rejects production integrations inside an otherwise allowed package path.
9. `npm pack --dry-run --json` is parsed against a strict package allowlist. Source, tests, scripts, ADRs, governance, contract sources, caches, local paths, and machine-specific evidence are excluded.
10. Differential mutation tests run only in disposable clones and prove both acceptance and rejection cases without editing governed files.
11. Scope token matching treats `/`, `.`, `_`, and `-` as lexical boundaries on both sides. Exact root and nested forbidden names fail with repository-relative diagnostics; boundary-free benign substrings remain allowed.
12. `SecurityAuditSdkImpl implements SecurityAuditSdk`, and the factory returns the frozen instance without a public-interface assertion. Source typecheck therefore rejects deleted or renamed required members independently of runtime tests.
13. Compatibility verification constructs an SDK and checks every nonzero generated descriptor against the concrete callable surface, including duplicate event/method names, one-to-one catalog correspondence, normal receiver invocation, lifecycle/context/operation methods, and frozen-instance policy. It does not infer completeness only from the expected count.
14. Mutations separately prove F-06 path failures, missing/renamed compile-time members, missing/duplicate generated descriptors, and non-callable concrete methods. Fixture clones use isolated Git identity and are removed after execution.
15. Verification requires an empty Git index and never stages or commits.

## Consequences

- Running the canonical command is intentionally destructive to local disposable package state and may need network access for `npm ci`/audit.
- A path under the package is necessary but not sufficient: production/framework/transport/browser functionality still fails scope checks.
- Active, governed, and archived verification remain usable without weakening the contract, scope, exact-commit, production, or publication boundaries.
- This verification-only correction has no SDK runtime API or contract `1.0.0` compatibility impact.
- Passing does not record owner review, release approval, merge approval, archive approval, or production authorization.
