## Why

The repository has no root command surface. Because the ratified standalone package topology forbids a root `package.json`, workspace manifest, or root `engines` field, every workspace command requires a remembered `--prefix <workspace>` argument, and nothing at the repository root indicates which command a developer should reach for. Without a root surface, developers and agents default to running the full ~291s governance-gate chain or guess at per-package invocations. Introducing a non-npm root command surface (`Makefile`) provides discoverability and immediate execution of the ~18s product test loop across all three workspaces as the default target, while making the full governance-gate chain reachable under a target that states its runtime cost upfront.

## What Changes

- Introduce a root `Makefile` compatible with GNU Make 3.81 with no external plugins or flags:
  - Default bare invocation (`make` or `make test`) runs the fast product test loop across all three workspaces (`npm run test:matrix --prefix packages/security-audit-sdk-core`, `npm run validate --prefix contracts/security-audit`, `npm run lint --prefix research/browser-telemetry && npm test --prefix research/browser-telemetry`).
  - Target `runtime-gates` provides an alias for the product test loop.
  - Target `governance-gates` runs the full validation chain across workspaces, stating its ~291s runtime cost before running.
  - Partial runs (such as per-workspace targets `sdk`, `contract`, `research`) report what ran and explicitly name what was not run, never reporting an unqualified pass.
  - Every target delegates directly to existing workspace scripts; no gate is redefined.
- Classify `Makefile` as `governance_core` in `openspec/governance/design-pattern-policy.json` in the same commit to satisfy R26 `path-classification-incomplete`.
- Promote the ratified gate vocabulary (**runtime gates**, **repository-level gates**, **product test loop**, and **governance-gate chain**) from ADR 0011 prose into `openspec/CONTEXT.md`.
- Update repository developer instructions in `AGENTS.md` and `CLAUDE.md` to reference the root `make` command surface.

## Capabilities

### New Capabilities

### Modified Capabilities
- `ci-topology`: adds requirement that the repository provides a root command surface dispatching the product test loop as the default target, stating the cost before governance chains run, and requiring partial runs to identify what was not executed.

## Impact

- Root repository files: adds `Makefile`.
- Governance configuration: `openspec/governance/design-pattern-policy.json` covers `Makefile` under `governance_core`.
- Governance glossary: `openspec/CONTEXT.md` defines the ratified gate vocabulary.
- Developer instructions: `CLAUDE.md` and `AGENTS.md` mention `make` commands.
- Compatibility: fully compatible with macOS default GNU Make 3.81.
