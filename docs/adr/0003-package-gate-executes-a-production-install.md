# ADR 0003: The package gate executes a production-only install

- Status: Accepted
- Date: 2026-08-20
- Decision owners: Project owner

## Context

The SDK validation chain had no package-gate step that installed the artifact it inspected. `test:package` used `npm pack --dry-run` to enforce an intentional file allowlist, while a separate verification test packed, installed, imported, and validated successfully. Issue #70 names `test:package` as the verification entry point, but a tarball omitting a module loaded by a declared entry point passed that command and failed only at import.

The existing packed-consumer control catches both an omitted loaded module and an undefined bundled runtime helper. It had no deterministic failing twin, however, so the repository had not proved that the control remained able to fail.

## Decision

The package gate SHALL perform one real `npm pack`, apply the existing inventory allowlist to that pack output, and install that exact tarball into a disposable consumer with production-only dependencies. The install SHALL be offline, ignore package scripts, import every declared export-map entry point by package specifier, establish resolution from the disposable consumer, and validate one canonical event.

The package gate and the deeper behavioural verification test SHALL use the same completeness procedure. Deterministic package-copy mutations and an unmutated control SHALL prove the procedure can distinguish incomplete inventory, incomplete artifacts, and outside-consumer resolution from a valid packed artifact.

## Consequences

- `validate` now executes one local install where it previously only inspected package inventory.
- The gate requires writable operating-system temporary storage and removes both the pack and consumer roots on passing and failing paths.
- `--offline`, a local tarball path, and `--ignore-scripts` keep the operation network-free and prevent lifecycle hooks.
- One real pack serves both the inventory allowlist and the consumer proof; `validate` gains no second pack.
- The proof is bounded to paths exercised through declared entry points. It does not establish the absence of unexercised defects, dependency safety, publication readiness, or production suitability.

## Alternatives considered

### Leave completeness under test:verification

Rejected. It leaves the command named by issue #70 as an inventory-only check and gives the effective packed-consumer control no mutation twin under the package-gate seam.

### Enumerate every packed module in the required-file allowlist

Rejected. The enumeration is a second list that can drift from what the declared entry points actually load, and it cannot detect an artifact that references an undefined bundled helper because that mutation changes no packed path.
