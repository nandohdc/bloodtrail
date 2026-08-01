# ADR-SDK-001: Package and runtime policy

- Status: Accepted for SDK-core implementation
- Date: 2026-07-31

## Decision

The isolated package is `@bloodtrail/security-audit-sdk-core` at `packages/security-audit-sdk-core`. It is ESM-only, uses an explicit export map, supports exactly Node.js majors 24 and 26, and is tested on pinned Node `24.2.0` and `26.5.0` releases; Node 25 and unlisted future majors are not implied. TypeScript uses `module` and `moduleResolution` `NodeNext`, all strict checks, declarations, and ES2024 output, with support `>=5.9.2 <6` and pinned compiler `5.9.2`. Dropping a supported Node major or raising the TypeScript baseline is a breaking package compatibility decision. Source maps are emitted for development packages but contain no event data. Build and generation dependencies remain development-only; runtime dependencies remain zero.

## Alternatives

A Node-26-only package was rejected as unnecessarily narrow. Dual CommonJS/ESM output was rejected because it doubles export-state and testing complexity without a current consumer requirement.

## Boundary

This ADR authorizes no application integration or production deployment.
