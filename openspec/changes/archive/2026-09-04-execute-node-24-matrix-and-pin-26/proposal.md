# Proposal: Execute Node 24 Matrix and Pin Node 26.5.0 in CI

## Why

`packages/security-audit-sdk-core/compatibility.json` declares `node.ciVersions: ["24.2.0", "26.5.0"]` and `engines: ">=24 <25 || >=26 <27"`. However, Node 24 is currently executed nowhere in CI or automated gates. A compatibility leg that has never run is not an executable guarantee.

Separately, CI workflow jobs request floating `node-version: "26"`, while `compatibility.json` pins `26.5.0`. Floating `"26"` resolves to the latest 26.x release at runtime, causing CI execution to drift silently from the declared, verified pin without governance authorization.

## What Changes

1. **Pin Node 26.5.0 across CI workflows**: Reconcile floating `"26"` in `.github/workflows/ci.yml` across jobs (`sdk`, `contract`, `design-pattern-governance`, `coverage`, and `ci`) with the pinned `26.5.0` declared in `compatibility.json` and `ci-topology`.
2. **Execute declared Node 24 compatibility leg in CI**: Inside the `sdk` job in `.github/workflows/ci.yml`, run setup-node for `24.2.0` and execute the matrix-safe product loop `npm run test:matrix`, ensuring that breaking changes on the older supported major fail closed.
3. **Verify Node major compatibility failure modes**: Add mutation coverage in `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` confirming that dropping or altering the Node 24 support policy fails the compatibility and coherence controls.

## Capabilities Affected

- `ci-topology`
