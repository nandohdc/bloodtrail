# Design

## Context

`contract.protectedPrefixes` in `verification-lifecycle.json` freezes the canonical
event contract at version 1.0.0. `check-changed-paths.mjs` enforces it with a prefix
test that runs before any classification or allowance is consulted, so a match is an
unconditional violation.

That prefix is a *proxy* for the invariant, not the invariant itself. The precise gate
is `check-contract-immutability.mjs`, which reads `contract-provenance.json` and diffs
an explicit file list — `source/contract.source.json`, `schema/`, `catalog/`,
`policies/`, `registries/`, both example fixtures, the canonical capability spec and
the archived defining change — against the contract's own baseline `94dc6e3`.
`package-lock.json` is deliberately absent from that list.

So two gates cover the same ground with different precision, and only the blunt one
objects to a toolchain patch.

## Goals / Non-Goals

- **Goal.** Let the contract workspace accept a dependency security patch.
- **Goal.** Make it impossible for the mechanism to be widened to normative content,
  by enforcement rather than by review.
- **Non-Goal.** Relaxing the frozen contract. Every declared contract path stays
  immutable, under both gates.
- **Non-Goal.** Changing what `npm audit` runs, or at which severity, in either job.

## Decisions

### An explicit exemption list, not a narrowed prefix

The alternative was to replace `contracts/security-audit/` with the enumerated
normative subdirectories, which needs no checker change and touches only
`governance_record_only` configuration. It was rejected because it inverts the default:
a path added to the workspace later — a new top-level file, a new directory — would be
unprotected by omission and nothing would report it. The exemption list keeps the
default closed and names the single hole.

### The hole is bounded by the checker, not by convention

`assertToolchainExemptionShape` rejects an entry that is not an exact file path (reusing
`REVIEWED_PATH_RULES`, so directories, globs, traversal, absolute paths, backslashes and
NUL bytes are refused), that sits outside every protected prefix, or that appears in
`contract-provenance.json` — as a declared path or beneath a declared directory.

The third rule is what makes the mechanism safe. `contract-provenance.json` is the same
manifest `check-contract-immutability.mjs` binds, so the set of paths that can never be
exempted is exactly the set that gate protects. Widening the exemption to reach contract
content requires editing that manifest, which fails contract immutability first.

### Why not lower an audit level

`--audit-level=low` in the `sdk` job and `--audit-level=high` in the `contract` job are
the policy, quoted in `DEPENDENCIES.md` above the invocation. Raising a threshold to
clear a live high-severity advisory would silence the finding rather than fix it, and
would leave the workspace on vulnerable code.

### Why not advance the baseline

`test:changed-paths` diffs against `remediation.proposalBaseline`. Advancing it would
clear this violation and simultaneously forgive every other drift accumulated since that
commit, which is strictly worse than naming one file.

## Risks / Trade-offs

- **A future exemption is added carelessly.** Bounded: the checker refuses anything
  `contract-provenance.json` declares, and every entry is visible in a
  `governance_record_only` file whose diffs are reviewed.
- **A toolchain change alters generated output.** Not silent: `check:generated`
  compares `src/generated/` byte-for-byte against the contract on every `sdk` run, and
  the contract's own `validate` regenerates and compares its artifacts. Verified for
  this bump — reinstalling on 3.1.7 and regenerating changed no artifact.
