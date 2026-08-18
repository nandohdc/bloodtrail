## 1. Coverage holder

- [x] 1.1 Record the spec-fold coverage basis, the reproduced single-diagnostic failure, and the proven keeper remedy in the proposal — `proposal.md` records the perimeter basis, the single `openspec-association-unrelated` diagnostic on `openspec/specs/security-audit-sdk-core/spec.md` reproduced in a disposable worktree at `6056ded9bfcf6e945ae21491a5cb71ac85c3e622`, and the keeper remedy; assessment A = `78b62316561c3cea61d7bbbb26c2c06d68d95897`
- [x] 1.2 Remain active, declaring the `security-audit-sdk-core` capability, until the `bundle-validator-runtime-helpers` archive merges — the declaration stayed active through `9e9d518d9f159ccc038d5390797823d759ec6935`, which folded the ADDED requirement into `openspec/specs/security-audit-sdk-core/spec.md` under this change's coverage

## 2. Landing (human-owned)

- [x] 2.1 Owner identity-preserving merge of this keeper change — PR #176 merged as `f94b34f00e2a0423a2175fd6482c00294f111c90` (two parents: prior mainline `6056ded9bfcf6e945ae21491a5cb71ac85c3e622` + branch tip `9e9d518d9f159ccc038d5390797823d759ec6935`), authored by the project owner
- [x] 2.2 After the `bundle-validator-runtime-helpers` archive merges, archive this change as a pure relocation with no spec fold — this commit moves the change byte-for-byte into the dated archive; `assessment.json` and `proposal.md` keep their active-path blobs, no `openspec/specs/` path is touched, and the archive commit hash is reported after storage, not self-bound
