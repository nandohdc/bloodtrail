## Context

See `proposal.md` for motivation. The SDK declares AJV 8.20.0 directly; AJV
accepts `fast-uri` through `^3.0.1`, while the committed lockfile currently
pins 3.1.5. CI installs from that lockfile, completes the SDK validation chain,
and then fails `npm audit --audit-level=low` because the resolved transitive
release is vulnerable.

## Goals / Non-Goals

**Goals:**

- Resolve `fast-uri` to the patched 3.1.7 release within AJV's existing range.
- Keep the dependency refresh reproducible and limited to the lockfile entry.
- Prove both SDK behavior and the audit gate remain acceptable.

**Non-Goals:**

- Change AJV, AJV Formats, or any direct dependency declaration.
- Change SDK source, generated files, public API, or validation semantics.
- Weaken, bypass, or reconfigure the repository's audit threshold.

## Decisions

### Refresh only the transitive lockfile resolution

Update the `node_modules/fast-uri` version, registry URL, and integrity digest
to the values for 3.1.7. AJV's declared range already admits that version, so
adding an override or direct `fast-uri` dependency would create unnecessary
ownership and maintenance obligations.

Updating AJV was rejected because the direct version is not the vulnerable
unit and widening the change would increase the behavioral regression surface.
Suppressing the advisories or lowering the audit threshold was rejected because
patched bytes are available without a dependency-contract change.

### Preserve a focused generated-lockfile diff

Use the registry-generated 3.1.7 resolution and integrity metadata, then verify
the final diff changes only the existing `fast-uri` lock entry. Incidental
lockfile normalization from a different npm version is excluded because it is
unrelated to the security remediation.

### Validate installation, behavior, and advisory state separately

Run `npm ci` to prove lockfile reproducibility, the full SDK `validate` script
to cover build, tests, generated-boundary checks, and Git-state checks, and
`npm audit --audit-level=low` to exercise the gate that failed in CI. A focused
lockfile assertion will confirm 3.1.7 is the resolved version.

## Risks / Trade-offs

- **[Risk] A patched transitive release changes URI handling used by AJV** → Run
  the complete SDK validation chain rather than relying on audit output alone.
- **[Risk] Local npm rewrites unrelated lockfile metadata** → Inspect the final
  diff and retain only the 3.1.7 version, URL, and integrity fields.
- **[Trade-off] Registry advisory data can change after verification** → Record
  the exact command result at implementation time and rely on CI for an
  independent clean-install check.

## Migration Plan

Commit the focused lockfile refresh and let CI install it from scratch. Rollback
is the inverse lockfile change, but only if 3.1.7 causes a demonstrated SDK
regression; rollback would reintroduce known high-severity advisories and must
not be used merely to bypass the audit gate.
