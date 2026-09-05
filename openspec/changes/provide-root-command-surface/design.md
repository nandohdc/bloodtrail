## Context

The repository adheres to a standalone package topology (ADR 0009), forbidding a root `package.json`, workspace manifest, or root `engines` field. ADR 0011 ratified the gate split between runtime gates (executed per matrix leg in the ~18s product loop) and repository-level gates (executed once per change in the ~291s governance chain).

The host toolchain is GNU Make 3.81 (the default on macOS) with no `gmake` installed: no `.ONESHELL`, no `.RECIPEPREFIX`, and no `--output-sync`.

Any new tracked root file must be classified in `openspec/governance/design-pattern-policy.json` in the same commit to satisfy R26 `path-classification-incomplete`. Root entry points and tooling configuration files belong in `governance_core`.

## Goals / Non-Goals

**Goals:**
- Provide a discoverable root `Makefile` compatible with GNU Make 3.81.
- Bare invocation (`make` or `make test`) executes the fast product test loop across all three workspaces.
- Provide `governance-gates` target that states its estimated cost (~291s) before executing.
- Provide per-workspace targets (`sdk`, `contract`, `research`) that explicitly name what ran and what did not run, avoiding unqualified pass reporting.
- Classify `Makefile` as `governance_core` in `openspec/governance/design-pattern-policy.json`.
- Promote the ratified gate vocabulary (**runtime gates**, **repository-level gates**, **product test loop**, **governance-gate chain**) into `openspec/CONTEXT.md`.

**Non-Goals:**
- Introducing a root `package.json` or workspace manifest (violates ADR 0009).
- Redefining gate commands or duplicating script logic inside the Makefile.
- Relying on GNU Make 4+ extensions.

## Decisions

### Decision: GNU Make 3.81 compatible dispatch surface
The root command surface is implemented as a GNU Make 3.81 compatible `Makefile`. The default goal `.DEFAULT_GOAL := test` ensures bare `make` runs the fast product test loop across all three workspaces.
- Alternatives considered: Root shell script (`./run.sh`). Rejected: `make` is the canonical, expected non-npm repository command interface and does not require managing POSIX execution bit flags or shell-dialect quirks.
- Alternatives considered: Root npm package. Rejected: Violates standalone package topology ratified in ADR 0009.

### Decision: Classify Makefile as governance_core
`Makefile` is added to `governance_core` patterns in `openspec/governance/design-pattern-policy.json` in the same commit.
- Alternatives considered: `documentation_only`. Rejected: `Makefile` is an executable command runner, not documentation.

### Decision: Promote gate split vocabulary into openspec/CONTEXT.md
ADR 0011 established the distinction between runtime gates and repository-level gates. Promoting these terms into `openspec/CONTEXT.md` codifies them in the ubiquitous language of repository governance.

## Risks / Trade-offs

- [Make 3.81 output interleaving] → Targets execute sequentially rather than parallelizing, ensuring legible, deterministic output.
- [Future edits require full assessment] → Classifying as `governance_core` means future edits forfeit abbreviated assessment. Mitigated by keeping the Makefile as a stable, thin dispatch surface that only delegates to package scripts.
