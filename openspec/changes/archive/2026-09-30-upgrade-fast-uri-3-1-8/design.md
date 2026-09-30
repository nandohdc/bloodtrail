## Context

See `proposal.md`. sdk-core declares AJV 8.20.0 as a development dependency, and AJV accepts
`fast-uri` through `^3.0.1`. The lockfile pins 3.1.7. CI installs from the lockfile, and the `sdk`
job stops at the sdk-core audit step, before any other workspace's validation runs.

## Goals / Non-Goals

**Goals:**

- Resolve `fast-uri` to 3.1.8 within AJV's existing range.
- Keep the diff to the one lockfile entry.

**Non-Goals:**

- Changing AJV, AJV Formats or any direct dependency declaration.
- Changing SDK source, generated files, the public API or validation semantics.
- Lowering, bypassing or reconfiguring the audit threshold.
- Touching the frozen contract workspace's lockfile, whose check audits at `high`.

## Decisions

### Refresh only the transitive lockfile entry

`npm audit fix --package-lock-only` rewrites the entry's version, registry URL and integrity, and
nothing else. It keeps the package `dev: true` and leaves `package.json` untouched.
`npm install --package-lock-only fast-uri@3.1.8` is not used, because it adds `fast-uri` to
`dependencies`, which must stay empty.

Rejected:

- **A direct `fast-uri` constraint or npm override.** AJV's range already admits 3.1.8, so the
  constraint duplicates it and adds a manifest-level obligation.
- **Upgrading AJV.** AJV is not the vulnerable unit, and a new AJV could change the generated
  validator.
- **Lowering the audit threshold or waiving the finding.** `DEPENDENCIES.md` forbids it, and the
  patched bytes exist.

### Verify behaviour, generation and the advisory separately

- `npm ci` proves the lockfile installs.
- `check:generated` proves the generated validator is unchanged.
- The full `validate` chain covers everything else.
- `npm audit --audit-level=low` exercises the step that failed.

## Risks / Trade-offs

- **3.1.8 changes URI handling that AJV uses during generation.** `check:generated` compares the
  generated output byte-for-byte, and the full `validate` chain runs.
- **Advisory data can change after verification.** CI runs its own clean install and audit.

## Migration Plan

Merge the lockfile refresh. Rolling back reintroduces a known advisory and must not be used only to
get past the audit gate.
