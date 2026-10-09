## Context

#769 was found while triaging #766. A verification kit whose generated npm
consumer manifest has its `overrides` removed still completes npm installation
and loads one core copy: npm links the packed Node binding's
`file:../security-audit-sdk-core` dependency to the kit's top-level core.
`npm ls --all` instead exits nonzero and reports that core invalid. The kit
must therefore test npm's dependency-tree judgment, not just runtime loading.

The existing Node binding requirement already says that the kit consumer
manifest pins the core to its own tarball through npm overrides, that the gate
fails closed, and that planted-defect controls prove their named checks. This
change does not alter that requirement or any kit content.

## Goals / Non-Goals

**Goals:**

- Fail the kit gate at a stable identity when its npm installation has an
  invalid dependency tree.
- Share the npm-tree assertion between kit and own-service installations.
- Prove that the missing-override defect is caught specifically by the new
  check, including when that check is disabled during the control sweep.

**Non-Goals:**

- Changing the packed Node binding's core dependency or any generated kit
  manifest.
- Adding a pnpm dependency-tree check.
- Changing the runtime one-copy probe, kit builder, package contents, or
  requirements.

## Decisions

### 1. Use a dedicated `npm-dependency-tree` identity

The gate adds `npm-dependency-tree` directly after `npm-installation`. The
control sweep disables the control's named check and requires the control to
fail. Disabling `npm-installation` leaves no install directory, so every later
check fails and a missing-override control named there would have a vacuous
disabled-check proof. Disabling the dedicated identity lets the planted kit
pass the whole gate, proving that `npm ls` is the sole detector.

### 2. State npm's dependency-tree clause

The new check contributes exactly `npm ls reported no invalid dependency after
the npm installation`. The clause describes the npm judgment that closes the
missing-pin gap and is reported in both build and existing-kit modes.

### 3. Plant by removing the kit core override

The control named `kit npm manifest without its core override` copies and
reseals a kit after one measured manifest rewrite that deletes `overrides`.
It runs the whole gate, expects npm's invalid file dependency at
`npm-dependency-tree`, and uses the disabled-check sweep to prove no other
check satisfies the failure.

### 4. Share one `npm ls` helper

The existing own-service assertion is extracted into one helper and reused by
the kit check. Calling it with `own service npm` preserves the existing
own-service error text byte-for-byte while preventing independent npm-tree
assertions from drifting.

### 5. Detect only; preserve the packed dependency

The packed Node binding retains its `file:../security-audit-sdk-core`
dependency. The kit's npm override is the designed core pin, and #769 only
checks that it remains effective; it does not change package content or how
the packed binding declares its dependency.

## Rejected

- **Extend `npm-installation` instead of adding an identity.** Disabling that
  check leaves the installation absent, making later unrelated failures satisfy
  the control sweep. It fails the force that each check's planted-defect proof
  cannot be satisfied by an unrelated failure.
- **Copy a second kit-specific `npm ls` assertion.** Separate kit and
  own-service implementations can drift in command, status handling, or error
  text. It fails the force that both npm installations are judged by one shared
  assertion.
- **Change the packed Node binding core dependency.** The existing requirement
  says building the kit SHALL NOT change the packed contents of the three
  packages, and #769 keeps that dependency out of scope. It fails the force
  that kit contents and packed packages remain unchanged.
- **Rely on the runtime one-copy probe.** npm can link the binding dependency
  to the top-level core without the override, so the probe passes while
  `npm ls --all` reports invalid. It fails the force that the gate rejects a
  kit resolved through anything other than its own npm core pin.

## Risks / Trade-offs

`npm ls --all` adds one npm process to the kit gate, but it evaluates the
installer's dependency-tree validity rather than inferring it from a loading
probe. The shared helper deliberately keeps the established own-service
failure text stable.

## Migration Plan

Merge the bounded correction with its new control and recorded validation.
Existing kit consumers need no migration because the generated manifest and
packed artifacts are unchanged. Archive this change only after implementation
merges, in a separate pull request.
