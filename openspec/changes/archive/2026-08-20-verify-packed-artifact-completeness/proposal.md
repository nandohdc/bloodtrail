## Why

Issue #70's original validator defect is already repaired: #68 made the generated validator self-contained, and a positive production-only packed-consumer control already exists. The residual gap is that `test:package` can accept a tarball that cannot import, the effective completeness control has no deterministic failing twin, and the consumer import does not prove where each entry point resolved from.

Disposable package-copy probes establish the gap. A pack omitting `dist/validation/` passes the current package allowlist and fails only at import; a packed validator referencing an undefined bundled helper passes both the allowlist and the shipped-import policy and fails only at import; the existing packed-consumer control rejects both while an unmutated control passes.

## What Changes

- Make `test:package` perform one real pack, apply the existing inventory allowlist to that pack output, install the exact tarball into a disposable production-only offline consumer, import every declared entry point by package specifier, prove its resolution provenance, and validate one canonical event.
- Extract the packed-artifact completeness procedure into one module shared by the package gate and the existing deeper packed-consumer verification test, without adding a second pack to `validate`.
- Add deterministic package-copy mutations for incomplete inventory, incomplete artifact, and outside-consumer resolution, plus an unmutated control in the same harness.
- Require bounded, content-free diagnostics and cleanup of the tarball and consumer on passing and failing paths.
- Record the distinction between a complete packed artifact and a self-contained one, and record why the package gate now executes an install.
- Add no npm script, runtime dependency, public API, publication path, package-manager change, multi-package topology, or production integration. The shipped-import policy from #69 and scope work tracked by #71 remain unchanged.

Traceability: PLAN-037, PLAN-038, PLAN-074, PLAN-091.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Require package verification to prove packed-artifact completeness through the declared export map and to carry deterministic positive and negative controls.

## Impact

Affected implementation is limited to the SDK package's package-verification scripts and verification tests. The existing `test:package` command changes from dry-run inspection to one offline pack-install-import execution, requiring a writable temporary directory but no network access. Package metadata, export-map shape, packed file policy, runtime dependencies, contract version, publication posture, and production authorization do not change.

The assurance remains bounded: the gate proves that the packed artifact loads and validates through declared entry points. It does not prove the absence of unexercised broken paths, dependency safety, publication readiness, or production suitability.
