## 1. Decision record

- [x] 1.1 Record the owner decision as ADR-SDK-011 (BUNDLED_STANDALONE_VALIDATOR) enumerating manifest, lockfile, generator, license, and gate consequences, bound to the S-6 reproduction
- [x] 1.2 Update check-coherence.mjs ADR count and sequence to ADR-SDK-011
- [x] 1.3 Run the full SDK validation chain (empty index)
- [x] 1.4 Run governance checker phases, dual check, and governance test suite
- [x] 1.5 Run openspec strict validation for the change and the repository
- [x] 1.6 Push and open the PR; report merge readiness (owner merges with an identity-preserving merge commit) — PR #170, merged as 3003e73663da (identity-preserving, 2 parents)
- [x] 1.7 After merge: verify ADR-SDK-011 at main and close #67 with an evidence comment (owner-confirmed) — ADR verified at main (blob 576bf190), issue closed 2026-08-17T03:15:34Z
