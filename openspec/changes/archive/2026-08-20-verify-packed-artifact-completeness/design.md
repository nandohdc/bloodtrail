## Context

See `proposal.md` for motivation. The existing positive control packs, installs, imports, and validates successfully, but it runs only under `test:verification`; `test:package` performs a dry-run inventory inspection. Package-copy probes show that the package gate accepts both an inventory missing a loaded module and an artifact referencing an undefined bundled helper. The positive control rejects both, but has no mutation twin and does not assert resolution provenance.

The SDK remains an isolated, private, unpublished technical candidate. The implementation must add no runtime dependency, npm command, export, publication path, production transport, or network dependency. The package export map is the authority for entry points. `--offline` is required for the disposable install.

## Goals / Non-Goals

**Goals:**

- Make one packed artifact serve the inventory allowlist and production-only consumer proof.
- Make inventory completeness, artifact completeness, and resolution provenance independently falsifiable with a passing null control.
- Preserve every behavioural assertion in the existing packed-consumer test through a shared installed-consumer hook.
- Keep diagnostics bounded, deterministic, and free of artifact source content.

**Non-Goals:**

- Enumerating all transitive internal modules in a second allowlist.
- Extending the shipped-import dependency policy to relative specifiers.
- Changing package metadata, exports, dependencies, contract content, or production authorization.
- Adding `test:package` to `test:matrix` or adding another npm script.

## Decisions

### One real pack serves both checks

`test:package` will replace `npm pack --dry-run --json` with one `npm pack --json --pack-destination <temporary-directory>`. A real pack returns the same `files` inventory, so an `onPacked` hook applies the existing allowlist before the disposable consumer installs and imports that exact tarball. A dry run followed by a real pack was rejected because it checks two independently produced artifacts and adds a second pack to `validate`.

### One shared completeness module serves two callers

A new `scripts/packed-completeness.mjs` module will own pack, install, export-map import, provenance, canonical validation, and cleanup. `check-package-contents.mjs` consumes its inventory. `packed-consumer-closure.test.mjs` supplies an `onInstalled` hook to retain its structural-negative, semantic-negative, URI-format, and installed-validator assertions. Duplicating the procedure was rejected because the gate and verification control could drift.

### Resolution provenance fails closed and remains mutation-proved

The consumer probe will resolve and import every declared export-map entry point from inside the disposable consumer and require each resolved URL to be under that consumer's installed package directory. The mutation harness replaces only the disposable install process with a deterministic shim that places a package symlink to a decoy outside the consumer; the probe must reach the provenance assertion and fail for provenance rather than for a missing module.

This decision is conditional only at implementation time: if the decoy construction cannot be deterministic across the supported execution environment, both the provenance assertion and its normative scenario will be removed and PLAN-091 will be refiled. The assertion will not be softened or silently skipped.

### Three failing mutations and one null control

A package-copy harness runs the real `check-package-contents.mjs` command against: an unmutated control, a `files` inventory excluding `dist/validation/`, a validator binding pointed at an undefined identifier, and an ancestor decoy package. Every failing arm asserts status and diagnostic content, output bounds, source-marker absence, control-character escaping, and temporary-path cleanup. The null control distinguishes detection from harness noise.

### Completeness is distinct from self-containment

A packed artifact is complete when no module loaded by its declared entry points is absent. It is self-contained when it references no module outside itself. ADR-SDK-011 already owns and proves self-containment. New normative text uses completeness; `closure` remains reserved for lifecycle closure. The legacy packed-consumer test filename remains unchanged.

### The package gate may execute an install

The package gate will execute one local, offline, production-only install in a disposable directory. This places the proof under the command named by issue #70 and makes `test:package` truthful about the packed artifact rather than merely its inventory. A root ADR records the inspect-versus-execute decision; an SDK ADR is not added because the SDK ADR sequence is coherence-pinned and ADR-SDK-011 already governs validator packaging.

### Execution discharges the relative-specifier limitation

The shipped-import policy remains intentionally limited to classifying module specifiers. Packed execution is the correct layer for detecting missing relative modules and undefined bundled identifiers, so `check-dependencies.mjs` and its parser remain unchanged.

## Risks / Trade-offs

- [The install adds work to every full SDK validation] → Use one real pack for both inventory and execution; keep install offline and ignore scripts.
- [Resolution provenance can accidentally become non-falsifiable] → Require the M-70-C decoy mutation; remove the assertion and scenario rather than weakening the mutation if determinism cannot be established.
- [npm can walk to an ancestor manifest] → Create a minimal private consumer manifest before installation.
- [Temporary artifacts can survive a failure] → Allocate both roots outside the package and remove them in a `finally`; assert cleanup on passing and failing arms.
- [Runtime exceptions can disclose source or produce unbounded output] → Wrap failures in bounded diagnostics naming only violation class, entry point, and escaped module or identifier.
- [The gate proves only exercised entry-point paths] → Preserve the explicit assurance limitation; do not claim whole-package correctness, dependency safety, publication readiness, or production suitability.
