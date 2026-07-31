# ADR-SDK-001: Package and runtime policy

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

The isolated package is `@bloodtrail/security-audit-sdk-core` at `packages/security-audit-sdk-core`. It is ESM-only, uses an explicit export map, targets Node.js `>=24`, and is tested on pinned Node 24 and Node 26 releases. TypeScript uses `module` and `moduleResolution` `NodeNext`, all strict checks, declarations, and ES2024 output. Dropping a supported Node major or raising the TypeScript baseline is a package compatibility decision. Source maps are emitted for development packages but contain no event data. Build and generation dependencies remain development-only unless ADR-SDK-003 proves a runtime validator dependency is required.

## Alternatives

A Node-26-only package was rejected as unnecessarily narrow. Dual CommonJS/ESM output was rejected because it doubles export-state and testing complexity without a current consumer requirement.

## Boundary

This ADR authorizes no application integration or production deployment.
