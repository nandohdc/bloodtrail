## 1. Proposal

- [x] 1.1 Land the proposal PR for issue #87 against `origin/main`: the complete packet (`proposal.md`, `design.md`, the `security-audit-sdk-node` delta spec, `tasks.md`, `assessment.source.json`, `assessment.json`), `openspec validate add-provisional-node-binding --strict` passing, the required CI contexts green, conventional commit `docs(openspec): propose add-provisional-node-binding`, and every task unchecked. The diff SHALL modify only paths under `openspec/changes/add-provisional-node-binding/` — no runtime source, no package manifests, no contract paths.
- [x] 1.2 Run strict verification of OpenSpec and governance checkers: `openspec validate --all --strict`, `check-design-pattern-governance --phase assessment`, and `run-governance-dual-check.mjs` must pass cleanly at the proposal commit.

## 2. Review and authorization

- [x] 2.1 Obtain an independent exact-commit technical review bound to the proposal commit; record the review as evidence, not approval.
- [x] 2.2 Obtain the project owner's exact-commit authorization bound to the proposal commit before merge. Merge only after recorded decision and all required CI checks are green.

## 3. Implementation — Standalone package and Node SPI implementations

- [x] 3.1 Initialize `packages/security-audit-sdk-node` with `package.json` (`private: true`, `license: "UNLICENSED"`, first-party Core dependency, zero third-party runtime dependencies, Node engines), `package-lock.json`, and `tsconfig.json`.
- [x] 3.2 Implement `nodeIdentifiers` in `src/identifiers.ts` using `node:crypto.randomUUID()`.
- [x] 3.3 Implement `nodeClock` in `src/clock.ts` using `new Date()`.
- [x] 3.4 Implement `nodeByteLength` in `src/byte-length.ts` using `Buffer.byteLength(val, "utf8")`.
- [x] 3.5 Implement `nodeTimers` in `src/timers.ts` reproducing `shutdownTimerOwnership` with `handle.unref()` and no signal handlers or intervals.
- [x] 3.6 Implement `nodeContextProvider` in `src/context.ts` using `node:async_hooks.AsyncLocalStorage`.
- [x] 3.7 Implement `nodeSchemaRuntime` in `src/schema.ts` wrapping the generated CJS contract validator.
- [x] 3.8 Export public surface in `src/index.ts` including `nodePlatformProvider` bundle and `createNodeSecurityAuditSdk` convenience factory.
- [x] 3.9 Author `compatibility.json` and package README classifying the API as explicitly provisional and unfrozen.

## 4. Verification and equivalence proof

- [x] 4.1 Run unit and equivalence tests verifying Node providers reproduce pre-split Core behavior.
- [x] 4.2 Run child-process context isolation tests verifying concurrent asynchronous operations do not leak context.
- [x] 4.3 Run child-process shutdown tests verifying process terminates promptly when shutdown timer is scheduled.
- [x] 4.4 Run `check-dependencies.mjs` verifying only approved `node:*` built-ins and first-party `@bloodtrail/*` dependencies are referenced.
- [x] 4.5 Run `check-package-contents.mjs` verifying packed tarball installs and imports cleanly outside workspace root across Node 24.2.0 and Node 26.5.0.

## 5. Fold and archive

- [x] 5.1 Fold `security-audit-sdk-node` delta spec into canonical `openspec/specs/security-audit-sdk-node/spec.md`.
- [x] 5.2 Archive `add-provisional-node-binding` in a byte-preserving relocation commit and close issue #87.
