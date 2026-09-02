# Exempt the contract build-toolchain lockfile from the frozen-contract prefix

## Why

`check-changed-paths.mjs` rejects every path under a `contract.protectedPrefixes`
entry. One of those entries is the bare prefix `contracts/security-audit/`, so the
rule also covers `package-lock.json` — the workspace's dev toolchain (`ajv`,
`ajv-formats`, and their transitive dependencies), which is not contract content.

The consequence is that the contract workspace cannot accept a dependency security
patch by any route. Bumping the lockfile, adding an `overrides` block, and bumping
`ajv` itself all land under the frozen prefix. On 2026-09-02 the `fast-uri`
advisories GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf and
GHSA-jqff-g426-hqxp made that latent defect load-bearing: two required checks became
mutually unsatisfiable.

| Required check | Demands | On the contract lockfile |
| --- | --- | --- |
| `contract` | `npm audit --audit-level=high` clean | must be bumped |
| `sdk` — `test:changed-paths` | nothing under the prefix may differ from baseline | must not change |

No repository commit caused this. The same lockfile passed `contract` at 16:21:34Z and
failed it at 16:40:01Z; the advisory database moved, not the code. Because the gate
diffs against a fixed baseline commit, the remediation could not land even once — it
would fail every later pull request, not only the one introducing it.

## What Changes

- `verification-lifecycle.json` gains `contract.toolchainExemptions`, listing exactly
  `contracts/security-audit/package-lock.json`.
- `check-changed-paths.mjs` honours that list at the protected-prefix rule, and
  validates every entry so the exemption cannot reach normative content: an entry must
  be an exact file path, must sit inside a protected prefix, and must be absent from
  every path `contract-provenance.json` declares.
- Both workspace lockfiles move `fast-uri` 3.1.5 to 3.1.7 via
  `npm audit fix --package-lock-only`, leaving both manifests untouched.

## Impact

The prefix keeps protecting everything it protected before except one named file. The
canonical event contract keeps its dedicated enforcement in
`check-contract-immutability.mjs`, which diffs the file list declared in
`contract-provenance.json` against the contract's own baseline and does not consult
this prefix. That gate passes with the contract lockfile modified, because the lockfile
was never contract content.

No manifest changes; `dependencies`, `peerDependencies` and `optionalDependencies` stay
empty, and `fast-uri` stays `dev: true`. Reinstalling the contract workspace on 3.1.7
and re-running `npm run generate` reproduces every generated contract artifact
byte-identically.
