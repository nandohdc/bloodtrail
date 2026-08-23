## Why

The SDK scope gate still applies raw source-content regexes and a narrow text import scan before the AST-based platform-coupling stage that already performs the relevant semantic checks. The legacy scans falsely reject harmless comments and string literals, miss dynamic imports, silently ignore read failures, and make a surviving AST-backed control appear to test a mechanism that no longer needs to exist.

## What Changes

- Remove the legacy `forbiddenSource` patterns, their source-content loop, and the text-based module-specifier scan from the SDK scope gate.
- Retain the forbidden-filename, package-manifest, and AST platform-coupling controls without changing their declared policy data or permitted runtime imports.
- Remove the legacy `.ts` filter and generated-source skip that only served the deleted source-text scans, so the retained filename guard covers every source-tree artifact.
- Add positive, negative, null, and widened-filename mutation evidence showing that retirement improves precision without reducing the relevant rejection surface.
- Rename and strengthen the existing `fetch()` mutation assertion so it identifies the AST platform-coupling diagnostic that remains responsible for the rejection.
- Fold the dead `command()` helper removal from #169 into the implementation commit because the change already touches its sole host file.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The canonical SDK specification already requires forbidden production-integration filename enforcement and does not require raw source-token scanning. This is a checker implementation and verification refactor that preserves that requirement while removing an unsound redundant stage.

## Impact

The change is confined to `packages/security-audit-sdk-core/scripts/check-scope.mjs`, its verification tests, and the active OpenSpec governance artifacts. It adds no SDK API, dependency, contract, transport, exporter, collector, storage, telemetry, browser, production-integration, or authorization surface.
