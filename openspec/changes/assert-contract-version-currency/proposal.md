## Why

#95 moved the canonical contract from `1.0.0` to `1.1.0`. Eleven statements across the repository
still describe present behaviour as though it had not, and the gate that is supposed to hold consumer
documentation to the current version cannot see any of them (#453).

The issue named three. Enumerating the whole scan set before writing a fix found **eleven**, and two
of the additions change the shape of the problem:

| Where | What it asserts | Named in #453 |
|---|---|---|
| `packages/security-audit-sdk-core/SECURITY.md:90` | the `1.0.0` enrichment namespace is what is accepted | yes |
| `packages/security-audit-sdk-core/adr/008-privacy-extensions.md:12` | only `1.0.0` namespaces are typed and accepted | yes |
| `packages/security-audit-sdk-node/src/delivery-retry.ts:5` | contract `1.0.0` supplies the wire ceiling | yes |
| `packages/security-audit-sdk-node/src/http-handoff.ts:7` | contract `1.0.0` supplies the wire ceiling | no |
| `packages/security-audit-sdk-core/src/sdk.ts:22` | contract `1.0.0` supplies the retry bound | no |
| `packages/security-audit-sdk-core/src/sdk.ts:439` | contract `1.0.0` supplies the retry bound | no |
| `packages/security-audit-collector/README.md:33` | the supported set is `["1.0.0"]` | no |
| `README.md:74` | the canonical contract is version `1.0.0` | no |
| `SECURITY.md:21` | the canonical contract is frozen at version `1.0.0` | no |
| `CLAUDE.md:7` | the canonical contract is version `1.0.0`, frozen | no |
| `CLAUDE.md:23` | the canonical contract is frozen at `1.0.0` | no |

**`packages/security-audit-sdk-core/src/sdk.ts` has been inside the `sonar` scope all along.** #453's
provenance says the Node binding's stale comment survived because that workspace was outside the
analysis scope. That explains how it went *unread*; it does not explain how it went *uncorrected*,
because sdk-core's `src/` carries the same defect twice and has been analysed since before #452. No
analyser reads a comment for a version claim, and no rule in this repository does either.

**`packages/security-audit-collector/README.md:33` is not stale prose but a wrong statement about
running behaviour.** It says the collector's supported set is `["1.0.0"]`. The generated
`SUPPORTED_CONTRACT_VERSIONS` is `["1.1.0"]` and `scripts/check-package-contents.mjs` asserts exactly
that. A reader following the README would conclude a `1.1.0` event is rejected at the version stage
when in fact a `1.0.0` one is.

The gate that was supposed to catch this asserts that the string `contract \`1.1.0\`` appears
*somewhere across all ADRs concatenated*:

```js
rule("adr-contract", "adr", includesAll(allAdrs, [expected.normativeTarget, "contract `1.1.0`"]), …);
```

One ADR mentioning the new version satisfies it while another goes on asserting the old one, and it
says nothing about a superseded version being *absent*. `check-coherence.mjs` is also sdk-core-scoped,
so `packages/security-audit-sdk-node`, `packages/security-audit-collector` and the root documents are
structurally out of its reach. That is why #453's fourth acceptance criterion exists.

## What Changes

- **Correct the eleven current-tense statements** to name `1.1.0`, and nothing else. Every other
  occurrence of `1.0.0` in the scan set is a legitimate historical or policy reference and is left
  exactly as written.
- **Assert it, rather than record a manual step.** `.github/scripts/check-contract-version-currency.mjs`
  fails when a superseded canonical contract version appears anywhere in the scan set without being a
  recorded exception. It derives the current version from
  `contracts/security-audit/source/contract.source.json` — the single source of truth — and the
  superseded set from the `contract` enum in `openspec/governance/schemas/contract-reuse.schema.json`,
  which `CLAUDE.md` already requires to carry every version the repository has had. Neither is
  restated.
- **Discharge "say why each was left" mechanically.** Each legitimate reference is a recorded
  exception carrying its reason, in the checker rather than in prose. The record fails closed in both
  directions: an occurrence matching no exception fails, and an exception matching no occurrence fails,
  so the list cannot outlive what it excuses.
- **Reach the workspaces `check-coherence` cannot.** The checker is repository-level and derives its
  per-package scan roots from `DECLARED_PACKAGES`, so `packages/security-audit-sdk-node` and
  `packages/security-audit-collector` are covered by construction, and a sixth package would be too.
- **Correct the `CLAUDE.md` pin inventory entry** that says consumer docs are "gated by the coherence
  rule `adr-contract`". That gate is weaker than the entry implies; the entry now names the gate that
  actually holds the property.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

`ci-topology` gains one requirement: a superseded canonical contract version may not appear in a
current-tense assertion, asserted mechanically against the canonical source rather than maintained by
hand. It sits beside the package-discovery, root-command-surface and analysis-scope requirements,
which ratify the same property for three other hand-maintained sets. No existing requirement is
modified.

## Impact

- `.github/scripts/check-contract-version-currency.mjs` and its test — `governance_core`; new.
- `.github/workflows/ci.yml` — `governance_core`; one added step in the existing
  `design-pattern-governance` job. No job, threshold, artifact or dependency edge changes.
- `CLAUDE.md`, `README.md`, `SECURITY.md` — `governance_core`; the four root statements and the pin
  inventory entry. **This is not an incidental documentation edit alongside a bounded change**, which
  `CLAUDE.md` forbids: these documents carry four of the eleven defects, and the pin inventory entry
  that misstates the gate is named in #453's own text as the correction being made.
- `packages/security-audit-sdk-core/{SECURITY.md,adr/008-privacy-extensions.md,src/sdk.ts}`,
  `packages/security-audit-sdk-node/src/{delivery-retry.ts,http-handoff.ts}`,
  `packages/security-audit-collector/README.md` — the remaining seven statements. All are comments or
  prose; no runtime behaviour, public API, export, or generated artifact changes.
- `openspec/specs/ci-topology/spec.md` — the fold target for the added requirement.

## Out of scope

**`openspec/specs/**` is not scanned.** The ratified `security-audit-sdk-core` specification contains
many `1.0.0` references, and `check-coherence.mjs` freezes the 2026-07-31 founding requirements
byte-for-byte. They are the historical record of what was ratified, correcting them is a spec delta
rather than a documentation fix, and a gate that demanded it would require the bug (see the same trap
recorded against #424). Its exclusion is recorded with that reason rather than left implicit.

**`contracts/**` is not scanned.** It is a protected prefix that `test:changed-paths` refuses to
write, and `contracts/security-audit/adr/adr-001.md` legitimately records `1.0.0` as the design basis
at Contract Commit A.

**`openspec/changes/archive/**`, `.hermes/plans/**`, `**/tests/**`, `**/examples/**` and
`**/src/generated/**` are not scanned.** Archived changes and agent plans are records of what was true
when written; fixtures and examples use version literals as data; generated output is regenerated from
the contract and never hand-edited.

**Package versions are not covered.** `RELEASING.md` names `0.1.0` for a candidate that is `0.2.0` and
omits two of the five declared workspaces. That is the same defect class one level up and is filed as
#462; folding it in here would mean scanning for package-version literals, which needs its own
derivation and its own exception set.

No contract, generated artifact, public API, export, dependency or threshold changes. The contract
version itself does not move.
