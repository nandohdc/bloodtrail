## 1. Decision and scope
- [x] 1.1 Record the ADR-SDK-011 basis and the exact defect surface in the proposal
- [x] 1.2 Bound the change to the declared owned paths

## 2. Implementation and verification
- [x] 2.1 Vendor the ajv runtime helper and the ajv-formats validators
- [x] 2.2 Wire the generator post-processor and the MIT attribution header
- [x] 2.3 Prove bundled format semantics match the pinned implementations
- [x] 2.4 Record the bundled-code attribution in DEPENDENCIES.md
- [x] 2.5 Reproduce and regression-lock the production-only consumer install
- [x] 2.6 Run the full SDK and contract gate chains
- [x] 2.7 Run the governance checkers and strict OpenSpec validation

## 3. Landing (human-owned)
- [x] 3.1 Owner exact-commit approval of T — signed governance record `ebf6ccf5e3cfb63ca64e0e778e5278bc723632af` binds reviewedCommit `383f326ad8c684d984a531079bd4ed09aa4fb564` (T); the owner approval is quoted in the record's signatureDecision
- [x] 3.2 Owner identity-preserving merge of T and S — PR #175 merged as `46d3387` (two parents: prior mainline `1786eeb` + branch tip `ebf6ccf`); T and S both reachable from M
- [x] 3.3 Archive the change and fold the spec delta — this commit moves the change byte-for-byte into the dated archive and folds the ADDED requirement into `openspec/specs/security-audit-sdk-core/spec.md`; the archive commit hash is reported after storage, not self-bound
- [x] 3.4 Close #68 with evidence — issue closed 2026-08-18T00:40:51Z with stateReason COMPLETED (owner)
