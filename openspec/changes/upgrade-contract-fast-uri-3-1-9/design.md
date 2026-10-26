## Context

The original candidate `7dc8aed` proposed the contract development-toolchain fast-uri 3.1.8 to 3.1.9 update through a maintainer-authored replacement for #888. Its assessment preceded its own lockfile commit. The owner subsequently merged #888 with its distinct governance records as `2ae8c925a1c2ec893ba174e2cf78678deac125d0`.

Current main already contains the exact lockfile bytes, Git blob `763106d71ef78f821ab6e84798c30fd55336f7ed`. The replacement's lockfile commit is therefore omitted by the rebase. The remaining seven files are change records only.

## Goals / Non-Goals

**Goals:** Preserve the original alternative's authored reasoning and verification history, make the actual integration scope explicit, and verify the record-only candidate with fresh review and CI.

**Non-Goals:** Reapplying the dependency update, redefining its landed ownership, retroactive implementation approval, contract semantics, generated artifacts, direct dependencies, CI policy, secrets, publication or activation.

## Decisions

### Preserve history without duplicating implementation

Retain the original full assessment and generated assessment source as historical authored reasoning for this alternative. Retain its original verification tasks with an explicit candidate binding. Update the integration narrative instead of describing an already-landed dependency change as new work.

The separate `fix-contract-dependabot-ci` change owns the implementation delivered by #888. Merging these records neither replaces that ownership nor retroactively authorizes an earlier candidate. The current diff contains no lockfile, manifest, product, workflow or canonical-spec edit.

### Revalidate the existing contract and dependency

Confirm that current main, this candidate and #888 have identical contract lockfile bytes. A clean contract install must resolve fast-uri 3.1.9, generation must remain current, and validation/audits must pass. The retained reuse record concerns the unchanged security-audit@2.1.0 contract; distinguish a validated original CRA from an approved skip when the current range has no CRA-triggering path.

### Bind integration evidence to the current candidate

Refresh the technical reviews, final governance, independent checker arms and required CI after the rebase. Passing evidence permits the owner's authorized merge only; it grants no contract activation, publication or Stage 2 execution authority.

## Lifecycle

#888 is already merged, so no future bot supersession or replacement operation is pending here. Archive this record-only skip-specs change separately after integration; no canonical fold is needed. Historical planning and verification are not substituted for the authority or evidence governing the already-landed implementation.
