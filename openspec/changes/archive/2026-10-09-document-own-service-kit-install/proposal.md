## Why

The evaluation kit currently documents installation only inside the kit directory. That leaves an evaluator
performing M2, which integrates the SDK into an existing service, without a supported and proven way to add
the kit. The quickstart also says to install the complete kit only through its generated `package.json`, which
contradicts that M2 need.

The problem was reproduced with a verification kit at `<root>/kit` and a standalone service at `<root>/svc`.
The service lists both SDK tarballs as `file:../kit/<tarball>` dependencies:

| Install in the service | Result |
| --- | --- |
| npm, with `overrides` pinning the core to its tarball | Exit 0; one core copy; `npm ls --all` exits 0; the lockfile has no nested core. |
| npm, without `overrides` | Exit 0; one core copy at runtime; `npm ls --all` exits 1 with `invalid: "file:../security-audit-sdk-core"`. |
| pnpm 10.17.0, 11.28.2, and 12.8.1, with `overrides` in the service's own `pnpm-workspace.yaml` | Each exits 0; one core copy. |
| The same three, with no pin | Each exits 1 with `ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND`. |
| The same three, with npm's `overrides` in `package.json` only | Each exits 1 because pnpm does not read npm's `overrides`. |

The packed Node binding depends on the core as `file:../security-audit-sdk-core`. npm links that path to the
service's top-level core, so the runtime one-copy probe cannot detect a missing npm pin; only `npm ls` reports
it. The Express guide block was also reproduced with exit 0 in npm-pinned and pnpm-12.8.1-pinned services.

## Governance Metadata

```yaml
security_sensitive: false
capabilities: [security-audit-sdk-node]
modified_requirements: 2
```

## What Changes

- Add a standalone-own-service section to the integration guide with one JSON dependency-and-npm-pin snippet,
  one pnpm YAML pin snippet, and npm and pnpm install commands.
- Point the quickstart and known issues at that section while retaining the rule against installing the Node
  binding on its own.
- Make the kit gate install those guide snippets verbatim in an external own service with npm and pinned pnpm
  10.17.0, 11.28.2, and 12.8.1, requiring a valid npm dependency tree and one loaded core copy.
- Add three planted-defect controls, allow YAML fences, and record the own-service glossary vocabulary.
- Fold the two complete Node-binding requirement replacements only after implementation and the recorded walk.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-node`:
  - MODIFIED *The evaluation kit installs and runs outside any workspace and its gate fails closed*;
  - MODIFIED *Evaluator documentation states the alpha's boundaries and is checked*.

These are exactly two modified existing requirements. The candidate declares only the
`security-audit-sdk-node` capability.

## Impact

The implementation and fold are limited to exactly these repository paths outside this change directory:

- `packages/security-audit-sdk-node/docs/integration-and-testing.md`;
- `packages/security-audit-sdk-node/docs/quickstart.md`;
- `packages/security-audit-sdk-node/docs/known-issues.md`;
- `packages/security-audit-sdk-node/scripts/evaluation-kit-installers.mjs`;
- `packages/security-audit-sdk-node/scripts/evaluation-kit-doc-blocks.mjs`;
- `packages/security-audit-sdk-node/scripts/evaluation-kit-doc-references.mjs`;
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit.mjs`;
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-installer-controls.mjs`;
- `packages/security-audit-sdk-node/scripts/check-evaluation-kit-controls.mjs`;
- `packages/security-audit-sdk-node/CONTEXT.md`;
- `CONTEXT-MAP.md`; and
- `openspec/specs/security-audit-sdk-node/spec.md`.

No package source, export, constructor, validation rule, manifest, builder, contract, CI workflow, or
production integration changes. The archive is a separate pull request after the fold.
