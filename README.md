# Bloodtrail

A **contract-bound security audit event system**: one canonical event contract, plus a
framework-independent TypeScript SDK core that constructs and validates events conforming to it.

Personal open-source project by Fernando Homem da Costa (`nandohdc`). The repository is private
and unlicensed for distribution.

> The contract is the product. The SDK is a *projection* of the contract — its types, constants,
> event catalog, and validator are generated from `contracts/security-audit/source/contract.source.json`
> and are never hand-edited.

[![codecov](https://codecov.io/github/nandohdc/bloodtrail/badge.svg?token=69XU6630UD)](https://app.codecov.io/github/nandohdc/bloodtrail)
[![codecov sdk](https://codecov.io/github/nandohdc/bloodtrail/badge.svg?token=69XU6630UD&flag=sdk)](https://app.codecov.io/github/nandohdc/bloodtrail/flags/sdk)
[![codecov research](https://codecov.io/github/nandohdc/bloodtrail/badge.svg?token=69XU6630UD&flag=research)](https://app.codecov.io/github/nandohdc/bloodtrail/flags/research)


[![DeepScan grade](https://deepscan.io/api/teams/30383/projects/32220/branches/1053344/badge/grade.svg?token=a1fa0980263b30233c0ddf1e9c3ed778290db2ee)](https://deepscan.io/dashboard#view=project&tid=30383&pid=32220&bid=1053344)


[![CodeScene general](https://codescene.io/images/analyzed-by-codescene-badge.svg)](https://codescene.io/projects/83349)
[![CodeScene Average Code Health](https://codescene.io/projects/83349/status-badges/average-code-health)](https://codescene.io/projects/83349)
[![CodeScene Hotspot Code Health](https://codescene.io/projects/83349/status-badges/hotspot-code-health)](https://codescene.io/projects/83349)
[![CodeScene Missed Goals](https://codescene.io/projects/83349/status-badges/missed-goals)](https://codescene.io/projects/83349)
[![CodeScene System Mastery](https://codescene.io/projects/83349/status-badges/system-mastery)](https://codescene.io/projects/83349)


[![Quality Gate Status](https://sonarqube-local.homemdacosta.com/api/project_badges/measure?project=nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74&metric=alert_status&token=sqb_59fb1df39deb9c5cc4d7b0af16b34216414b9db2)](https://sonarqube-local.homemdacosta.com/dashboard?id=nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74)
[![Reliability Issues](https://sonarqube-local.homemdacosta.com/api/project_badges/measure?project=nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74&metric=software_quality_reliability_issues&token=sqb_59fb1df39deb9c5cc4d7b0af16b34216414b9db2)](https://sonarqube-local.homemdacosta.com/dashboard?id=nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74)
[![Maintainability Issues](https://sonarqube-local.homemdacosta.com/api/project_badges/measure?project=nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74&metric=software_quality_maintainability_issues&token=sqb_59fb1df39deb9c5cc4d7b0af16b34216414b9db2)](https://sonarqube-local.homemdacosta.com/dashboard?id=nandohdc_bloodtrail_e3ef77af-1937-442c-b4f1-4fea5eeada74)


## Authorization boundary

**Read this before proposing work.** The SDK is an **isolated technical candidate**. Its
existence does not authorize:

- production deployment or production event collection;
- processing real-user data;
- application or framework instrumentation;
- production transports, exporters, collectors, queues, outboxes, storage, or SIEM integration;
- analytics, detection, browser telemetry, or cryptographic audit-log chaining.

Only a transport-neutral sink interface and non-production test sinks exist. None of the above
may be added as an incidental part of another change — each requires a separate OpenSpec change
and explicit authorization. The boundary and platform coupling policy are mechanically enforced by
`npm run test:scope --prefix packages/security-audit-sdk-core`, not merely documented.

Cutting a `vX.Y.Z` tag does **not** lift this boundary, and the package is never published to a
registry. See [`RELEASING.md`](RELEASING.md).

## Canonical boundary

**Bloodtrail is canonical.** Every other standard is subordinate and single-purpose:

| Standard | Role |
|---|---|
| OCSF 1.8.0 | export-only |
| OpenTelemetry 1.59.0 / Semantic Conventions 1.43.0 | transport-only |
| CloudEvents 1.0.2 | optional envelope-only |

No external standard may redefine a Bloodtrail event's identity, actor, tenancy, resource
ownership, authorization decision, outcome, delivery class, or schema version.

## Layout

There is **no root `package.json`** — every workspace is standalone. Always run npm scripts with
`--prefix` or from inside the package directory, or use the root `Makefile`, which runs every
declared workspace. `.github/scripts/check-package-discovery.mjs` asserts that the declared package
list matches what is on disk **and** that every covering `make` target actually invokes each one.

| Path | What it is | Status |
|---|---|---|
| `contracts/security-audit/` | The canonical contract, version `2.1.0`. `source/contract.source.json` is the **single source of truth**; `catalog/`, `registries/`, `policies/`, `docs/`, `adr/` are **generated — never hand-edit**. | Frozen |
| `packages/security-audit-sdk-core/` | [`@bloodtrail/security-audit-sdk-core`](packages/security-audit-sdk-core/README.md) — platform-neutral ESM TypeScript SDK core. Private, unpublished, unlicensed for distribution. | Isolated candidate, API frozen |
| `packages/security-audit-sdk-node/` | `@bloodtrail/security-audit-sdk-node` — the Node binding: platform SPI implementations plus the HTTP delivery handoff, bounded retry, bounded backpressure, deadline-bounded shutdown, and the governed delivery classes. | Isolated candidate, API frozen |
| `packages/security-audit-collector/` | `@bloodtrail/security-audit-collector` — the synthetic collector ingress. Acceptance is admission only; no storage exists. | Isolated candidate, non-production |
| `openspec/` | Spec-driven change management. `specs/` holds current capability specs; `changes/` holds in-flight proposals; `changes/archive/` holds completed ones. | Active |
| `research/browser-telemetry/` | Isolated investigation. Research artifacts, **not** shipping code. | Investigation |

## SDK core at a glance

- 24 named event methods, derived from the canonical catalog — names, categories, actions,
  lifecycle constraints, and minimum delivery classes all come from the contract.
- Four delivery classes: `best_effort`, `security_significant`, `transaction_critical`,
  `policy_critical`.
- **Zero runtime dependencies.** ESM only, with a standalone CommonJS validator.
- Node.js `24` or `26` only (`>=24 <25 || >=26 <27`); verification pins `24.2.0` and `26.5.0`.
  TypeScript `>=5.9.2 <6`; verification uses exactly `5.9.2`.
- Runtime-branded authority constructors, `AsyncLocalStorage` context scopes, transaction-aware
  operation state, prohibited-data scanning, and a transport-neutral sink boundary.

Consumer documentation: [API reference](packages/security-audit-sdk-core/API.md) ·
[trust boundaries and misuse guidance](packages/security-audit-sdk-core/SECURITY.md) ·
[compatibility policy](packages/security-audit-sdk-core/MIGRATION.md).

## Validation gates

```bash
# SDK — full chain (20 gates: generate, check:generated, typecheck, build, runtime, types,
# examples, exports, compatibility, contract-immutability, scope, publication-path,
# dependencies, package, changed-paths, governance-history, archive-attestations,
# coherence, verification, git)
npm run validate --prefix packages/security-audit-sdk-core

# SDK — build + cross-cutting matrix, no git/package/coherence gates.
# This is the matrix-safe target: use it when running across Node majors.
npm run test:matrix --prefix packages/security-audit-sdk-core

# Contract — regenerate check + contract tests
npm run validate --prefix contracts/security-audit
```

Targeted gates worth knowing (all `--prefix packages/security-audit-sdk-core`):

| Script | Enforces |
|---|---|
| `check:generated` | `src/generated/` matches the contract; regenerate with `npm run generate` |
| `test:contract-immutability` | the frozen contract was not mutated |
| `test:compatibility` | `compatibility.json` still holds, including the pinned toolchain |
| `test:scope` | no out-of-scope surface crept in (the authorization boundary above, forbidden filenames, imports, exports, and undeclared platform coupling) |
| `test:publication-path` | nothing in tracked content can publish the package: no manifest script, automation file, local action a workflow references, `.npmrc`, `publishConfig`, or non-private manifest. The gate forbids the capability across the scanned surface rather than tracing shell reachability, and fails closed on referenced content it cannot read |
| `test:governance-history` | the Git properties a governance record asserts: declared merge commits have their expected parent count, bound commits remain ancestors of `HEAD`, governed commits still resolve, and each reviewed path resolves to exactly the content object the record declares |
| `test:archive-attestations` | every declared archive-movement attestation, and the archive itself, match the commit history shows introduced that archive — so an archived file rewritten together with its recorded object is detected |
| `test:coherence` | package identity, version, and consumer docs agree |
| `test:verification` | the mutation/evidence suite in `tests/verification/` |
| `test:changed-paths` / `test:git` | staged scope and git state are clean |

Generated code (`src/generated/contract.generated.ts`) is derived from the contract — change the
contract source and regenerate, never edit the output.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull request. The checks marked
**required** are enforced by branch protection and must pass to merge; the rest report but do not
block.

| Check | Required | Covers |
|---|---|---|
| `ci / lint`, `ci / test`, `ci / audit` | yes | `research/browser-telemetry`, via the reusable `nandohdc/gh-pipelines` Node workflow |
| `sdk` | yes | `packages/security-audit-sdk-core`, `packages/security-audit-sdk-node`, and `packages/security-audit-collector` — `check:generated` then the full `validate` chain per package, `npm audit --audit-level=low` |
| `contract` | yes | `contracts/security-audit` — `validate`, `npm audit --audit-level=high` |
| `sonar` | yes | repository-wide SonarQube scan and blocking quality gate |
| `conventional-commits` | yes | the PR title and **every** commit subject in the PR |
| `coverage` | yes | line coverage for every code workspace — sdk-core, sdk-node, collector, and research — uploaded for the Sonar scan |
| `codescene delta` | yes | behavioral code health delta — `cs delta --error-on-warnings` against the PR target. Fails on newly introduced code health issues **in the functions its TypeScript analyser can parse** (see the caveat below); a CodeScene outage or licence problem warns instead of failing |
| `design-pattern-governance` | yes | the governance checker at `--phase final`, the trusted-baseline and candidate dual check, and `openspec/tests/design-pattern-governance/` — a candidate checker is never the sole judge of whether it weakened itself |

CodeScene additionally posts a `CodeScene Code Health Review (<base branch>)` Check Run from its own GitHub App, with line-level annotations and per-path quality profiles from
[`.codescene/custom-quality-gates.json`](.codescene/custom-quality-gates.json). It is **not** required to merge — its context name varies by base branch, and a required check that fails to post would block merges with no override.

> **Caveat — CodeScene is not exhaustive for TypeScript.** CLI 1.0.37 silently skips any function whose parameter list uses the `readonly` type modifier (`tags: readonly string[]`, `{ readonly capacity?: number }`). Such a function is never scored and never reaches the gate, so it can carry any amount of complexity while the check stays green. The equivalent `ReadonlyArray<T>` spelling is analysed normally, and `readonly` inside an interface is unaffected. SonarQube does flag this code, so treat the two analysers as complementary rather than redundant. Evidence and the reproduction are in the OpenSpec change's design notes.

`release-please` runs on pushes to `main` to maintain the Release PR. It is not a pull-request
context and is not required to merge — see [`RELEASING.md`](RELEASING.md).

## Contributing and governance

Changes go through **OpenSpec**, not straight to code. Start at [`CONTRIBUTING.md`](CONTRIBUTING.md),
which covers the workflow, the commit conventions, and the two branch-mechanics rules this
repository has actually been bitten by.

- [`CHANGELOG.md`](CHANGELOG.md) — maintained by Release Please from Conventional Commits.
- [`RELEASING.md`](RELEASING.md) — the release runbook and what a Bloodtrail release is *not*.
- [`SECURITY.md`](SECURITY.md) — how to report a vulnerability.
- `.hermes.md` — the working agreement for agent-assisted sessions.

## License

None. This repository is private and the SDK package is `UNLICENSED`; no distribution,
publication, or production use is authorized.
