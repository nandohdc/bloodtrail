# Archive Evidence — rescope-portability-and-production-scope-gates

Explicit archive validation record (R24) for the archive relocation of the `rescope-portability-and-production-scope-gates` change into `openspec/changes/archive/2026-09-06-rescope-portability-and-production-scope-gates/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24).

## Task completeness

- **1.1–1.3** (Scope Gate for security-audit-sdk-node) — checked. Implemented `packages/security-audit-sdk-node/scripts/platform-coupling-policy.mjs` declaring the approved built-ins (`node:async_hooks`, `node:buffer`, `node:crypto`, `node:timers`) and the first-party Core dependency (1.1). Implemented `packages/security-audit-sdk-node/scripts/check-scope.mjs` enforcing AST platform coupling and rejecting forbidden production integration surfaces (1.2). Wired `test:scope` into `packages/security-audit-sdk-node/package.json` and its `validate` chain (1.3).
- **2.1–2.2** (Core Platform Neutrality Hardening) — checked. Tightened `packages/security-audit-sdk-core/scripts/shipped-import-policy.mjs` runtime built-ins from `["node:async_hooks", "node:crypto"]` to `[]` (2.1). Updated `packages/security-audit-sdk-core/tests/verification/shipped-import-policy.test.mjs` to assert zero runtime built-ins in shipped artifacts (2.2).
- **3.1–3.2** (Cross-Package Placement Mutations) — checked. Implemented `packages/security-audit-sdk-node/tests/scope-mutations.test.ts` covering approved capabilities, unapproved built-ins, host globals, dynamic evasion, forbidden filenames, and transport/browser placement (3.1). Added cross-package placement mutations to `packages/security-audit-sdk-core/tests/verification/platform-coupling-mutations.test.mjs` proving that moving Node binding code and transport or collector code into Core fails closed (3.2).
- **4.1–4.4** (Verification and Governance) — checked. Ran `validate` for `packages/security-audit-sdk-node` including `test:scope` and `scope-mutations.test.ts` (4.1), `test:matrix` and the verification mutation tests for `packages/security-audit-sdk-core` (4.2), the fast product loop across all four workspaces (4.3), and the governance checker plus dual checker (4.4). Merged in PR #342 at commit `c70d514`.
- **Canonical fold** — checked. Fold PR #344 applied the `## MODIFIED` delta to `openspec/specs/security-audit-sdk-core/spec.md` and the `## ADDED` delta to `openspec/specs/security-audit-sdk-node/spec.md` while the change was still active, at commit `c8de16e`.
- **Archive change** — checked. Byte-preserving archive relocation commit into `openspec/changes/archive/2026-09-06-rescope-portability-and-production-scope-gates/`.
- Issue #88 closed upon implementation and archive completion.

## Lifecycle bindings

| Phase | PR | Merged Commit | Notes |
| --- | --- | --- | --- |
| Proposal | #341 | `0ed4b36` | `docs(openspec): propose rescope-portability-and-production-scope-gates (#88)` |
| Implementation | #342 | `c70d514` | `feat(sdk): rescope portability and production-scope gates (#88)` |
| Canonical fold | #344 | `c8de16e` | `docs(openspec): fold rescope-portability-and-production-scope-gates spec deltas (#88)` |
| Archive | Pending PR | Pending | Byte-preserving archive relocation |

## Canonical capability materialization

Both canonical capability specifications carry this change's requirements, materialized by fold PR #344 at commit `c8de16e`:

- `openspec/specs/security-audit-sdk-core/spec.md` — *Scope verification classifies every platform coupling against a declared policy*, modified so that authored source and shipped runtime artifacts under `dist/` admit zero host built-in module specifiers, with three added scenarios covering shipped-artifact neutrality and cross-package placement.
- `openspec/specs/security-audit-sdk-node/spec.md` — *Scope verification restricts platform coupling to approved Node capabilities and rejects production integration surfaces*, added with nine scenarios.

This archive relocation commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. It does not authorize package publication, production deployment, production collection, or real-user processing.

## Immutable archive contents

Byte-identical from the active change into the archive:

- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `assessment.source.json`
- `design.md`
- `specs/security-audit-sdk-core/spec.md`
- `specs/security-audit-sdk-node/spec.md`
- `tasks.md`

`archive-evidence.md` is added.
