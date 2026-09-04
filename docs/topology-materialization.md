# Topology materialization

Materialization record for GitHub #83: the approved standalone repository and package-manager topology, documented and evidenced. This change performs no restructuring; it records the ratified decision and the four acceptance-criteria evidence arms.

## Materialization record

- **What #83 materialized.** The standalone package topology ratified by ADR 0009 (`docs/adr/0009-repository-and-package-manager-topology.md`, Status: Accepted, 2026-08-23, decision owner: project owner), under the governed OpenSpec change `materialize-repository-topology` (`openspec/changes/materialize-repository-topology/`) against the canonical capability `openspec/specs/repository-topology/spec.md`.
- **Head measured.** `698921c81253ac5ce3d2948d908b20e72b146b26`, the post-proposal-merge `origin/main` (proposal PR #282 merged identity-preserving on top of `101f4e9`).
- **Four-package target** (per ADR 0009): `contracts/security-audit`; `packages/security-audit-sdk-core`; the planned Node binding (#87); `research/browser-telemetry` (stays in this repository). The browser (#124) and React Native (#131) evidence packages are not members of the target set while #117 is undecided.
- **No root manifest.** There is no root `package.json`, no root `package-lock.json`, and no `pnpm-workspace.yaml`; there is no root package and none is introduced. Each package owns its `package.json` and its `package-lock.json` inside its own package directory.

## Workspace inventory

Each current workspace is standalone: package-local install and commands in `--prefix` form (or `cd` into the package directory); no root-level command form exists. Engine ranges are declared per workspace and never reconciled at a root.

| Workspace | Declared `engines` (exact) | Install | Commands |
| --- | --- | --- | --- |
| `contracts/security-audit` | `>=26.5.0` | `npm ci --prefix contracts/security-audit` | `npm run validate --prefix contracts/security-audit` |
| `packages/security-audit-sdk-core` | `>=24 <25 \|\| >=26 <27` | `npm ci --prefix packages/security-audit-sdk-core` | `npm run validate --prefix packages/security-audit-sdk-core`; `npm run test:matrix --prefix packages/security-audit-sdk-core`; `npm run verify --prefix packages/security-audit-sdk-core` |
| `research/browser-telemetry` | `>=26.5.0` | `npm ci --prefix research/browser-telemetry` | `npm run lint --prefix research/browser-telemetry` |

Every command above was verified against the live `package.json` scripts at the measured head: the contract package declares `validate` (`validate-contract.mjs --all` plus contract tests); the SDK package declares `validate` (19 gates), `test:matrix`, and `verify`; the research package declares `lint` (`scripts/check-syntax.mjs`).

## Migration and rollback plan

The plan ADR 0009 deferred to #83 (`Migration and rollback: plan only`), executed here:

- **The standalone baseline needs no migration.** The ratified decision performs no move and this materialization moves nothing; every package keeps its manifest, lockfile, and directory in place.
- **Rollback for any #83 movement** is the revert of #83's own documentary commits — this document and the `repository-topology` spec amendments (proposal, fold, archive) — which restores the prior state with no data or behavior impact. Package state is never touched by #83.
- **A future migration away from the standalone topology** is its own governed change and is not executed here.
- **The packed-install control keeps running outside any workspace root.** `packages/security-audit-sdk-core/scripts/check-package-contents.mjs` with `scripts/packed-completeness.mjs` SHALL keep performing its production-only tarball install (`npm pack`, then `npm install <tarball> --omit=dev --ignore-scripts --offline`) in a clean consumer directory outside any workspace root, and importing every declared entry point there. Stating this is what keeps gate 3 from being silently defeated by any future topology change.

## No-restructuring boundary

- No root `package.json`, no `workspaces` field, no `pnpm-workspace.yaml`, no root lockfile, and no root `engines` field are introduced. Each package retains its own `package.json` and `package-lock.json`.
- No edits to the governance-core files (`CLAUDE.md`, `.hermes.md`, `AGENTS.md`, `CONTRIBUTING.md`); no writes under `contracts/security-audit/`; no new files under `packages/*/src/`; no CI, release, publication, or transport changes. No semantic refactor, `sdk-node`, release configuration, or production integration.
- **Vacuous pinned-constant statement.** ADR 0009 recorded that "moving a pinned constant belongs to #83". For this change the clause is vacuous: the ratified topology performs no move, so no pinned constant moves. `packages/security-audit-sdk-core/scripts/check-coherence.mjs` and `packages/security-audit-sdk-core/compatibility.json` remain unchanged.

## Evidence protocol

The four acceptance-criteria arms of #83, produced and recorded. All runs happened in disposable directories outside the repository, against a disposable clone at the exact measured head `698921c81253ac5ce3d2948d908b20e72b146b26`. Tools: Node `v26.8.1`, npm `11.19.0` (both within every per-workspace `engines` range: the SDK accepts `>=24 <25 || >=26 <27`; the contract and research workspaces accept `>=26.5.0`). Full stdout of every run is kept with the measurement record; only durable summary lines are recorded here.

Issue acceptance-criteria mapping: package discovery → arm (a); per-package lockfile install/validate → arm (b); hoisting does not mask undeclared imports → arm (c); existing contract/SDK validation stays green → arm (d).

### Arm (a) — clean-clone discovery

A fresh disposable `git clone` of `nandohdc/bloodtrail` at the exact head, with no root install step. Assertions and results:

| Check | Result |
| --- | --- |
| clone `HEAD` equals the measured head | `698921c81253ac5ce3d2948d908b20e72b146b26` |
| root `package.json` | absent (expected — no root install step exists) |
| root `package-lock.json` | absent (expected) |
| root `pnpm-workspace.yaml` | absent (expected) |
| package discovery by package directories and manifests | `contracts/security-audit`, `packages/security-audit-sdk-core`, `research/browser-telemetry` all discovered standalone |

Per-package clean install and validation in the clone (exit codes recorded):

| Workspace | Command | Exit |
| --- | --- | --- |
| `packages/security-audit-sdk-core` | `npm ci` then `npm run validate --prefix packages/security-audit-sdk-core` | 0 |
| `contracts/security-audit` | `npm ci` then `npm run validate --prefix contracts/security-audit` | 0 |
| `research/browser-telemetry` | `npm ci` then `npm run lint --prefix research/browser-telemetry` | 0 |

### Arm (b) — per-package lockfile install and validation

Each package's `npm ci` resolved from its own `package-lock.json`, with no root lockfile or root resolution involved (there is no root manifest). Lockfile assertion results:

| Lockfile | Present | `npm ci` resolved from it |
| --- | --- | --- |
| `contracts/security-audit/package-lock.json` | yes | yes (exit 0) |
| `packages/security-audit-sdk-core/package-lock.json` | yes | yes (exit 0) |
| `research/browser-telemetry/package-lock.json` | yes | yes (exit 0) |

### Arm (c) — hoisting does not mask undeclared imports

The packed-install control, unchanged, was exercised against a disposable copy of the SDK package extracted at the exact head (contract fixtures alongside, matching the control's fixture path). Only the disposable copy was mutated — never the repository and never the gate. The control's pack and consumer roots are temporary directories outside any workspace root by the control's own design.

| Step | Result |
| --- | --- |
| disposable copy `npm ci` + `npm run build` (unmutated) | exit 0 |
| **Null control** — `npm run test:package` on the unmutated copy | **exit 0** — key line: `packed artifact completeness passed: 84 intentional files, 862198 bytes, 2 entry points imported, no tests/source/scripts/governance/contract copies` |
| **Mutation** — undeclared runtime import `import { value } from "@bloodtrail-undeclared-probe/x"` injected into `src/index.ts` (the packaged entry point) of the disposable copy | development visibility: the standalone layout has no hoisting root to mask the import, so the recompile already fails — `error TS2307: Cannot find module '@bloodtrail-undeclared-probe/x' or its corresponding type declarations.` (tsc exit 2, emit proceeds) |
| **Mutation arm** — `npm run test:package` on the mutated copy | **exit 1** — key line: `[packed-completeness:entry-point-import] entry point @bloodtrail/security-audit-sdk-core: Error: Cannot find package '@bloodtrail-undeclared-probe/x' imported from .../node_modules/@bloodtrail/security-audit-sdk-core/dist/index.js` |

A direct probe of the mutated entry point in the disposable copy confirms the underlying diagnostic: `error.code = ERR_MODULE_NOT_FOUND` with the message `Cannot find package '@bloodtrail-undeclared-probe/x'`. The production-only packed consumer therefore detects the undeclared runtime import at entry-point import with exit 1 and `ERR_MODULE_NOT_FOUND` naming the probe, while the null control passes — the mutation-specific failure is not harness noise. The development-masking behavior under workspace-root hoisting was measured in ADR 0009's prototype and is cited there; this arm re-verifies the surviving gate at the materialization head. The control was not relocated: pack and consumer roots remained temporary directories outside any workspace root, as its recorded temporary-paths line shows.

### Arm (d) — existing validation stays green

Baseline: the arm (a) contract and SDK `validate` outputs at the measured head (both exit 0). Post: the same `validate` commands re-run in a second disposable clone at a head whose sole tree delta versus the measured head is this document (the implementation head: `698921c…` plus exactly `docs/topology-materialization.md`).

Recorded output diff, every difference explained:

- Contract `validate` (`npm run validate --prefix contracts/security-audit`): exit 0. Output identical to baseline apart from test-duration values, which are timing noise and carry no semantic content.
- SDK `validate` (`npm run validate --prefix packages/security-audit-sdk-core`): exit 0. Output identical to baseline apart from three explained classes: (1) test-duration values — timing noise; (2) the packed-completeness control's per-run `temporary-paths` lines — the control reports its own disposable pack and consumer directories, whose random suffixes differ by design on every run; (3) exactly one structural line — the changed-path gate's visible-record count, which gains exactly one `unrelated-history-or-worktree` record for this documentation file itself (the gate counts the file it validates: `543` → `544` visible records, `unrelated-history-or-worktree` `444` → `445`). Every code-path gate output is unchanged; no gate reading contract, SDK, or governance content changed its output.


## Revisit conditions

Per ADR 0009, the standalone ratification is re-opened when either condition occurs: **#117 returns GO** (declared six-package target), or **any target package acquires a third-party runtime dependency that another target package also needs**. When neither condition holds, the standalone ratification remains the recorded topology.
