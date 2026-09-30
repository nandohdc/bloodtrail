## Context

See `proposal.md`. The contract workspace declares AJV and AJV Formats as development dependencies.
`tests/contract.test.mjs` uses them to validate the contract's fixtures against its generated schema; the
generator itself does not load AJV. The lockfile pins `fast-uri` 3.1.7. The
frozen-contract rule in sdk-core's `test:changed-paths` exempts exactly this lockfile through
`contract.toolchainExemptions`, and `test:contract-immutability` binds every path
`contract-provenance.json` declares without consulting that list.

## Goals / Non-Goals

**Goals:**

- Resolve `fast-uri` to 3.1.8 within AJV's existing range, in the contract workspace.
- Keep the diff to the one lockfile entry, byte-identical to Dependabot's #676.

**Non-Goals:**

- Changing any contract source, generated artifact, schema, fixture or version.
- Changing AJV, AJV Formats or any direct dependency declaration.
- Changing the `contract` check's audit level.

## Decisions

### Refresh only the transitive lockfile entry, in a governed change

`npm audit fix --package-lock-only` rewrites the entry's version, registry URL and integrity, and nothing
else.

Rejected:

- **Merging #676 as it stands.** Its range carries a governed path that no change owns, so
  `design-pattern-governance` fails closed. Adding a change to #676's branch would put the assessment after
  the implementation commit.
- **Leaving 3.1.7 in place because the `contract` check audits at `high`.** It is green, but the advisory
  applies to the toolchain that validates the contract's fixtures, and the patched release is a drop-in
  within AJV's range.

### Reuse the contract exactly

The contract reuse record declares `reuse` of `security-audit@2.1.0`. It extends nothing and introduces no
contract, because the lockfile is build tooling and not contract content.

### Prove the generated artifacts do not move

- `npm ci` installs the new lockfile.
- `npm run check:generated` regenerates every contract artifact and compares it byte-for-byte.
- `npm run validate` runs the contract validator and its tests, which load AJV and so `fast-uri`.
- The audit exercises both the `contract` check's `high` level and `low`.

## Risks / Trade-offs

- **3.1.8 changes URI handling that AJV uses in the contract tests.** `npm run validate` runs those tests
  on 3.1.8, including the negative fixtures, and `check:generated` shows the generator output is
  unaffected.
- **Dependabot keeps #676 open.** Dependabot normally closes its own pull request once `main` carries 3.1.8; otherwise it is closed by hand as superseded.

## Migration Plan

Merge the lockfile refresh. Rolling back reintroduces a known advisory.
